package com.sp.selplat.common.db.query;

import com.sp.selplat.common.db.datasource.CommonDbSource;
import com.sp.selplat.common.db.query.model.CommonDynamicQuery;
import com.sp.selplat.common.db.query.model.QueryCondition;
import com.sp.selplat.common.db.query.model.QueryOperator;
import com.sp.selplat.common.db.query.model.QueryOrder;
import com.sp.selplat.common.db.metadata.DatabaseMetadataReader;
import java.util.List;

/**
 * 默认通用查询校验器基于当前数据源的真实表结构做查询合法性校验。
 * 这里先校验表、字段、条件和排序，是为了把动态查询能力约束在业务表结构边界内，避免上层直接拼接任意 SQL。
 */
public class DefaultCommonQueryValidator implements CommonQueryValidator {

    // metadataReader 承接底层表结构读取能力，供校验阶段确认表和字段是否真实存在。
    private final DatabaseMetadataReader metadataReader;

    /**
     * 创建默认通用查询校验器。
     *
     * @param metadataReader 元数据读取器
     */
    public DefaultCommonQueryValidator(DatabaseMetadataReader metadataReader) {
        // 元数据读取器为空时直接拒绝创建校验器，避免后续校验过程失去表结构依据。
        if (metadataReader == null) {
            throw new IllegalArgumentException("metadataReader must not be null");
        }
        // 保存元数据读取器，供每次查询校验时复用统一的表结构读取链路。
        this.metadataReader = metadataReader;
    }

    /**
     * 校验完整查询对象。
     *
     * @param query 通用查询对象
     */
    @Override
    public void validate(CommonDynamicQuery query) {
        // 先校验查询对象和数据源实体本身，保证后续所有结构校验都建立在完整上下文上。
        validateQuery(query);
        // 校验目标表是否存在于当前数据源中，避免动态查询越过业务表边界。
        validateTable(query);
        // 校验查询字段是否全部属于目标表结构，避免 select 字段拼接任意列。
        validateSelectFields(query);
        // 校验条件集合中的字段、操作符和值是否合法，避免 where 子句进入不受控状态。
        validateConditions(query, query.getConditions());
        // 校验排序集合中的字段和方向是否合法，避免 order by 动态拼接任意表达式。
        validateOrders(query, query.getOrders());
        // 校验分页参数是否成对出现且数值合法，避免分页 SQL 生成出错。
        validatePage(query);
    }

    /**
     * 校验表名。
     *
     * @param query 通用查询对象
     */
    @Override
    public void validateTable(CommonDynamicQuery query) {
        // 表名为空时直接拒绝处理，避免查询链路失去明确目标表。
        if (!hasText(query.getTableName())) {
            throw new IllegalArgumentException("query.tableName must not be blank");
        }
        // 当前表在目标数据源中不存在时直接拒绝处理，避免 SQL 命中错误表或抛出运行期异常。
        if (!metadataReader.existsTable(query.getDataSource(), query.getTableName())) {
            throw new IllegalArgumentException("table not found: " + query.getTableName());
        }
    }

    /**
     * 校验查询字段集合。
     *
     * @param query 通用查询对象
     */
    @Override
    public void validateSelectFields(CommonDynamicQuery query) {
        // 查询字段为空时直接拒绝处理，避免底层退化成不受控的 select *。
        if (query.getSelectFields() == null || query.getSelectFields().isEmpty()) {
            throw new IllegalArgumentException("query.selectFields must not be empty");
        }
        // 逐个校验查询字段，保证每个字段都真实属于目标表结构。
        for (String fieldName : query.getSelectFields()) {
            // 单个字段名为空或空白时直接拒绝，避免生成非法 select 子句。
            if (!hasText(fieldName)) {
                throw new IllegalArgumentException("query.selectFields contains blank field");
            }
            // 当前字段不属于目标表时直接拒绝处理，防止动态字段越权读取。
            if (!metadataReader.existsColumn(query.getDataSource(), query.getTableName(), fieldName)) {
                throw new IllegalArgumentException("select field not found: " + fieldName);
            }
        }
    }

    /**
     * 校验条件集合。
     *
     * @param query 通用查询对象
     * @param conditions 条件集合
     */
    @Override
    public void validateConditions(CommonDynamicQuery query, List<QueryCondition> conditions) {
        // 条件集合为空时直接视为无筛选条件，兼容列表全量浏览场景。
        if (conditions == null || conditions.isEmpty()) {
            return;
        }
        // 逐个校验条件对象，保证 where 子句每一段都来自受控结构。
        for (QueryCondition condition : conditions) {
            // 条件对象本身为空时直接拒绝处理，避免后续 SQL 生成阶段出现空指针。
            if (condition == null) {
                throw new IllegalArgumentException("query.conditions contains null condition");
            }
            // 条件字段为空或空白时直接拒绝处理，避免 where 子句无法定位目标列。
            if (!hasText(condition.getFieldName())) {
                throw new IllegalArgumentException("condition.fieldName must not be blank");
            }
            // 条件字段不属于目标表时直接拒绝处理，防止动态条件越权拼接任意列。
            if (!metadataReader.existsColumn(query.getDataSource(), query.getTableName(), condition.getFieldName())) {
                throw new IllegalArgumentException("condition field not found: " + condition.getFieldName());
            }
            // 条件操作符为空时直接拒绝处理，避免 SQL 生成阶段无法决定比较方式。
            if (condition.getOperator() == null) {
                throw new IllegalArgumentException("condition.operator must not be null");
            }
            // 根据操作符类型校验单值或区间值是否完整，保证 where 条件参数成形。
            validateConditionValue(condition);
        }
    }

