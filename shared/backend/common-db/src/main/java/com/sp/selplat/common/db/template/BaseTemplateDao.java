package com.sp.selplat.common.db.template;

import com.sp.selplat.common.db.metadata.model.ColumnMetadata;
import com.sp.selplat.common.db.template.model.CommonTemplateSave;
import com.sp.selplat.common.db.template.model.CommonTemplateUpdate;
import com.sp.selplat.common.util.CommonParam;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.StringJoiner;
import javax.sql.DataSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * 统一承接基础 DAO 的单条 MyBatis 模板调用与真实 JDBC 批处理。
 * 本类是 {@code BaseDaoImpl} 的 SQL 模板边界，不负责从前端决定表名、列名或主键结构。
 */
@Repository
public class BaseTemplateDao {

    // baseTemplateMapper 只保存注解式单条 SQL，避免 Mapper 代理与批处理执行职责混在同一接口。
    private final BaseTemplateMapper baseTemplateMapper;
    // jdbcTemplate 复用当前应用真实数据源执行批量 SQL，并自动参与 Service 已建立的 Spring 事务。
    private final JdbcTemplate jdbcTemplate;

    /**
     * 使用同一数据源装配单条 Mapper 与批量 JDBC 模板。
     *
     * @param baseTemplateMapper Spring 注入的公共单条 SQL Mapper，例如 MyBatis 生成的 {@code BaseTemplateMapper} 代理
     * @param dataSource 当前应用真实数据源，例如连接 H2 测试库或生产业务库的 {@code DataSource}
     * 执行结果示例：单条操作使用 Mapper，批量操作使用同一数据源创建的 {@code JdbcTemplate} 并参与同一事务。
     */
    public BaseTemplateDao(BaseTemplateMapper baseTemplateMapper, DataSource dataSource) {
        // 保存 MyBatis Mapper，供单条查询和写入继续复用既有注解 SQL。
        this.baseTemplateMapper = baseTemplateMapper;
        // 从同一数据源创建可参与 Spring 事务的 JDBC 批处理入口。
        this.jdbcTemplate = new JdbcTemplate(dataSource);
    }

    /**
     * 将受控表名、列名和完整主键委托给 MyBatis 模板查询。
     *
     * @param tableName DAO 解析出的物理表名，例如 {@code "UniauthUser"}
     * @param selectColumns 元数据生成的真实列清单，例如 {@code "id, loginName, status"}
     * @param idColumnValueMap DAO 组合的主键映射，例如 {@code {"id":1}}
     * @return 命中的真实记录，例如 {@code {"id":1,"loginName":"admin","status":1}}；未命中时返回 null
     */
    public Map<String, Object> selectByIds(
        String tableName,
        String selectColumns,
        Map<String, Object> idColumnValueMap
    ) {
        // 查询参数保持由 BaseDao 受控组装，内部 Mapper 只负责执行单条模板 SQL。
        return baseTemplateMapper.selectByIds(tableName, selectColumns, idColumnValueMap);
    }

    /**
     * 将一条受控新增参数委托给 MyBatis 模板写入。
     *
     * @param saveIn DAO 组装的新增参数，例如
     *     {@code {"tableName":"UniauthUser","columnValueMap":{"id":1,"loginName":"admin"}}}
     * @return 数据库影响行数，例如成功新增一条返回 {@code 1}
     */
    public int insert(CommonTemplateSave saveIn) {
        // 公共新增模板参数原样进入内部 Mapper。
        return baseTemplateMapper.insert(saveIn);
    }

