package com.sp.selplat.common.db.domain;

import java.util.Map;

/**
 * 承接模板等值查询所需的受控表名、列清单、条件和排序。
 * 所有标识符均由 DAO 或元数据链路提供，不接受前端未经匹配的字段。
 */
public class CommonTemplateQuery {

    // tableName 指定当前查询要命中的物理表。
    private String tableName;
    // selectColumns 指定当前查询要返回的列清单，例如 id,name。
    private String selectColumns;
    // queryColumnValueMap 承接字段和值的等值匹配集合。
    private Map<String, Object> queryColumnValueMap;
    // orderBy 承接上层明确指定的排序表达式。
    private String orderBy;

    /**
     * 返回等值查询要访问的物理表名。
     *
     * @return DAO 解析出的物理表名，例如 {@code "UniauthUser"}
     */
    public String getTableName() {
        return tableName;
    }

    /**
     * 设置等值查询要访问的物理表名。
     *
     * @param tableName 来自 DAO 类名约定的物理表名，例如 {@code "UniauthUser"}
     * 执行结果示例：模板 FROM 子句使用 {@code UniauthUser}。
     */
    public void setTableName(String tableName) {
        this.tableName = tableName;
    }

    /**
     * 返回等值查询允许读取的真实列清单。
     *
     * @return 元数据生成的列清单，例如 {@code "id, loginName, status"}
     */
    public String getSelectColumns() {
        return selectColumns;
    }

    /**
     * 设置等值查询允许读取的真实列清单。
     *
     * @param selectColumns 来自数据库真实字段映射的列清单，例如 {@code "id, loginName, status"}
     * 执行结果示例：模板 SELECT 子句只读取 id、loginName 和 status。
     */
    public void setSelectColumns(String selectColumns) {
        this.selectColumns = selectColumns;
    }

    /**
     * 返回已经过真实字段匹配的等值条件。
     *
     * @return 受控等值条件，例如 {@code {"loginName":"admin","status":1}}
     */
    public Map<String, Object> getQueryColumnValueMap() {
        return queryColumnValueMap;
    }

    /**
     * 设置已经过真实字段匹配的等值条件。
     *
     * @param queryColumnValueMap 来自 DAO 真实字段匹配的条件，例如 {@code {"loginName":"admin","status":1}}
     * 执行结果示例：模板 WHERE 子句参数化匹配 loginName 和 status。
     */
    public void setQueryColumnValueMap(Map<String, Object> queryColumnValueMap) {
        this.queryColumnValueMap = queryColumnValueMap;
    }

    /**
     * 返回等值查询使用的受控排序表达式。
     *
     * @return 后端生成的排序表达式，例如 {@code "sortnum desc id asc"}
     */
    public String getOrderBy() {
        return orderBy;
    }

    /**
     * 设置等值查询使用的受控排序表达式。
     *
     * @param orderBy 来自后端受控字段的排序表达式，例如 {@code "sortnum desc id asc"}
     * 执行结果示例：查询先按 sortnum 降序、再按 id 升序。
     */
    public void setOrderBy(String orderBy) {
        this.orderBy = orderBy;
    }
}
