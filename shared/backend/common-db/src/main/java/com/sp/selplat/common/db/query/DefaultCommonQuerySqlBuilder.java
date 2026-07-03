package com.sp.selplat.common.db.query;

import com.sp.selplat.common.db.dialect.DatabaseDialect;
import com.sp.selplat.common.db.dialect.DatabaseDialectFactory;
import com.sp.selplat.common.db.domain.CommonDynamicQuery;
import com.sp.selplat.common.db.domain.QueryCondition;
import com.sp.selplat.common.db.domain.QueryOrder;
import com.sp.selplat.common.db.domain.QueryOrderDirection;
import java.util.ArrayList;
import java.util.List;

/**
 * 默认通用查询 SQL 构建器负责把结构化查询对象翻译成可执行 SQL 和参数列表。
 * 这里统一生成 select、where、order by 和分页片段，是为了把动态查询的字符串拼接收口在一个受控实现中。
 */
public class DefaultCommonQuerySqlBuilder implements CommonQuerySqlBuilder {

    // validator 承接查询对象合法性校验能力，确保 SQL 构建只处理已通过校验的结构化输入。
    private final CommonQueryValidator validator;
    // dialectFactory 承接数据库类型到方言实现的分发逻辑，供分页和 like 规则统一选择。
    private final DatabaseDialectFactory dialectFactory;

    /**
     * 创建默认通用查询 SQL 构建器。
     *
     * @param validator 查询校验器
     * @param dialectFactory 数据库方言工厂
     */
    public DefaultCommonQuerySqlBuilder(CommonQueryValidator validator,DatabaseDialectFactory dialectFactory) {
        // 查询校验器为空时直接拒绝创建，避免 SQL 构建脱离字段合法性边界。
        if (validator == null) {
            throw new IllegalArgumentException("validator must not be null");
        }
        // 方言工厂为空时直接拒绝创建，避免分页和 like 规则失去统一分发能力。
        if (dialectFactory == null) {
            throw new IllegalArgumentException("dialectFactory must not be null");
        }
        // 保存查询校验器，供每次构建 SQL 前统一做结构合法性收口。
        this.validator = validator;
        // 保存方言工厂，供不同数据库类型在构建阶段复用统一的方言选择逻辑。
        this.dialectFactory = dialectFactory;
    }

    /**
     * 构建列表查询 SQL。
     *
     * @param query 通用查询对象
     * @return 已构建 SQL 结果对象
     */
    @Override
    public BuiltQuerySql buildSelect(CommonDynamicQuery query) {
        // 先校验完整查询对象，确保接下来拼接的字段、条件和排序都来自受控输入。
        validator.validate(query);
        // 根据当前数据源数据库类型选择方言，供分页和 like 值构建统一使用。
        DatabaseDialect dialect = dialectFactory.getDialect(
            query.getDataSource().getDatabaseType()
        );
        // 创建参数列表承接 where 子句绑定值，供最终 PreparedStatement 顺序绑定。
        List<Object> parameters = new ArrayList<>();
        // 先构建不含分页的基础 select SQL，供后续按是否分页继续追加方言片段。
        String baseSql = buildBaseSelectSql(query, dialect, parameters, true);
        // 未启用分页时直接返回基础 SQL，保持非分页查询链路最简。
        if (query.getPageNo() == null || query.getPageSize() == null) {
            return buildBuiltQuerySql(baseSql, parameters);
        }
        // 计算当前页的起始偏移量，供数据库方言生成对应的分页片段。
        int offset = (query.getPageNo() - 1) * query.getPageSize();
        // 基于基础 SQL 生成分页 SQL，保证分页语法按数据库类型统一分发。
        String pagedSql = dialect.buildPagedSql(baseSql, offset, query.getPageSize());
        // 返回分页后的最终 SQL 和参数列表，供执行器直接按问号顺序绑定执行。
        return buildBuiltQuerySql(pagedSql, parameters);
    }