    /**
     * 对当前最多一千条且字段结构一致的记录执行真实 JDBC 批量新增。
     *
     * @param tableName DAO 解析出的物理表名，例如 {@code "UniauthUser"}
     * @param dbColumnsMap 数据库真实字段元数据，例如
     *     {@code {"id":{"columnName":"id","dataType":"BIGINT","primaryKey":true},}
     *     {@code "loginName":{"columnName":"loginName","dataType":"VARCHAR","primaryKey":false}}}
     * @param saveItems BaseDao 当前分组的新增参数，例如 {@code [{"id":1,"loginName":"admin"},{"id":2,"loginName":"auditor"}]}
     * @return 当前分组累计影响行数，例如两条均成功返回 {@code 2}；空分组返回 {@code 0}
     * @throws IllegalArgumentException 当批量项为空、字段未知或同组字段结构不一致时抛出，例如
     *     {@code IllegalArgumentException("batch insert column structure mismatch")}
     */
    public int insertBatch(
        String tableName,
        Map<String, ColumnMetadata> dbColumnsMap,
        List<CommonParam> saveItems
    ) {
        // 空新增分组直接返回零，模板层不会生成没有数据的 INSERT。
        if (saveItems == null || saveItems.isEmpty()) {
            return 0;
        }
        // 第一条记录决定当前真实 JDBC batch 实际提供的固定列结构。
        CommonParam firstItem = requireBatchItem(saveItems.get(0));
        // 按数据库真实字段顺序匹配第一条记录，SQL 标识符不读取前端 Map 的字段顺序。
        List<String> columnNames = resolveMatchedColumnNames(dbColumnsMap, firstItem);
        // 没有任何新增字段时禁止生成空列 INSERT。
        if (columnNames.isEmpty()) {
            throw new IllegalArgumentException("batch insert columns must not be empty");
        }
        // 第一条记录的字段集合是当前分组全部记录必须遵守的结构。
        List<String> expectedColumns = List.copyOf(columnNames);
        // batchArguments 保存每条记录按固定列顺序展开的 JDBC 参数。
        List<Object[]> batchArguments = new ArrayList<>();
        // 逐项验证字段结构并构造当前行参数。
        for (CommonParam saveItem : saveItems) {
            // 当前记录必须有效，禁止 null 项进入真实批处理。
            CommonParam requiredItem = requireBatchItem(saveItem);
            // 当前记录同样按数据库真实字段匹配，未知字段会在形成 SQL 前直接失败。
            List<String> matchedColumns = resolveMatchedColumnNames(dbColumnsMap, requiredItem);
            // 同组实际提供字段不一致时立即失败，防止缺失字段发生错列。
            if (!expectedColumns.equals(matchedColumns)) {
                throw new IllegalArgumentException("batch insert column structure mismatch");
            }
            // 当前行按第一条记录的列顺序读取全部写入值。
            Object[] rowValues = new Object[columnNames.size()];
            // 每个新增列值写入对应 JDBC 参数位置。
            for (int columnIndex = 0; columnIndex < columnNames.size(); columnIndex++) {
                // 通过稳定列名取值，不依赖当前 Map 自身的迭代顺序。
                rowValues[columnIndex] = requiredItem.getParam(columnNames.get(columnIndex));
            }
            // 当前行参数加入同一条 SQL 的 JDBC 批处理集合。
            batchArguments.add(rowValues);
        }
        // 新增列名按固定顺序拼入当前模板 SQL。
        String columns = String.join(", ", columnNames);
        // 每个新增列生成一个参数占位符，所有记录复用同一结构。
        String placeholders = String.join(", ", Collections.nCopies(columnNames.size(), "?"));
        // 当前分组全部记录共享同一条 INSERT SQL。
        String sql = "INSERT INTO " + tableName + " (" + columns + ") VALUES (" + placeholders + ")";
        // 模板层一次提交当前分组，并把驱动结果转换为真实影响行数。
        return sumBatchCounts(jdbcTemplate.batchUpdate(sql, batchArguments));
    }

    /**
     * 将一条受控更新参数委托给 MyBatis 模板写入。
     *
     * @param updateIn DAO 组装的更新参数，例如
     *     {@code {"tableName":"UniauthUser","idColumns":["id"],"idValues":[1],}
     *     {@code "columnValueMap":{"displayName":"管理员"}}}
     * @return 数据库影响行数，例如成功更新一条返回 {@code 1}
     */
    public int updateByIds(CommonTemplateUpdate updateIn) {
        // 公共更新模板参数原样进入内部 Mapper。
        return baseTemplateMapper.updateByIds(updateIn);
    }

