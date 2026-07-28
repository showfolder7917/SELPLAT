package com.sp.selplat.common.db.dao;

import com.sp.selplat.common.util.CommonParam;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.StringJoiner;
import org.springframework.jdbc.core.JdbcTemplate;

// 基础 CRUD 支撑层只保留 BaseDaoImpl 复用的主键查询和参数辅助能力，不承载模板层批量写入实现。
public abstract class BaseCrudDaoImpl extends BasePagingQueryDaoImpl {

    // 受保护的主键查询从同一个前端 CommonParam 提取当前表全部主键，统一支持单主键和复合主键。
    protected Map<String, Object> getByIds(CommonParam queryIn) {
        // 先读取当前 DAO 的主键字段列表，明确当前详情查询 WHERE 条件使用哪些主键列。
        List<String> idColumns = getPrimaryKeyColumnNameList();
        // 从前端通用参数按元数据顺序解析全部主键值，缺少任一复合主键字段都会在执行 SQL 前失败。
        List<Object> idValues = resolveIdValues(idColumns, queryIn);
        // 通过模板 DAO 按 DAO 内部组装出的主键列值映射查询当前表的一条记录。
        return baseTemplateDao.selectByIds(getTableName(), getselectColumns(), buildIdColumnValueMap(idColumns, idValues));
    }

    // 当前批次的全部主键条件合并成一条 SQL 查询，避免逐项调用单条 select。
    protected List<Map<String, Object>> getByIdsBatchGroup(List<CommonParam> queryItems) {
        // 空分组直接返回空记录，避免构造没有 WHERE 条件的查询。
        if (queryItems == null || queryItems.isEmpty()) {
            return List.of();
        }
        // 主键字段统一从当前真实表元数据读取，兼容单主键和复合主键。
        List<String> idColumns = getPrimaryKeyColumnNameList();
        // 单条记录的主键条件固定使用 AND 连接全部主键字段。
        StringJoiner itemCondition = new StringJoiner(" AND ", "(", ")");
        // 每个主键字段只使用参数占位符，字段名来源于受控数据库元数据。
        for (String idColumn : idColumns) {
            // 当前主键字段进入本项 WHERE 条件。
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
        // 使用同一数据源的 JdbcTemplate 一次读取当前分组，返回真实数据库记录列表。
        return new JdbcTemplate(dataSource).queryForList(sql, arguments.toArray());
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
        // 使用有序映射按主键字段顺序组装字段和值，供模板 SQL 稳定拼接复合主键 WHERE 条件。
        Map<String, Object> idColumnValueMap = new LinkedHashMap<>();
        // 逐个把主键字段和对应值配对写入映射，保证模板层无需再感知主键字段来源。
        for (int index = 0; index < idColumns.size(); index++) {
            // 按统一顺序写入当前主键字段及对应值，保证复合主键条件不会错位。
            idColumnValueMap.put(idColumns.get(index), idValues.get(index));
        }
        // 返回经过校验的主键列值映射，供模板 SQL 逐列拼接 WHERE 条件。
        return idColumnValueMap;
    }
}