    /**
     * 构建总数查询 SQL。
     *
     * @param query 通用查询对象
     * @return 已构建 SQL 结果对象
     */
    @Override
    public BuiltQuerySql buildCount(CommonDynamicQuery query) {
        // 先校验完整查询对象，保证总数查询与列表查询使用同一套合法性边界。
        validator.validate(query);
        // 根据数据库类型选择方言，供 count SQL 外层包装统一处理。
        DatabaseDialect dialect = dialectFactory.getDialect(
            query.getDataSource().getDatabaseType()
        );
        // 创建参数列表承接 count 查询 where 子句的绑定值，确保与基础条件顺序一致。
        List<Object> parameters = new ArrayList<>();
        // 构建不含排序和分页的基础查询 SQL，避免 count 语句携带无意义的展示型片段。
        String baseSql = buildBaseSelectSql(query, dialect, parameters, false);
        // 通过方言统一包装成总数查询 SQL，兼容多数据库的 count 书写差异。
        String countSql = dialect.buildCountSql(baseSql);
        // 返回总数查询 SQL 和参数列表，供执行器直接绑定并读取单值结果。
        return buildBuiltQuerySql(countSql, parameters);
    }

    /**
     * 构建基础查询 SQL。
     *
     * @param query 通用查询对象
     * @param dialect 数据库方言
     * @param parameters 参数列表
     * @param appendOrder 是否追加排序
     * @return 基础查询 SQL
     */
    private String buildBaseSelectSql(CommonDynamicQuery query,DatabaseDialect dialect,List<Object> parameters,boolean appendOrder) {
        // 创建 SQL 构建器承接各段查询片段，避免字符串直接多次拼接影响可读性。
        StringBuilder sqlBuilder = new StringBuilder();
        // 先写入 select 关键字和受控字段清单，确保列表查询只返回上层明确声明的字段。
        sqlBuilder.append("SELECT ");
        sqlBuilder.append(buildSelectFields(query.getSelectFields()));
        // 写入 from 片段并命中目标表，保证查询范围固定在当前业务 DAO 指定的物理表上。
        sqlBuilder.append(" FROM ");
        sqlBuilder.append(query.getTableName());
        // 条件集合非空时追加 where 子句，按结构化条件统一生成受控筛选表达。
        appendWhereClause(sqlBuilder, query.getConditions(), dialect, parameters);
        // 当前查询需要排序且本次允许输出排序片段时，再统一追加 order by 子句。
        if (appendOrder) {
            appendOrderClause(sqlBuilder, query.getOrders());
        }
        // 返回构建好的基础查询 SQL，供分页和总数逻辑继续复用。
        return sqlBuilder.toString();
    }

    /**
     * 构建字段清单。
     *
     * @param selectFields 字段清单
     * @return select 字段片段
     */
    private String buildSelectFields(List<String> selectFields) {
        // 创建字段片段构建器，保证字段顺序与上层 DAO 传入顺序保持一致。
        StringBuilder fieldBuilder = new StringBuilder();
        // 逐个写入 select 字段，并用逗号连接形成受控字段清单。
        for (int index = 0; index < selectFields.size(); index++) {
            // 只有从第二个字段开始才追加逗号分隔，保证 select 片段语法正确。
            if (index > 0) {
                fieldBuilder.append(", ");
            }
            // 追加当前字段名，保持返回列顺序和业务定义一致。
            fieldBuilder.append(selectFields.get(index));
        }
        // 返回最终 select 字段片段，供基础查询 SQL 直接使用。
        return fieldBuilder.toString();
    }

    /**
     * 追加 where 子句。
     *
     * @param sqlBuilder SQL 构建器
     * @param conditions 条件集合
     * @param dialect 数据库方言
     * @param parameters 参数列表
     */
    private void appendWhereClause(StringBuilder sqlBuilder,List<QueryCondition> conditions,DatabaseDialect dialect,List<Object> parameters) {
        // 条件集合为空时不追加 where 子句，兼容无筛选的列表浏览场景。
        if (conditions == null || conditions.isEmpty()) {
            return;
        }
        // 先写入 where 关键字，后续条件统一按 and 链接形成完整筛选表达。
        sqlBuilder.append(" WHERE ");
        // 逐个处理结构化条件，保证不同操作符都按固定规则转换成 SQL 片段。
        for (int index = 0; index < conditions.size(); index++) {
            // 从第二个条件开始统一补 and，保证多条件筛选逻辑稳定。
            if (index > 0) {
                sqlBuilder.append(" AND ");
            }
            // 取出当前条件对象，供后续按字段、操作符和值生成 where 片段。
            QueryCondition condition = conditions.get(index);
            // 把当前条件转换成受控 SQL 片段，并把对应参数按顺序写入参数列表。
            appendSingleCondition(sqlBuilder, condition, dialect, parameters);
        }
    }

