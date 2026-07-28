package com.sp.selplat.common.db.template.model;

import java.util.Map;

/**
 * 承接模板新增语句所需的受控表名与真实列值映射。
 * 对象只在 DAO 与模板层之间传递，不接收前端直接指定的表名或列名。
 */
public class CommonTemplateSave {

    // tableName 指定当前新增要写入的物理表。
    private String tableName;
    // columnValueMap 承接列名和待写入值的映射，供模板 SQL 动态展开 insert 语句。
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
     * 执行结果示例：模板新增语句使用 {@code INSERT INTO UniauthUser}。
     */
    public void setTableName(String tableName) {
        this.tableName = tableName;
    }

    /**
     * 返回与数据库真实字段匹配后的新增列值。
     *
     * @return 有序列值映射，例如 {@code {"id":1,"loginName":"admin","status":1}}
     */
    public Map<String, Object> getColumnValueMap() {
        return columnValueMap;
    }

    /**
     * 设置 DAO 按真实数据库字段筛选后的新增列值。
     *
     * @param columnValueMap 来自 DAO 字段匹配结果的有序映射，例如
     *     {@code {"id":1,"loginName":"admin","status":1}}
     * 执行结果示例：模板新增语句按 {@code id, loginName, status} 顺序绑定对应值。
     */
    public void setColumnValueMap(Map<String, Object> columnValueMap) {
        this.columnValueMap = columnValueMap;
    }
}
