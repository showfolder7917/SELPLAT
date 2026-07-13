package com.sp.selplat.common.db.template.model;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

// 注解式模板更新入参统一承接目标表、主键字段列表、主键值列表和待覆盖列值集合。
public class CommonTemplateUpdate {

    // tableName 指定当前更新要命中的物理表。
    private String tableName;
    // idColumns 承接当前更新 where 子句使用的主键字段列表，字段名由 DAO 内部自动解析生成。
    private List<String> idColumns;
    // idValues 承接当前更新 where 子句使用的主键值列表，顺序需与主键字段列表一一对应。
    private List<Object> idValues;
    // columnValueMap 承接需要被覆盖的列和值集合。
    private Map<String, Object> columnValueMap;

    // 获取目标表名，供模板 SQL 拼接 update 子句。
    public String getTableName() {
        return tableName;
    }

    // 设置目标表名，供上层明确本次更新作用的业务表。
    public void setTableName(String tableName) {
        this.tableName = tableName;
    }

    // 获取主键字段列表，供模板入参在内部组装主键条件映射时对齐字段顺序。
    public List<String> getIdColumns() {
        return idColumns;
    }

    // 设置主键字段列表，供 DAO 内部把自动解析出的主键名称显式写入更新入参对象。
    public void setIdColumns(List<String> idColumns) {
        this.idColumns = idColumns;
    }

    // 获取主键值列表，供模板入参在内部组装主键条件映射时对齐值顺序。
    public List<Object> getIdValues() {
        return idValues;
    }

    // 设置主键值列表，供 DAO 内部把外部传入的主键值显式写入更新入参对象。
    public void setIdValues(List<Object> idValues) {
        this.idValues = idValues;
    }

    // 获取主键列值映射，供模板 SQL 逐个拼接 where 条件。
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

    // 获取待更新列值集合，供模板 SQL 动态展开 set 子句。
    public Map<String, Object> getColumnValueMap() {
        return columnValueMap;
    }

    // 设置待更新列值集合，供服务层把允许覆盖的业务字段统一提交给模板 DAO。
    public void setColumnValueMap(Map<String, Object> columnValueMap) {
        this.columnValueMap = columnValueMap;
    }
}

