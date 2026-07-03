package com.sp.selplat.common.db.query;

import com.sp.selplat.common.db.domain.CommonDynamicQuery;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 默认通用查询执行器负责把已构建 SQL 提交给 JDBC 并转换成统一结果结构。
 * 这里直接使用上层传入数据源实体里的真实数据源，是为了让查询执行链路完全受上层数据源选择控制。
 */
public class DefaultCommonQueryExecutor implements CommonQueryExecutor {

    // sqlBuilder 承接结构化查询到 SQL 的翻译能力，供执行阶段统一获取 SQL 和参数。
    private final CommonQuerySqlBuilder sqlBuilder;

    /**
     * 创建默认通用查询执行器。
     *
     * @param sqlBuilder 查询 SQL 构建器
     */
    public DefaultCommonQueryExecutor(CommonQuerySqlBuilder sqlBuilder) {
        // SQL 构建器为空时直接拒绝创建执行器，避免执行阶段无法获得最终 SQL。
        if (sqlBuilder == null) {
            throw new IllegalArgumentException("sqlBuilder must not be null");
        }
        // 保存 SQL 构建器，供列表、单行和总数查询共享同一套 SQL 翻译逻辑。
        this.sqlBuilder = sqlBuilder;
    }

    /**
     * 执行列表查询。
     *
     * @param query 通用查询对象
     * @return 列表结果
     */
    @Override
    public List<Map<String, Object>> query(CommonDynamicQuery query) {
        // 先构建当前列表查询的最终 SQL 和参数，保证执行阶段不再关心动态拼接细节。
        BuiltQuerySql builtQuerySql = sqlBuilder.buildSelect(query);
        // 执行列表 SQL 并把结果统一转换成键值列表，供上层 DAO 和业务服务直接消费。
        return executeListQuery(query, builtQuerySql);
    }

    /**
     * 执行单行查询。
     *
     * @param query 通用查询对象
     * @return 单行结果
     */
    @Override
    public Map<String, Object> queryOne(CommonDynamicQuery query) {
        // 复用列表查询链路执行当前 SQL，保证单行和列表查询的字段、条件口径完全一致。
        List<Map<String, Object>> resultList = query(query);
        // 没有结果时直接返回空，供上层 DAO 自行决定是否转业务异常。
        if (resultList.isEmpty()) {
            return null;
        }
        // 返回第一行结果，适合详情、唯一记录回查和存在性判断场景。
        return resultList.get(0);
    }

    /**
     * 执行总数查询。
     *
     * @param query 通用查询对象
     * @return 总数结果
     */
    @Override
    public long count(CommonDynamicQuery query) {
        // 先构建当前总数查询的最终 SQL 和参数，保证 count 语句和列表筛选条件保持一致。
        BuiltQuerySql builtQuerySql = sqlBuilder.buildCount(query);
        // 通过真实数据源获取连接并执行 count SQL，返回受控条件下的总记录数。
        try (
            Connection connection = query.getDataSource().getDataSource().getConnection();
            PreparedStatement preparedStatement = connection.prepareStatement(builtQuerySql.getSql())
        ) {
            // 先把 count SQL 的参数按顺序绑定到预编译语句，确保 where 条件与构建结果一致。
            bindParameters(preparedStatement, builtQuerySql.getParameters());
            // 执行总数查询并读取第一列数值结果，供分页场景输出总记录数。
            try (ResultSet resultSet = preparedStatement.executeQuery()) {
                // 能读到第一行结果时直接返回 count 值，符合 count 查询的固定返回模式。
                if (resultSet.next()) {
                    return resultSet.getLong(1);
                }
            }
        } catch (SQLException exception) {
            // 统一把 JDBC 执行异常收口成非法状态异常，避免上层被迫处理受检异常。
            throw new IllegalStateException("failed to execute count query", exception);
        }
        // 极端情况下若 count 查询没有任何返回行，则回退成 0，保持调用方拿到稳定结果。
        return 0L;
    }

    /**
     * 执行列表 SQL。
     *
     * @param query 通用查询对象
     * @param builtQuerySql 已构建 SQL
     * @return 列表结果
     */
    private List<Map<String, Object>> executeListQuery(CommonDynamicQuery query,BuiltQuerySql builtQuerySql) {
        // 创建结果集合承接 JDBC 返回的每一行数据，保持查询结果顺序与数据库返回顺序一致。
        List<Map<String, Object>> resultList = new ArrayList<>();
        // 通过真实数据源获取连接并创建预编译语句，保证执行目标库来自上层选择的数据源实体。
        try (
            Connection connection = query.getDataSource().getDataSource().getConnection();
            PreparedStatement preparedStatement = connection.prepareStatement(builtQuerySql.getSql())
        ) {
            // 先把列表 SQL 的参数按顺序绑定到预编译语句，确保 where 条件准确落地。
            bindParameters(preparedStatement, builtQuerySql.getParameters());
            // 执行查询并逐行读取结果，统一转换成字段名到值的映射结构。
            try (ResultSet resultSet = preparedStatement.executeQuery()) {
                // 获取结果集元数据，供每一行转换时按列顺序读取字段名和值。
                ResultSetMetaData metaData = resultSet.getMetaData();
                // 记录当前结果列数，避免每行转换时重复获取元数据长度。
                int columnCount = metaData.getColumnCount();
                // 逐行读取结果并转换成统一的有序映射结构，供上层直接消费。
                while (resultSet.next()) {
                    // 创建当前行的有序映射，保证字段顺序与查询列顺序保持一致。
                    Map<String, Object> rowMap = new LinkedHashMap<>();
                    // 逐列读取当前行的标签和值，并写入统一结果映射。
                    for (int columnIndex = 1; columnIndex <= columnCount; columnIndex++) {
                        // 优先读取列标签，兼容 select 列别名和原始列名两种返回方式。
                        rowMap.put(
                            metaData.getColumnLabel(columnIndex),
                            resultSet.getObject(columnIndex)
                        );
                    }
                    // 把当前行结果加入总结果集合，形成完整的列表输出。
                    resultList.add(rowMap);
                }
            }
        } catch (SQLException exception) {
            // 统一把 JDBC 执行异常收口成非法状态异常，避免调用方处理底层受检异常细节。
            throw new IllegalStateException("failed to execute select query", exception);
        }
        // 返回完整列表结果，供上层 DAO 继续映射成业务输出结构。
        return resultList;
    }

    /**
     * 绑定预编译参数。
     *
     * @param preparedStatement 预编译语句
     * @param parameters 参数列表
     */
    private void bindParameters(PreparedStatement preparedStatement,List<Object> parameters) {
        // 参数列表为空时不做任何绑定，兼容无 where 条件的查询场景。
        if (parameters == null || parameters.isEmpty()) {
            return;
        }
        // 逐个把参数按问号顺序绑定到预编译语句，确保 SQL 和参数位置保持一致。
        for (int index = 0; index < parameters.size(); index++) {
            try {
                // JDBC 参数索引从 1 开始，因此绑定时需要在循环索引基础上加一。
                preparedStatement.setObject(index + 1, parameters.get(index));
            } catch (SQLException exception) {
                // 某个参数绑定失败时统一中止，避免执行出与预期不一致的查询结果。
                throw new IllegalStateException("failed to bind query parameter", exception);
            }
        }
    }
}