    /**
     * 对当前最多一千条记录按更新字段结构分组执行真实 JDBC 批量更新。
     *
     * @param tableName DAO 解析出的物理表名，例如 {@code "UniauthUser"}
     * @param idColumns 数据库元数据返回的主键列，例如 {@code ["tenantId","orderId"]}
     * @param dbColumnsMap 数据库真实字段元数据，例如
     *     {@code {"tenantId":{"columnName":"tenantId","primaryKey":true},}
     *     {@code "displayName":{"columnName":"displayName","primaryKey":false}}}
     * @param saveItems BaseDao 当前分组的更新参数，例如
     *     {@code [{"tenantId":10,"orderId":20,"status":0},{"tenantId":10,"orderId":21,"status":0}]}
     * @return 当前分组累计影响行数，例如两条均成功返回 {@code 2}；空分组返回 {@code 0}
     * @throws IllegalArgumentException 当主键、更新列或数据库字段元数据不完整时抛出，例如
     *     {@code IllegalArgumentException("batch update columns must not be empty")}
     */
    public int updateBatchByIds(
        String tableName,
        List<String> idColumns,
        Map<String, ColumnMetadata> dbColumnsMap,
        List<CommonParam> saveItems
    ) {
        // 空更新分组直接返回零，模板层不会生成没有数据的 UPDATE。
        if (saveItems == null || saveItems.isEmpty()) {
            return 0;
        }
        // 没有主键元数据时禁止执行动态更新，避免生成无 WHERE 的批量 SQL。
        if (idColumns == null || idColumns.isEmpty()) {
            throw new IllegalArgumentException("batch update id columns must not be empty");
        }
        // groupedArguments 按排序后的更新字段集合保存对应 JDBC 行参数。
        Map<List<String>, List<Object[]>> groupedArguments = new LinkedHashMap<>();
        // 逐项分离主键和更新列，再归入相同 SQL 结构。
        for (CommonParam saveItem : saveItems) {
            // 当前记录必须有效，禁止 null 项进入真实批量更新。
            CommonParam requiredItem = requireBatchItem(saveItem);
            // 按主键元数据读取完整主键值，缺少任一值都会在 SQL 执行前失败。
            List<Object> idValues = resolveIdValues(idColumns, requiredItem);
            // 按数据库真实字段顺序匹配当前记录，未知前端字段在生成 SQL 前阻断。
            List<String> matchedColumns = resolveMatchedColumnNames(dbColumnsMap, requiredItem);
            // 使用有序映射保存当前实际提供的非主键更新值。
            Map<String, Object> updateValues = new LinkedHashMap<>();
            // 逐个处理已匹配字段，主键只用于 WHERE，其余字段进入 SET。
            for (String matchedColumn : matchedColumns) {
                // 主键字段不进入更新值映射。
                if (idColumns.contains(matchedColumn)) {
                    continue;
                }
                // 当前更新值按真实字段名从 CommonParam 读取。
                updateValues.put(matchedColumn, requiredItem.getParam(matchedColumn));
            }
            // 没有任何待更新字段时禁止生成空 SET SQL。
            if (updateValues.isEmpty()) {
                throw new IllegalArgumentException("batch update columns must not be empty");
            }
            // 更新字段沿用数据库元数据顺序形成稳定 SQL 结构键。
            List<String> updateColumns = new ArrayList<>(updateValues.keySet());
            // 当前行参数依次保存 SET 值和 WHERE 主键值。
            List<Object> rowValues = new ArrayList<>();
            // 按稳定更新列顺序追加每个 SET 参数。
            for (String updateColumn : updateColumns) {
                // 当前更新值进入对应字段的参数位置。
                rowValues.add(updateValues.get(updateColumn));
            }
            // 主键值按元数据顺序追加到 WHERE 参数位置。
            rowValues.addAll(idValues);
            // 当前记录归入相同更新字段结构的批处理集合。
            groupedArguments.computeIfAbsent(List.copyOf(updateColumns), key -> new ArrayList<>()).add(rowValues.toArray());
        }
        // affectedRows 汇总当前最多一千条分组内所有 SQL 结构的结果。
        int affectedRows = 0;
        // 每种更新字段结构分别构造固定 SQL 并执行一次 JDBC batch。
        for (Map.Entry<List<String>, List<Object[]>> groupEntry : groupedArguments.entrySet()) {
            // setClause 按当前字段结构生成全部赋值占位符。
            StringJoiner setClause = new StringJoiner(", ");
            // 每个更新字段形成一个受控 SET 表达式。
            for (String updateColumn : groupEntry.getKey()) {
                // 当前列名来自数据库真实字段映射，不接受前端字段直接成为 SQL 标识符。
                setClause.add(updateColumn + " = ?");
            }
            // whereClause 使用全部主键字段，兼容单主键和复合主键更新。
            StringJoiner whereClause = new StringJoiner(" AND ");
            // 每个主键字段形成一个等值占位条件。
            for (String idColumn : idColumns) {
                // 主键列名来源于 DAO 读取的数据库元数据。
                whereClause.add(idColumn + " = ?");
            }
            // 当前字段结构的全部记录复用同一条 UPDATE SQL。
            String sql = "UPDATE " + tableName + " SET " + setClause + " WHERE " + whereClause;
            // 模板层执行当前结构的真实 JDBC batch 并累计影响行数。
            affectedRows += sumBatchCounts(jdbcTemplate.batchUpdate(sql, groupEntry.getValue()));
        }
        // 返回当前最多一千条分组的累计更新行数。
        return affectedRows;
    }

