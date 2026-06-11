package com.sp.selplat.common.db.domain;

import java.util.Map;

// 注解式模板查询入参统一承接动态表名、查询列和等值条件集合。
public class CommonTemplateQuery {

    // tableName 指定当前查询要命中的物理表。
    private String tableName;
    // selectColumns 指定当前查询要返回的列清单，例如 id,name。
    private String selectColumns;
    // queryColumnValueMap 承接字段和值的等值匹配集合。
    private Map<String, Object> queryColumnValueMap;
    // orderBy 承接上层明确指定的排序表达式。
    private String orderBy;

    // 获取目标表名，供模板 SQL 直接拼接 from 子句。
    public String getTableName() {
        return tableName;
    }

    // 设置目标表名，供上层在进入模板 DAO 前明确当前业务表。
    public void setTableName(String tableName) {
        this.tableName = tableName;
    }

    // 获取查询列清单，供模板 SQL 拼接 select 子句。
    public String getSelectColumns() {
        return selectColumns;
    }

    // 设置查询列清单，供上层明确本次只读取哪些业务字段。
    public void setSelectColumns(String selectColumns) {
        this.selectColumns = selectColumns;
    }

    // 获取等值查询字段和值集合，供模板 SQL 动态展开 where 条件。
    public Map<String, Object> getQueryColumnValueMap() {
        return queryColumnValueMap;
    }

    // 设置等值查询字段和值集合，供服务层把筛选条件统一交给模板 DAO。
    public void setQueryColumnValueMap(Map<String, Object> queryColumnValueMap) {
        this.queryColumnValueMap = queryColumnValueMap;
    }

    // 获取排序表达式，供模板 SQL 在需要时追加 order by。
    public String getOrderBy() {
        return orderBy;
    }

    // 设置排序表达式，供上层控制结果顺序。
    public void setOrderBy(String orderBy) {
        this.orderBy = orderBy;
    }
}
