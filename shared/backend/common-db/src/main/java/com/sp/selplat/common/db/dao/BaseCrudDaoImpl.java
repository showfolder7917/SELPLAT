package com.sp.selplat.common.db.dao;

import com.sp.selplat.common.util.CommonParam;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.StringJoiner;
import org.springframework.jdbc.core.JdbcTemplate;

// 基础 CRUD 支撑层只保留 BaseDaoImpl 复用的主键查询和参数校验辅助能力，不再公开 BaseDao 同名方法。
public abstract class BaseCrudDaoImpl extends BasePagingQueryDaoImpl {

    // 受保护的主键查询从同一个前端 CommonParam 提取当前表全部主键，统一支持单主键和复合主键。
    protected Map<String, Object> getByIds(CommonParam queryIn) {
        // 先读取当前 DAO 的主键字段列表，明确当前详情查询 where 条件使用哪些主键列。
        List<String> idColumns = getIds();
        // 从前端通用参数按元数据顺序解析全部主键值，缺少任一复合主键字段都会在执行 SQL 前失败。
        List<Object> idValues = resolveIdValues(idColumns, queryIn);
        // 通过模板 DAO 按 DAO 内部组装出的主键列值映射查询当前表的一条记录，供详情回显或测试验证复用。
        return baseTemplateDao.selectByIds(getTableName(), getselectColumns(), buildIdColumnValueMap(idColumns, idValues));
    }

    // 当前批次的全部主键条件合并成一条 SQL 查询，避免逐项调用单条 select。
    protected List<Map<String, Object>> getByIdsBatchGroup(List<CommonParam> queryItems) {
        // 空分组直接返回空记录，避免构造没有 where 条件的查询。
        if (queryItems == null || queryItems.isEmpty()) {
            return List.of();
        }
        // 主键字段统一从当前真实表元数据读取，兼容单主键和复合主键。
        List<String> idColumns = getIds();
        // 单条记录的主键条件固定使用 AND 连接全部主键字段。
        StringJoiner itemCondition = new StringJoiner(" AND ", "(", ")");
        // 每个主键字段只使用参数占位符，字段名来源于受控数据库元数据。
        for (String idColumn : idColumns) {
            // 当前主键字段进入本项 where 条件。
            itemCondition.add(idColumn + " = ?");
        }
        // conditions 按当前批次记录数复制主键条件，并使用 OR 连接不同记录。
        String conditions = String.join(" OR ", Collections.nCopies(queryItems.size(), itemCondition.toString()));
        // arguments 按“记录顺序 → 主键元数据顺序”展开，确保每个占位符和值稳定对应。
        List<Object> arguments = new ArrayList<>();
        // 逐项解析完整主键，缺少任一复合主键字段都会在执行 SQL 前失败。
        for (CommonParam queryItem : queryItems) {
            // 当前记录的全部主键值追加到批量查询参数。
            arguments.addAll(resolveIdValues(idColumns, queryItem));
        }
        // 批量查询只选择当前表真实字段，并命中当前分组全部主键组合。
        String sql = "SELECT " + getselectColumns() + " FROM " + getTableName() + " WHERE " + conditions;
        // 使用同一 DataSource 的 JdbcTemplate 一次读取当前分组，返回真实数据库记录列表。
        return new JdbcTemplate(dataSource).queryForList(sql, arguments.toArray());
    }

