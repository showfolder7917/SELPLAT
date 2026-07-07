package com.sp.selplat.common.db.template.model;

import java.util.Map;

// 注解式模板更新入参统一承接目标表、主键字段、主键值和待覆盖列值集合。
public class CommonTemplateUpdate {

    // tableName 指定当前更新要命中的物理表。
    private String tableName;
    // idColumn 指定当前更新 where 子句使用的主键字段。
    private String idColumn;
    // idValue 承接当前更新命中的主键值。
    private Object idValue;
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

    // 获取主键字段名，供模板 SQL 拼接 where 条件。
    public String getIdColumn() {
        return idColumn;
    }

    // 设置主键字段名，供上层明确本次更新按哪个唯一字段定位数据。
    public void setIdColumn(String idColumn) {
        this.idColumn = idColumn;
    }

    // 获取主键值，供模板 SQL 传递 where 条件参数。
    public Object getIdValue() {
        return idValue;
    }

    // 设置主键值，供上层指定当前要更新哪一行数据。
    public void setIdValue(Object idValue) {
        this.idValue = idValue;
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

