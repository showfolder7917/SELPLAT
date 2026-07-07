package com.sp.selplat.common.db.metadata.model;

/**
 * 表元数据对象统一承接数据库表结构的概要信息。
 * 这里保留表名和备注，是为了让元数据读取器、字段扫描器和开发期生成器共享统一模型。
 */
public class TableMetadata {

    // tableName 记录物理表名，供上层按表选择查询定义或生成配置。
    private String tableName;
    // remarks 记录数据库表备注，供开发辅助界面或生成器输出说明文本。
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
     * 获取表备注。
     *
     * @return 表备注
     */
    public String getRemarks() {
        return remarks;
    }

    /**
     * 设置表备注。
     *
     * @param remarks 表备注
     */
    public void setRemarks(String remarks) {
        this.remarks = remarks;
    }
}

