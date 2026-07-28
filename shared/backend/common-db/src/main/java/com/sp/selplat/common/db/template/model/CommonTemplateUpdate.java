package com.sp.selplat.common.db.template.model;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 承接模板更新语句所需的受控表名、完整主键和真实更新列值。
 * 对象只组合 DAO 已验证的数据，不允许前端直接决定物理表名或 SQL 字段。
 */
public class CommonTemplateUpdate {

    // tableName 指定当前更新要命中的物理表。
    private String tableName;
    // idColumns 承接当前更新 where 子句使用的主键字段列表，字段名由 DAO 内部自动解析生成。
    private List<String> idColumns;
    // idValues 承接当前更新 where 子句使用的主键值列表，顺序需与主键字段列表一一对应。
    private List<Object> idValues;
    // columnValueMap 承接需要被覆盖的列和值集合。
    private Map<String, Object> columnValueMap;

    /**
     * 返回 DAO 根据实现类解析出的目标表名。
     *
     * @return 物理表名，例如 {@code "UniauthUser"}
     */
    public String getTableName() {
        return tableName;
    }

    /**
     * 设置 DAO 内部解析出的目标表名。
     *
     * @param tableName 来自 DAO 类名约定的物理表名，例如 {@code "UniauthUser"}
     * 执行结果示例：模板更新语句使用 {@code UPDATE UniauthUser}。
     */
    public void setTableName(String tableName) {
        this.tableName = tableName;
    }

    /**
     * 返回当前表真实主键字段。
     *
     * @return 单主键例如 {@code ["id"]}；复合主键例如 {@code ["tenantId","orderId"]}
     */
    public List<String> getIdColumns() {
        return idColumns;
    }

    /**
     * 设置数据库元数据返回的有序主键字段。
     *
     * @param idColumns 来自元数据读取器的主键列，例如 {@code ["tenantId","orderId"]}
     * 执行结果示例：后续主键映射按 tenantId、orderId 顺序组装。
     */
    public void setIdColumns(List<String> idColumns) {
        this.idColumns = idColumns;
    }

    /**
     * 返回与主键字段顺序一一对应的值。
     *
     * @return 主键值，例如 {@code [10,20]}
     */
    public List<Object> getIdValues() {
        return idValues;
    }

    /**
     * 设置 DAO 从通用参数提取的有序主键值。
     *
     * @param idValues 来自前端完整主键参数的值，例如 {@code [10,20]}
     * 执行结果示例：值分别对应 {@code tenantId=10, orderId=20}。
     */
    public void setIdValues(List<Object> idValues) {
        this.idValues = idValues;
    }

    /**
     * 将主键字段与同位置值组合成模板 WHERE 条件映射。
     *
     * @return 复合主键映射例如 {@code {"tenantId":10,"orderId":20}}；
     *     主键字段或值为空时返回 {@code {}}
     */
    public Map<String, Object> getIdColumnValueMap() {
        // 主键字段或主键值任一为空时返回空映射，交由上层或模板执行链路统一判定缺参问题。
        if (idColumns == null || idValues == null || idColumns.isEmpty() || idValues.isEmpty()) {
            return new LinkedHashMap<>();
        }
        // 使用有序映射按主键字段顺序组装 where 条件，保证复合主键条件顺序稳定可读。
        Map<String, Object> idColumnValueMap = new LinkedHashMap<>();
        // 逐个把主键字段和对应主键值写入映射，供模板 SQL 统一按字段名和值展开 where 子句。
        for (int index = 0; index < idColumns.size() && index < idValues.size(); index++) {
            idColumnValueMap.put(idColumns.get(index), idValues.get(index));
        }
        return idColumnValueMap;
    }

    /**
     * 返回与数据库真实字段匹配后的更新列值。
     *
     * @return 有序列值映射，例如 {@code {"displayName":"管理员","status":1}}
     */
    public Map<String, Object> getColumnValueMap() {
        return columnValueMap;
    }

    /**
     * 设置 DAO 按真实数据库字段筛选后的更新列值。
     *
     * @param columnValueMap 来自 DAO 字段匹配结果的有序映射，例如
     *     {@code {"displayName":"管理员","status":1}}
     * 执行结果示例：模板 SET 子句只更新 displayName 和 status。
     */
    public void setColumnValueMap(Map<String, Object> columnValueMap) {
        this.columnValueMap = columnValueMap;
    }
}