    /**
     * 校验排序集合。
     *
     * @param query 通用查询对象
     * @param orders 排序集合
     */
    @Override
    public void validateOrders(CommonDynamicQuery query, List<QueryOrder> orders) {
        // 排序集合为空时直接视为不排序，兼容由上层决定默认顺序的场景。
        if (orders == null || orders.isEmpty()) {
            return;
        }
        // 逐个校验排序对象，保证 order by 子句完全来自结构化输入。
        for (QueryOrder order : orders) {
            // 排序对象本身为空时直接拒绝处理，避免后续拼接排序片段时出现空指针。
            if (order == null) {
                throw new IllegalArgumentException("query.orders contains null order");
            }
            // 排序字段为空或空白时直接拒绝处理，避免 order by 子句失去目标列。
            if (!hasText(order.getFieldName())) {
                throw new IllegalArgumentException("order.fieldName must not be blank");
            }
            // 排序字段不属于目标表时直接拒绝处理，防止动态排序越权拼接任意列。
            if (!metadataReader.existsColumn(query.getDataSource(), query.getTableName(), order.getFieldName())) {
                throw new IllegalArgumentException("order field not found: " + order.getFieldName());
            }
            // 排序方向为空时直接拒绝处理，避免 SQL 生成阶段无法输出 asc 或 desc。
            if (order.getDirection() == null) {
                throw new IllegalArgumentException("order.direction must not be null");
            }
        }
    }

    /**
     * 校验查询对象和数据源。
     *
     * @param query 通用查询对象
     */
    private void validateQuery(CommonDynamicQuery query) {
        // 查询对象为空时直接拒绝处理，避免后续所有校验失去根对象。
        if (query == null) {
            throw new IllegalArgumentException("query must not be null");
        }
        // 数据源实体为空时直接拒绝处理，避免后续无法获知数据库类型和连接来源。
        if (query.getDataSource() == null) {
            throw new IllegalArgumentException("query.dataSource must not be null");
        }
        // 当前查询未携带真实数据源对象时直接拒绝，避免执行阶段拿不到连接。
        CommonDbSource dataSource = query.getDataSource();
        if (dataSource.getDataSource() == null) {
            throw new IllegalArgumentException("query.dataSource.dataSource must not be null");
        }
        // 当前查询未声明数据库类型时直接拒绝，避免方言层无法决定 SQL 生成方式。
        if (dataSource.getDatabaseType() == null) {
            throw new IllegalArgumentException("query.dataSource.databaseType must not be null");
        }
    }

    /**
     * 校验条件值。
     *
     * @param condition 条件对象
     */
    private void validateConditionValue(QueryCondition condition) {
        // BETWEEN 条件必须同时具备起止值，否则区间查询无法形成完整边界。
        if (QueryOperator.BETWEEN == condition.getOperator()) {
            if (condition.getValue() == null || condition.getSecondValue() == null) {
                throw new IllegalArgumentException("between condition values must not be null");
            }
            return;
        }
        // 其余单值条件必须具备首值，否则 where 比较语义不成立。
        if (condition.getValue() == null) {
            throw new IllegalArgumentException("condition.value must not be null");
        }
    }

    /**
     * 校验分页参数。
     *
     * @param query 通用查询对象
     */
    private void validatePage(CommonDynamicQuery query) {
        // 页码和页大小都为空时表示当前查询不启用分页，直接允许通过。
        if (query.getPageNo() == null && query.getPageSize() == null) {
            return;
        }
        // 只传一个分页参数时直接拒绝处理，避免底层无法稳定计算分页区间。
        if (query.getPageNo() == null || query.getPageSize() == null) {
            throw new IllegalArgumentException("pageNo and pageSize must both be provided");
        }
        // 页码小于 1 时直接拒绝处理，避免偏移量计算出现负值。
        if (query.getPageNo() < 1) {
            throw new IllegalArgumentException("pageNo must be greater than 0");
        }
        // 页大小小于 1 时直接拒绝处理，避免分页 SQL 生成非法 limit 值。
        if (query.getPageSize() < 1) {
            throw new IllegalArgumentException("pageSize must be greater than 0");
        }
    }

    /**
     * 判断文本是否有值。
     *
     * @param value 文本值
     * @return 是否有值
     */
    private boolean hasText(String value) {
        // 统一以非空且去空白后仍有长度作为文本有效标准，保持校验口径一致。
        return value != null && !value.trim().isEmpty();
    }
}





