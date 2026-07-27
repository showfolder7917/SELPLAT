package com.sp.selplat.common.db.template;

import com.sp.selplat.common.db.template.model.CommonTemplateSave;
import com.sp.selplat.common.db.template.model.CommonTemplateUpdate;
import com.sp.selplat.common.util.CommonParam;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.StringJoiner;
import javax.sql.DataSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

// 公共模板 DAO 统一承接单条 MyBatis 模板和真实 JDBC 批处理，作为 BaseDaoImpl 唯一 SQL 写入入口。
@Repository
public class BaseTemplateDao {

    // baseTemplateMapper 只保存注解式单条 SQL，避免 Mapper 代理与批处理执行职责混在同一接口。
    private final BaseTemplateMapper baseTemplateMapper;
    // jdbcTemplate 复用当前应用真实数据源执行批量 SQL，并自动参与 Service 已建立的 Spring 事务。
    private final JdbcTemplate jdbcTemplate;

    /**
     * 使用同一数据源装配单条 Mapper 与批量 JDBC 模板。
     *
     * @param baseTemplateMapper 公共单条 SQL Mapper
     * @param dataSource 当前应用真实数据源
     */
    public BaseTemplateDao(BaseTemplateMapper baseTemplateMapper, DataSource dataSource) {
        // 保存 MyBatis Mapper，供单条查询和写入继续复用既有注解 SQL。
        this.baseTemplateMapper = baseTemplateMapper;
        // 从同一数据源创建可参与 Spring 事务的 JDBC 批处理入口。
        this.jdbcTemplate = new JdbcTemplate(dataSource);
    }

    // 单条主键查询继续委托 MyBatis 模板，保持现有动态字段查询行为不变。
    public Map<String, Object> selectByIds(
        String tableName,
        String selectColumns,
        Map<String, Object> idColumnValueMap
    ) {
        // 查询参数保持由 BaseDao 受控组装，内部 Mapper 只负责执行单条模板 SQL。
        return baseTemplateMapper.selectByIds(tableName, selectColumns, idColumnValueMap);
    }

    // 单条新增继续委托 MyBatis 模板，避免批量迁移改变既有单条 SQL。
    public int insert(CommonTemplateSave saveIn) {
        // 公共新增模板参数原样进入内部 Mapper。
        return baseTemplateMapper.insert(saveIn);
    }

    // 当前最多一千条新增记录使用固定列结构执行真实 JDBC batch。
    public int insertBatch(String tableName, List<CommonParam> saveItems) {
        // 空新增分组直接返回零，模板层不会生成没有数据的 INSERT。
        if (saveItems == null || saveItems.isEmpty()) {
            return 0;
        }
        // 第一条记录决定当前真实 JDBC batch 的固定列顺序。
        CommonParam firstItem = requireBatchItem(saveItems.get(0));
        // 使用有序列表保存第一条记录的字段顺序，保证 SQL 列与每行参数稳定对应。
        List<String> columnNames = new ArrayList<>(firstItem.getParamMap().keySet());
        // 没有任何新增字段时禁止生成空列 INSERT。
        if (columnNames.isEmpty()) {
            throw new IllegalArgumentException("batch insert columns must not be empty");
        }
        // 第一条记录的字段集合是当前分组全部记录必须遵守的结构。
        LinkedHashSet<String> expectedColumns = new LinkedHashSet<>(columnNames);
        // batchArguments 保存每条记录按固定列顺序展开的 JDBC 参数。
        List<Object[]> batchArguments = new ArrayList<>();
        // 逐项验证字段结构并构造当前行参数。
        for (CommonParam saveItem : saveItems) {
            // 当前记录必须有效，禁止 null 项进入真实批处理。
            CommonParam requiredItem = requireBatchItem(saveItem);
            // 同组字段集合不一致时立即失败，防止额外字段被忽略或缺失字段发生错列。
            if (!expectedColumns.equals(new LinkedHashSet<>(requiredItem.getParamMap().keySet()))) {
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

    // 单条更新继续委托 MyBatis 模板，保持现有复合主键更新行为不变。
    public int updateByIds(CommonTemplateUpdate updateIn) {
        // 公共更新模板参数原样进入内部 Mapper。
        return baseTemplateMapper.updateByIds(updateIn);
    }

    // 当前最多一千条更新记录按字段结构归组后执行真实 JDBC batch。
    public int updateBatchByIds(String tableName, List<String> idColumns, List<CommonParam> saveItems) {
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
            // 复制前端字段，避免分离主键时修改调用方原始参数。
            Map<String, Object> updateValues = new LinkedHashMap<>(requiredItem.getParamMap());
            // 每个主键字段只参与 WHERE，不得进入 SET。
            for (String idColumn : idColumns) {
                // 从待更新字段中移除当前主键列。
                updateValues.remove(idColumn);
            }
            // 没有任何待更新字段时禁止生成空 SET SQL。
            if (updateValues.isEmpty()) {
                throw new IllegalArgumentException("batch update columns must not be empty");
            }
            // 更新字段按名称排序形成稳定 SQL 结构键，兼容前端字段顺序不同的记录。
            List<String> updateColumns = new ArrayList<>(updateValues.keySet());
            // 排序后相同字段集合进入同一个真实 JDBC batch。
            Collections.sort(updateColumns);
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
                // 当前列名来自调用方动态字段并沿用既有模板 DAO 约定。
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

    // 物理删除模板继续委托内部 Mapper；BaseDao 当前不会公开调用该能力。
    public int deleteByIds(String tableName, Map<String, Object> idColumnValueMap) {
        // 删除条件保持由 DAO 内部主键元数据受控组装。
        return baseTemplateMapper.deleteByIds(tableName, idColumnValueMap);
    }

    // 批量项统一校验对象和字段映射，避免模板层收到空记录。
    private CommonParam requireBatchItem(CommonParam item) {
        // null 记录或 null 字段映射无法形成合法写入 SQL，因此必须提前失败。
        if (item == null || item.getParamMap() == null) {
            throw new IllegalArgumentException("batch item must not be null");
        }
        // 返回已验证的原始记录，保持前端字段来源不变。
        return item;
    }

    // 主键值按元数据顺序提取，保证复合主键与 WHERE 参数稳定对应。
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

    // JDBC 驱动逐条结果统一转换为当前批次影响行数。
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