    /**
     * 按受控完整主键调用模板物理删除；当前公共 {@code BaseDao} 不公开此能力。
     *
     * @param tableName DAO 解析出的物理表名，例如 {@code "UniauthUser"}
     * @param idColumnValueMap DAO 组合的主键映射，例如 {@code {"id":1}}
     * @return 数据库影响行数，例如删除一条返回 {@code 1}
     */
    public int deleteByIds(String tableName, Map<String, Object> idColumnValueMap) {
        // 删除条件保持由 DAO 内部主键元数据受控组装。
        return baseTemplateMapper.deleteByIds(tableName, idColumnValueMap);
    }

    /**
     * 校验一条批量参数可以形成受控写入。
     *
     * @param item 来自 BaseDao 当前分组的单条参数，例如 {@code {"id":1,"loginName":"admin"}}
     * @return 原参数对象，例如 {@code {"id":1,"loginName":"admin"}}
     * @throws IllegalArgumentException 当对象或内部字段映射为空时抛出，例如
     *     {@code IllegalArgumentException("batch item must not be null")}
     */
    private CommonParam requireBatchItem(CommonParam item) {
        // null 记录或 null 字段映射无法形成合法写入 SQL，因此必须提前失败。
        if (item == null || item.getParamMap() == null) {
            throw new IllegalArgumentException("batch item must not be null");
        }
        // 返回已验证的原始记录，保持前端字段来源不变。
        return item;
    }

