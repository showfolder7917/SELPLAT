package com.sp.selplat.common.db.domain;

// 注解式模板模糊查询入参统一承接动态表名、返回列和单字段 like 条件。
public class CommonTemplateLikeQuery {

    // tableName 指定当前模糊查询要命中的物理表。
    private String tableName;
    // selectColumns 指定当前模糊查询要返回的列清单。
    private String selectColumns;
    // fieldName 指定本次要执行 like 的业务字段。
    private String fieldName;
    // fieldValue 承接本次要做模糊匹配的关键字。
    private String fieldValue;
    // orderBy 承接模糊查询结果的排序表达式。
    private String orderBy;

    // 获取目标表名，供模板 SQL 拼接 from 子句。
    public String getTableName() {
        return tableName;
    }

    // 设置目标表名，供上层指定当前模糊查询作用的物理表。
    public void setTableName(String tableName) {
        this.tableName = tableName;
    }

    // 获取返回列清单，供模板 SQL 拼接 select 子句。
    public String getSelectColumns() {
        return selectColumns;
    }

    // 设置返回列清单，供上层控制模糊查询返回字段。
    public void setSelectColumns(String selectColumns) {
        this.selectColumns = selectColumns;
    }

    // 获取目标字段名，供模板 SQL 拼接 like 条件的列名。
    public String getFieldName() {
        return fieldName;
    }

    // 设置目标字段名，供上层明确要在哪个业务字段上做模糊检索。
    public void setFieldName(String fieldName) {
        this.fieldName = fieldName;
    }

    // 获取模糊查询关键字，供模板 SQL 传给 like 条件。
    public String getFieldValue() {
        return fieldValue;
    }

    // 设置模糊查询关键字，供上层提交用户输入的检索词。
    public void setFieldValue(String fieldValue) {
        this.fieldValue = fieldValue;
    }

    // 获取排序表达式，供模板 SQL 在需要时追加 order by。
    public String getOrderBy() {
        return orderBy;
    }

    // 设置排序表达式，供上层明确结果输出顺序。
    public void setOrderBy(String orderBy) {
        this.orderBy = orderBy;
    }
}