    // 当前新增分组使用一条固定 SQL 和 JDBC batchUpdate 落库，禁止循环调用公开单条新增。
    protected int insertBatchGroup(List<CommonParam> saveItems) {
        // 空新增分组直接返回零影响行。
        if (saveItems == null || saveItems.isEmpty()) {
            return 0;
        }
        // 第一条记录决定当前分组的固定新增列顺序。
        CommonParam firstItem = requireBatchItem(saveItems.get(0));
        // 使用有序列集合保持前端字段顺序，便于 SQL 与每行参数一一对应。
        List<String> columnNames = new ArrayList<>(firstItem.getParamMap().keySet());
        // 没有任何新增字段时禁止生成空列 insert。
        if (columnNames.isEmpty()) {
            throw new IllegalArgumentException("batch insert columns must not be empty");
        }
        // 第一条记录的字段集合是当前分组全部记录必须遵守的结构。
        LinkedHashSet<String> expectedColumns = new LinkedHashSet<>(columnNames);
        // batchArguments 保存每条记录按固定列顺序展开的 JDBC 参数。
        List<Object[]> batchArguments = new ArrayList<>();
        // 逐项验证字段结构并构造当前行参数。
        for (CommonParam saveItem : saveItems) {
            // 当前记录必须是有效 CommonParam，禁止 null 项进入批处理。
            CommonParam requiredItem = requireBatchItem(saveItem);
            // 同组字段集合不一致时立即失败，避免额外字段被静默忽略或缺失字段错列。
            if (!expectedColumns.equals(new LinkedHashSet<>(requiredItem.getParamMap().keySet()))) {
                throw new IllegalArgumentException("batch insert column structure mismatch");
            }
            // 当前行按第一条记录的列顺序读取值。
            Object[] rowValues = new Object[columnNames.size()];
            // 每个新增列值写入对应 JDBC 参数位置。
            for (int columnIndex = 0; columnIndex < columnNames.size(); columnIndex++) {
                // 通过稳定列名读取当前行值，不依赖各行 Map 自身迭代顺序。
                rowValues[columnIndex] = requiredItem.getParam(columnNames.get(columnIndex));
            }
            // 当前行参数加入 JDBC 批处理集合。
            batchArguments.add(rowValues);
        }
        // 新增列名使用固定顺序拼入受控通用 SQL。
        String columns = String.join(", ", columnNames);
        // 每个新增列对应一个参数占位符。
        String placeholders = String.join(", ", Collections.nCopies(columnNames.size(), "?"));
        // 当前分组全部记录复用同一条 INSERT SQL。
        String sql = "INSERT INTO " + getTableName() + " (" + columns + ") VALUES (" + placeholders + ")";
        // JDBC batchUpdate 一次提交当前分组并返回每条语句的影响结果。
        int[] batchCounts = new JdbcTemplate(dataSource).batchUpdate(sql, batchArguments);
        // 把驱动返回的逐条结果转换成当前分组总影响行数。
        return sumBatchCounts(batchCounts);
    }

    // 当前更新分组按更新字段结构归并 SQL，再对每种结构执行一次 JDBC batchUpdate。
    protected int updateBatchGroup(List<CommonParam> saveItems) {
        // 空更新分组直接返回零影响行。
        if (saveItems == null || saveItems.isEmpty()) {
            return 0;
        }
        // 主键字段从当前表元数据读取，所有更新结构共享同一主键条件。
        List<String> idColumns = getIds();
        // groupedArguments 按排序后的更新字段集合保存对应 JDBC 行参数。
        Map<List<String>, List<Object[]>> groupedArguments = new LinkedHashMap<>();
        // 逐项分离主键和更新列，再归入相同 SQL 结构。
        for (CommonParam saveItem : saveItems) {
            // 当前记录必须有效，禁止 null 项进入批量更新。
            CommonParam requiredItem = requireBatchItem(saveItem);
            // 先按主键元数据读取并验证完整主键值。
            List<Object> idValues = resolveIdValues(idColumns, requiredItem);
            // 复制前端字段，避免分离主键时修改调用方原始对象。
            Map<String, Object> updateValues = new LinkedHashMap<>(requiredItem.getParamMap());
            // 每个主键字段只参与 where，不得进入 set。
            for (String idColumn : idColumns) {
                // 从更新值中移除当前主键字段。
                updateValues.remove(idColumn);
            }
            // 没有任何待更新字段时禁止生成空 set SQL。
            if (updateValues.isEmpty()) {
                throw new IllegalArgumentException("batch update columns must not be empty");
            }
            // 更新字段按名称排序形成稳定 SQL 结构键，兼容不同前端字段顺序。
            List<String> updateColumns = new ArrayList<>(updateValues.keySet());
            // 排序后相同字段集合会进入同一个真实 JDBC batch。
            Collections.sort(updateColumns);
            // 当前行参数依次保存 set 值和 where 主键值。
            List<Object> rowValues = new ArrayList<>();
            // 按稳定更新列顺序追加 set 参数。
            for (String updateColumn : updateColumns) {
                // 当前更新字段值进入对应占位符。
                rowValues.add(updateValues.get(updateColumn));
            }
            // 主键值按元数据顺序追加到 where 参数。
            rowValues.addAll(idValues);
            // 当前行归入相同更新字段结构的 JDBC 批处理集合。
            groupedArguments.computeIfAbsent(List.copyOf(updateColumns), key -> new ArrayList<>()).add(rowValues.toArray());
        }
        // affectedRows 汇总当前一千条分组内所有 SQL 结构的影响行数。
        int affectedRows = 0;
        // 每种更新字段结构分别构造固定 SQL 并执行一次 JDBC batchUpdate。
        for (Map.Entry<List<String>, List<Object[]>> groupEntry : groupedArguments.entrySet()) {
            // setClause 按当前结构生成全部字段赋值占位符。
            StringJoiner setClause = new StringJoiner(", ");
            // 每个更新字段形成一个受控 set 表达式。
            for (String updateColumn : groupEntry.getKey()) {
                // 当前列名来自前端映射并沿用现有 BaseDao 动态列约定。
                setClause.add(updateColumn + " = ?");
            }
            // whereClause 使用全部主键字段，兼容复合主键批量更新。
            StringJoiner whereClause = new StringJoiner(" AND ");
            // 每个主键字段形成一个等值占位条件。
            for (String idColumn : idColumns) {
                // 主键列名来源于数据库元数据。
                whereClause.add(idColumn + " = ?");
            }
            // 当前字段结构的所有记录复用同一条 UPDATE SQL。
            String sql = "UPDATE " + getTableName() + " SET " + setClause + " WHERE " + whereClause;
            // 执行当前字段结构的真实 JDBC 批处理并累计结果。
            affectedRows += sumBatchCounts(new JdbcTemplate(dataSource).batchUpdate(sql, groupEntry.getValue()));
        }
        // 返回当前最多一千条分组的累计影响行数。
        return affectedRows;
    }