    /**
     * 按数据库真实字段顺序匹配当前批量项并阻断未知字段。
     *
     * @param dbColumnsMap 当前表真实字段元数据，例如 {@code {"id":ColumnMetadata,"loginName":ColumnMetadata}}
     * @param item 来自前端的单条写入参数，例如 {@code {"loginName":"admin","id":1}}
     * @return 按数据库顺序排列的已匹配字段，例如 {@code ["id","loginName"]}
     * @throws IllegalArgumentException 当元数据为空或前端包含未知字段时抛出，例如
     *     {@code IllegalArgumentException("unknown write column: debugFlag")}
     */
    private List<String> resolveMatchedColumnNames(
        Map<String, ColumnMetadata> dbColumnsMap,
        CommonParam item
    ) {
        // 数据库字段映射为空时无法形成受控 SQL 标识符。
        if (dbColumnsMap == null || dbColumnsMap.isEmpty()) {
            throw new IllegalArgumentException("database columns must not be empty");
        }
        // 前端出现数据库不存在的字段时立即阻断，禁止模板层忽略或直接拼接该字段。
        for (String inputColumnName : item.getParamMap().keySet()) {
            // null 字段名和未知字段都不是当前表的真实字段。
            if (inputColumnName == null || !dbColumnsMap.containsKey(inputColumnName)) {
                throw new IllegalArgumentException("unknown write column: " + inputColumnName);
            }
        }
        // 使用数据库字段顺序保存当前记录实际提供的字段。
        List<String> matchedColumns = new ArrayList<>();
        // 逐项检查当前 CommonParam 是否显式提供真实字段。
        for (String dbColumnName : dbColumnsMap.keySet()) {
            // 未提供字段不进入 SQL，使数据库默认值或现有值继续生效。
            if (!item.getParamMap().containsKey(dbColumnName)) {
                continue;
            }
            // 已提供的真实字段加入当前 SQL 结构。
            matchedColumns.add(dbColumnName);
        }
        // 返回仅含数据库真实字段的有序列表。
        return matchedColumns;
    }

    /**
     * 按主键元数据顺序提取当前批量项的完整主键值。
     *
     * @param idColumns 当前表真实主键列，例如 {@code ["tenantId","orderId"]}
     * @param item 来自前端的完整主键参数，例如 {@code {"tenantId":10,"orderId":20,"status":0}}
     * @return 与主键列一一对应的值，例如 {@code [10,20]}
     * @throws IllegalArgumentException 当任一主键值缺失时抛出，例如
     *     {@code IllegalArgumentException("primary key value must not be null: orderId")}
     */
    private List<Object> resolveIdValues(List<String> idColumns, CommonParam item) {
        // 使用有序列表保存与主键元数据一一对应的值。
        List<Object> idValues = new ArrayList<>();
        // 逐项读取全部单主键或复合主键字段。
        for (String idColumn : idColumns) {
            // 当前主键值直接来自同一个前端 CommonParam。
            Object idValue = item.getParam(idColumn);
            // 缺少任一主键值时禁止执行不完整条件更新。
            if (idValue == null) {
                throw new IllegalArgumentException("primary key value must not be null: " + idColumn);
            }
            // 当前主键值按元数据顺序进入 WHERE 参数。
            idValues.add(idValue);
        }
        // 返回完整主键值列表。
        return idValues;
    }

    /**
     * 将 JDBC 驱动逐项返回值换算为当前批次累计影响行数。
     *
     * @param batchCounts JDBC 驱动返回的逐项结果，例如 {@code [1,1,-2]}，其中 -2 表示成功但行数未知
     * @return 累计影响行数，例如 {@code [1,1,-2]} 返回 {@code 3}
     * @throws IllegalStateException 当任一项为 {@link Statement#EXECUTE_FAILED} 时抛出，例如
     *     {@code IllegalStateException("JDBC batch item execution failed")}
     */
    private int sumBatchCounts(int[] batchCounts) {
        // affectedRows 从零开始累计驱动报告的每条执行结果。
        int affectedRows = 0;
        // 逐项识别成功、未知成功和明确失败状态。
        for (int batchCount : batchCounts) {
            // 驱动明确报告失败时立即抛错，交由 Service 事务回滚全部千条分组。
            if (batchCount == Statement.EXECUTE_FAILED) {
                throw new IllegalStateException("JDBC batch item execution failed");
            }
            // SUCCESS_NO_INFO 表示成功但没有精确行数，按当前一条语句成功影响一行累计。
            affectedRows += batchCount == Statement.SUCCESS_NO_INFO ? 1 : Math.max(batchCount, 0);
        }
        // 返回当前真实 JDBC batch 的累计影响行数。
        return affectedRows;
    }
}
