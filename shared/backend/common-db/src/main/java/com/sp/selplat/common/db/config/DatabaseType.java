package com.sp.selplat.common.db.config;

/**
 * 数据库类型枚举统一标识当前查询要命中的数据库产品类型。
 * 这里收口类型枚举，是为了让上层 DAO 在传入数据源实体时显式声明数据库方言，
 * 便于后续分页、like、元数据读取等差异逻辑统一按类型分发。
 */
public enum DatabaseType {

    // H2 主要用于本地最小运行、联调和轻量测试场景。
    H2,
    // MYSQL 用于兼容常规业务库和历史系统迁移场景。
    MYSQL,
    // SQLSERVER 用于兼容微软数据库生态下的业务系统。
    SQLSERVER,
    // ORACLE 用于兼容传统企业数据库场景。
    ORACLE,
    // POSTGRESQL 用于兼容 PostgreSQL 及其生态数据库实现。
    POSTGRESQL
}