    // 批量项统一校验对象和字段映射，避免底层 JDBC 收到空记录。
    private CommonParam requireBatchItem(CommonParam item) {
        // null 项无法确定主键或写入字段，因此在数据库动作前立即失败。
        if (item == null || item.getParamMap() == null) {
            throw new IllegalArgumentException("batch item must not be null");
        }
        // 返回已验证的原始参数对象，保持前端字段来源可追踪。
        return item;
    }

    // JDBC 批处理结果统一转换成业务可用的累计影响行数。
    private int sumBatchCounts(int[] batchCounts) {
        // affectedRows 从零开始累计驱动返回的每条结果。
        int affectedRows = 0;
        // 逐项识别成功、未知成功和执行失败状态。
        for (int batchCount : batchCounts) {
            // 驱动明确报告执行失败时立即终止，交由 Service 事务回滚全部分组。
            if (batchCount == Statement.EXECUTE_FAILED) {
                throw new IllegalStateException("JDBC batch item execution failed");
            }
            // SUCCESS_NO_INFO 表示成功但无精确行数，按当前一条语句成功影响一行计数。
            affectedRows += batchCount == Statement.SUCCESS_NO_INFO ? 1 : Math.max(batchCount, 0);
        }
        // 返回当前 JDBC batch 的累计影响行数。
        return affectedRows;
    }

    // 主键值统一从 CommonParam 按元数据顺序提取，保证前端字段名和值直接形成稳定配对。
    protected List<Object> resolveIdValues(List<String> idColumns, CommonParam queryIn) {
        // 通用参数为空时立即失败，避免模板 SQL 生成无主键条件的查询语句。
        if (queryIn == null || queryIn.getParamMap() == null) {
            throw new IllegalArgumentException("queryIn must not be null");
        }
        // 使用有序列表保存每个主键字段对应的前端值，顺序与数据库主键元数据保持一致。
        List<Object> idValues = new ArrayList<>();
        // 逐项读取单主键或复合主键字段，禁止缺失字段进入真实查询。
        for (String idColumn : idColumns) {
            // 当前字段值直接从前端 CommonParam 中读取，不要求 Service 再组装主键列表。
            Object idValue = queryIn.getParam(idColumn);
            // 复合主键任一字段缺失都会造成查询目标不完整，因此必须在 SQL 前终止。
            if (idValue == null) {
                throw new IllegalArgumentException("primary key value must not be null: " + idColumn);
            }
            // 按元数据顺序保存当前字段值，供模板查询构造完整复合主键条件。
            idValues.add(idValue);
        }
        // 返回已完整提取的主键值列表，供后续与主键字段顺序一一配对。
        return idValues;
    }

    // 主键列值映射统一由 DAO 内部按主键列顺序和外部传入主键值列表组装，避免外部感知字段名。
    private Map<String, Object> buildIdColumnValueMap(List<String> idColumns, List<Object> idValues) {
        // 使用有序映射按主键字段顺序组装字段和值，供模板 SQL 稳定拼接复合主键 where 条件。
        Map<String, Object> idColumnValueMap = new LinkedHashMap<>();
        // 逐个把主键字段和对应值配对写入映射，保证模板层无需再感知主键字段来源。
        for (int index = 0; index < idColumns.size(); index++) {
            // 按统一顺序写入当前主键字段及对应值，保证复合主键条件不会错位。
            idColumnValueMap.put(idColumns.get(index), idValues.get(index));
        }
        // 返回经过校验的主键列值映射，供模板 SQL 逐列拼接 where 条件。
        return idColumnValueMap;
    }
}
