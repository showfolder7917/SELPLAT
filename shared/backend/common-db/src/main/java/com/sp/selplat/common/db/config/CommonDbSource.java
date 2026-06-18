package com.sp.selplat.common.db.config;

import javax.sql.DataSource;

/**
 * 通用数据源实体统一承接上层 DAO 传入的数据库连接上下文。
 * 这里不让底层自己猜当前用哪套数据库，而是要求上层显式传入数据源实体，
 * 这样底层可以同时知道数据源对象、数据库类型以及连接目标库信息。
 */
public class CommonDbSource {

    // sourceKey 记录当前数据源在工程配置中的逻辑标识，便于日志、排障和多数据源区分。
    private String sourceKey;
    // databaseType 明确当前数据源命中的数据库产品类型，供底层选择对应 SQL 方言。
    private DatabaseType databaseType;
    // dataSource 承接工程配置中已经装配好的真实数据源对象，供底层直接获取连接。
    private DataSource dataSource;
    // catalogName 记录当前连接目标库或 catalog，便于后续元数据读取和跨库区分。
    private String catalogName;
    // schemaName 记录当前连接默认 schema，便于后续元数据查询和对象定位。
    private String schemaName;

    /**
     * 获取数据源逻辑标识。
     *
     * @return 数据源逻辑标识
     */
    public String getSourceKey() {
        return sourceKey;
    }

    /**
     * 设置数据源逻辑标识。
     *
     * @param sourceKey 数据源逻辑标识
     */
    public void setSourceKey(String sourceKey) {
        this.sourceKey = sourceKey;
    }

    /**
     * 获取数据库类型。
     *
     * @return 数据库类型
     */
    public DatabaseType getDatabaseType() {
        return databaseType;
    }

    /**
     * 设置数据库类型。
     *
     * @param databaseType 数据库类型
     */
    public void setDatabaseType(DatabaseType databaseType) {
        this.databaseType = databaseType;
    }

    /**
     * 获取真实数据源对象。
     *
     * @return 真实数据源对象
     */
    public DataSource getDataSource() {
        return dataSource;
    }

    /**
     * 设置真实数据源对象。
     *
     * @param dataSource 真实数据源对象
     */
    public void setDataSource(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    /**
     * 获取 catalog 名称。
     *
     * @return catalog 名称
     */
    public String getCatalogName() {
        return catalogName;
    }

    /**
     * 设置 catalog 名称。
     *
     * @param catalogName catalog 名称
     */
    public void setCatalogName(String catalogName) {
        this.catalogName = catalogName;
    }

    /**
     * 获取 schema 名称。
     *
     * @return schema 名称
     */
    public String getSchemaName() {
        return schemaName;
    }

    /**
     * 设置 schema 名称。
     *
     * @param schemaName schema 名称
     */
    public void setSchemaName(String schemaName) {
        this.schemaName = schemaName;
    }
}
