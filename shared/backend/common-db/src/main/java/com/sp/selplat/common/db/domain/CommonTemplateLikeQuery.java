package com.sp.selplat.common.db.domain;

/**
 * 承接模板单字段模糊查询所需的受控表名、列清单、条件和排序。
 * 所有 SQL 标识符由后端生成，本对象只在 DAO 与模板层之间传递。
 */
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

    /** @return DAO 解析出的物理表名，例如 {@code "UniauthUser"} */
    public String getTableName() {
        return tableName;
    }

    /**
     * @param tableName 来自 DAO 类名约定的物理表名，例如 {@code "UniauthUser"}
     * 执行结果示例：模板 FROM 子句使用 {@code UniauthUser}。
     */
    public void setTableName(String tableName) {
        this.tableName = tableName;
    }

    /** @return 元数据生成的列清单，例如 {@code "id, loginName, status"} */
    public String getSelectColumns() {
        return selectColumns;
    }

    /**
     * @param selectColumns 来自数据库真实字段映射的列清单，例如 {@code "id, loginName, status"}
     * 执行结果示例：模板 SELECT 子句只读取 id、loginName 和 status。
     */
    public void setSelectColumns(String selectColumns) {
        this.selectColumns = selectColumns;
    }

    /** @return 后端白名单确认的模糊查询字段，例如 {@code "loginName"} */
    public String getFieldName() {
        return fieldName;
    }

    /**
     * @param fieldName 来自后端白名单的业务字段，例如 {@code "loginName"}
     * 执行结果示例：模板在 loginName 真实列上执行 LIKE 条件。
     */
    public void setFieldName(String fieldName) {
        this.fieldName = fieldName;
    }

    /** @return 来自前端的模糊查询关键字，例如 {@code "admin"} */
    public String getFieldValue() {
        return fieldValue;
    }

    /**
     * @param fieldValue 来自前端检索框的关键字，例如 {@code "admin"}
     * 执行结果示例：模板把 admin 作为参数绑定到 LIKE 条件。
     */
    public void setFieldValue(String fieldValue) {
        this.fieldValue = fieldValue;
    }

    /** @return 后端生成的排序表达式，例如 {@code "sortnum desc id asc"} */
    public String getOrderBy() {
        return orderBy;
    }

    /**
     * @param orderBy 来自后端受控字段的排序表达式，例如 {@code "sortnum desc id asc"}
     * 执行结果示例：结果先按 sortnum 降序、再按 id 升序。
     */
    public void setOrderBy(String orderBy) {
        this.orderBy = orderBy;
    }
}
