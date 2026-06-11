package com.sp.selplat.common.db.domain;

import java.util.Map;

// 注解式模板新增入参统一承接目标表和待写入列值集合。
public class CommonTemplateSaveIn {

    // tableName 指定当前新增要写入的物理表。
    private String tableName;
    // columnValueMap 承接列名和待写入值的映射，供模板 SQL 动态展开 insert 语句。
    private Map<String, Object> columnValueMap;

    // 获取目标表名，供模板 SQL 拼接 insert into 子句。
    public String getTableName() {
        return tableName;
    }

    // 设置目标表名，供上层明确当前新增落到哪张业务表。
    public void setTableName(String tableName) {
        this.tableName = tableName;
    }

    // 获取待写入列值集合，供模板 SQL 展开列清单和值清单。
    public Map<String, Object> getColumnValueMap() {
        return columnValueMap;
    }

    // 设置待写入列值集合，供服务层把整理后的业务字段统一提交给模板 DAO。
    public void setColumnValueMap(Map<String, Object> columnValueMap) {
        this.columnValueMap = columnValueMap;
    }
}
