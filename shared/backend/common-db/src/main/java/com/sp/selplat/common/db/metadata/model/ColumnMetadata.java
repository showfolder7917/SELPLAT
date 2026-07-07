package com.sp.selplat.common.db.metadata.model;

/**
 * 字段元数据对象统一承接数据库列结构信息。
 * 这里保留字段名、类型、长度、精度、主键和备注，
 * 是为了给字段合法性校验、开发期元数据扫描和固定查询定义生成提供统一模型。
 */
public class ColumnMetadata {

    // tableName 记录当前字段所属物理表，便于上层按表组织字段元数据。
    private String tableName;
    // columnName 记录当前字段名，供字段白名单校验和 SQL 生成使用。
    private String columnName;
    // dataType 记录数据库原始字段类型，供方言层或生成器做类型判断。
    private String dataType;
    // javaType 记录字段推荐映射的 Java 类型，供开发期生成代码或查询定义参考。
    private String javaType;
    // length 记录字段长度，供校验或生成器做辅助判断。
    private Integer length;
    // scale 记录数字字段精度，供金额、比例等字段处理使用。
    private Integer scale;
    // primaryKey 标记当前字段是否是主键，供更新和排序默认规则参考。
    private Boolean primaryKey;
    // remarks 记录数据库字段注释，供生成器和文档输出使用。
    private String remarks;

    /**
     * 获取表名。
     *
     * @return 表名
     */
    public String getTableName() {
        return tableName;
    }

    /**
     * 设置表名。
     *
     * @param tableName 表名
     */
    public void setTableName(String tableName) {
        this.tableName = tableName;
    }

    /**
     * 获取字段名。
     *
     * @return 字段名
     */
    public String getColumnName() {
        return columnName;
    }

    /**
     * 设置字段名。
     *
     * @param columnName 字段名
     */
    public void setColumnName(String columnName) {
        this.columnName = columnName;
    }

    /**
     * 获取数据库字段类型。
     *
     * @return 数据库字段类型
     */
    public String getDataType() {
        return dataType;
    }

    /**
     * 设置数据库字段类型。
     *
     * @param dataType 数据库字段类型
     */
    public void setDataType(String dataType) {
        this.dataType = dataType;
    }

    /**
     * 获取 Java 类型。
     *
     * @return Java 类型
     */
    public String getJavaType() {
        return javaType;
    }

    /**
     * 设置 Java 类型。
     *
     * @param javaType Java 类型
     */
    public void setJavaType(String javaType) {
        this.javaType = javaType;
    }

    /**
     * 获取字段长度。
     *
     * @return 字段长度
     */
    public Integer getLength() {
        return length;
    }

    /**
     * 设置字段长度。
     *
     * @param length 字段长度
     */
    public void setLength(Integer length) {
        this.length = length;
    }

    /**
     * 获取字段精度。
     *
     * @return 字段精度
     */
    public Integer getScale() {
        return scale;
    }

    /**
     * 设置字段精度。
     *
     * @param scale 字段精度
     */
    public void setScale(Integer scale) {
        this.scale = scale;
    }

    /**
     * 获取主键标记。
     *
     * @return 主键标记
     */
    public Boolean getPrimaryKey() {
        return primaryKey;
    }

    /**
     * 设置主键标记。
     *
     * @param primaryKey 主键标记
     */
    public void setPrimaryKey(Boolean primaryKey) {
        this.primaryKey = primaryKey;
    }

    /**
     * 获取字段备注。
     *
     * @return 字段备注
     */
    public String getRemarks() {
        return remarks;
    }

    /**
     * 设置字段备注。
     *
     * @param remarks 字段备注
     */
    public void setRemarks(String remarks) {
        this.remarks = remarks;
    }
}