    /**
     * 追加单个条件片段。
     *
     * @param sqlBuilder SQL 构建器
     * @param condition 条件对象
     * @param dialect 数据库方言
     * @param parameters 参数列表
     */
    private void appendSingleCondition(StringBuilder sqlBuilder,QueryCondition condition,DatabaseDialect dialect,List<Object> parameters) {
        // 先写入当前条件命中的字段名，保证比较关系始终围绕受控业务字段展开。
        sqlBuilder.append(condition.getFieldName());
        // 根据操作符类型选择具体比较语法，并同步写入对应参数值。
        switch (condition.getOperator()) {
            // 等值条件直接输出等号比较，并把首值加入参数列表。
            case EQ:
                sqlBuilder.append(" = ?");
                parameters.add(condition.getValue());
                return;
            // 模糊条件统一输出 like 比较，并由方言构建带通配符的查询值。
            case LIKE:
                sqlBuilder.append(" LIKE ?");
                parameters.add(dialect.buildLikeValue(condition.getValue()));
                return;
            // 大于等于条件统一输出 >= 比较，并把首值加入参数列表。
            case GTE:
                sqlBuilder.append(" >= ?");
                parameters.add(condition.getValue());
                return;
            // 小于等于条件统一输出 <= 比较，并把首值加入参数列表。
            case LTE:
                sqlBuilder.append(" <= ?");
                parameters.add(condition.getValue());
                return;
            // 区间条件统一输出 between and 比较，并按顺序写入起止值。
            case BETWEEN:
                sqlBuilder.append(" BETWEEN ? AND ?");
                parameters.add(condition.getValue());
                parameters.add(condition.getSecondValue());
                return;
            // 未支持的操作符直接拒绝处理，避免构建出不确定 SQL。
            default:
                throw new IllegalArgumentException("unsupported operator: " + condition.getOperator());
        }
    }

    /**
     * 追加排序子句。
     *
     * @param sqlBuilder SQL 构建器
     * @param orders 排序集合
     */
    private void appendOrderClause(StringBuilder sqlBuilder, List<QueryOrder> orders) {
        // 排序集合为空时不追加 order by，兼容由上层忽略排序的场景。
        if (orders == null || orders.isEmpty()) {
            return;
        }
        // 先写入 order by 关键字，后续排序字段统一按逗号连接。
        sqlBuilder.append(" ORDER BY ");
        // 逐个输出排序字段和方向，保证展示顺序完全来自结构化输入。
        for (int index = 0; index < orders.size(); index++) {
            // 从第二个排序字段开始补逗号，形成合法的多字段排序片段。
            if (index > 0) {
                sqlBuilder.append(", ");
            }
            // 取出当前排序对象，供后续拼接字段名和方向。
            QueryOrder order = orders.get(index);
            // 先写入排序字段名，保证排序范围固定在受控字段上。
            sqlBuilder.append(order.getFieldName());
            // 再写入排序方向，保持 asc/desc 与结构化枚举值一一对应。
            sqlBuilder.append(QueryOrderDirection.ASC == order.getDirection() ? " ASC" : " DESC");
        }
    }

    /**
     * 构建 SQL 结果对象。
     *
     * @param sql SQL 文本
     * @param parameters 参数列表
     * @return SQL 结果对象
     */
    private BuiltQuerySql buildBuiltQuerySql(String sql, List<Object> parameters) {
        // 创建结果对象承接最终 SQL 和绑定参数，供执行器统一消费。
        BuiltQuerySql builtQuerySql = new BuiltQuerySql();
        // 写入最终 SQL 文本，供执行器直接创建 PreparedStatement。
        builtQuerySql.setSql(sql);
        // 写入与问号顺序一致的参数列表，供执行器逐位绑定。
        builtQuerySql.setParameters(parameters);
        // 返回完整的 SQL 构建结果，结束当前查询构建流程。
        return builtQuerySql;
    }
}
