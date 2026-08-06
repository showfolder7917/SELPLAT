package com.sp.selplat.common.db.datasource;

import com.sp.selplat.common.db.datasource.dialect.DatabaseDialectFactory;
import com.sp.selplat.common.exception.CommonSystemException;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.Locale;
import javax.sql.DataSource;

/**
 * 通用数据源解析器负责把 Spring 注入的数据源转换成 common-db 可复用的数据源上下文实体。
 * 这里集中处理数据库类型识别、catalog/schema 读取和支持性校验，避免各 DAO 重复维护同一套解析逻辑。
 */
public class CommonDbSourceResolver {

    // DIALECT_FACTORY 复用 common-db 已有的数据库方言注册表，用来校验当前数据库类型是否已被通用层支持。
    private static final DatabaseDialectFactory DIALECT_FACTORY = new DatabaseDialectFactory();

    /**
     * 把真实数据源解析成通用数据源实体。
     *
     * @param dataSource Spring 注入的真实数据源，例如连接 H2 的 {@code JdbcDataSource}
     * @return 通用数据源实体，例如
     *     {@code {"sourceKey":"H2","databaseType":"H2","catalogName":"运行时随机UUID","schemaName":"PUBLIC"}}
     * @throws IllegalStateException 当数据源为空或数据库产品不受支持时抛出，例如
     *     {@code IllegalStateException("unsupported database product: SQLite")}
     * @throws CommonSystemException 当 JDBC 连接或元数据读取失败时抛出，例如
     *     {@code CommonSystemException("DATABASE_SOURCE_RESOLVE_FAILED", "数据库连接信息读取失败。", cause)}
     */
    public CommonDbSource resolve(DataSource dataSource) {
        // dataSource 为空时直接拒绝继续处理，避免后续字段读取在获取连接阶段才暴露问题。
        if (dataSource == null) {
            throw new IllegalStateException("dataSource must not be null");
        }
        // 创建通用数据源实体承接当前 DAO 的真实连接上下文，供 metadata / query 层统一复用。
        CommonDbSource commonDbSource = new CommonDbSource();
        // 记录真实数据源对象，保证后续元数据读取和查询执行都命中同一连接来源。
        commonDbSource.setDataSource(dataSource);
        try (Connection connection = dataSource.getConnection()) {
            // 读取当前连接的数据库产品名，作为数据库类型识别和排障时的基础输入。
            String databaseProductName = connection.getMetaData().getDatabaseProductName();
            // 把 JDBC 产品名转换成通用层的 DatabaseType，统一数据库类型识别口径。
            DatabaseType databaseType = resolveDatabaseType(databaseProductName);
            // 通过方言工厂校验当前数据库类型已被 common-db 支持，避免后续链路落到未支持库型。
            DIALECT_FACTORY.getDialect(databaseType);
            // 写入数据库类型，供 metadata / query / dialect 层后续按统一枚举继续处理。
            commonDbSource.setDatabaseType(databaseType);
            // 写入当前连接 catalog，保证多库场景下元数据读取可以命中正确目标库。
            commonDbSource.setCatalogName(connection.getCatalog());
            // 写入当前连接 schema，保证多 schema 场景下元数据读取可以命中正确对象。
            commonDbSource.setSchemaName(connection.getSchema());
            // 把数据库产品名作为 sourceKey 落入上下文，便于排障时快速识别当前连接类型。
            commonDbSource.setSourceKey(databaseProductName);
        } catch (SQLException exception) {
            // JDBC 技术故障 → 稳定系统编码和安全提示；原始 SQLException 只保留在 cause 链和服务端日志。
            throw new CommonSystemException(
                "DATABASE_SOURCE_RESOLVE_FAILED",
                "数据库连接信息读取失败。",
                exception
            );
        }
        // 返回已补齐上下文的通用数据源实体，供上层 DAO 和公共组件继续复用。
        return commonDbSource;
    }

    /**
     * 把 JDBC 产品名映射成 common-db 定义的数据库类型。
     *
     * @param databaseProductName JDBC 元数据返回的产品名，例如 {@code "PostgreSQL"}
     * @return 通用数据库类型，例如 {@link DatabaseType#POSTGRESQL}
     * @throws IllegalStateException 当产品名无法映射到受支持方言时抛出，例如
     *     {@code IllegalStateException("unsupported database product: SQLite")}
     */
    private DatabaseType resolveDatabaseType(String databaseProductName) {
        // 先把数据库产品名转成小写统一比较，避免不同驱动返回大小写差异影响识别结果。
        String normalizedProductName = defaultText(databaseProductName).toLowerCase(Locale.ROOT);
        // H2 产品名命中时映射到通用层 H2 枚举，兼容本地联调和测试场景。
        if (normalizedProductName.contains("h2")) {
            return DatabaseType.H2;
        }
        // MySQL 产品名命中时映射到通用层 MYSQL 枚举，供后续方言和元数据链路统一分发。
        if (normalizedProductName.contains("mysql")) {
            return DatabaseType.MYSQL;
        }
        // SQL Server 产品名命中时映射到通用层 SQLSERVER 枚举，兼容微软数据库驱动返回值。
        if (normalizedProductName.contains("sql server")) {
            return DatabaseType.SQLSERVER;
        }
        // Oracle 产品名命中时映射到通用层 ORACLE 枚举，供传统企业数据库场景统一复用。
        if (normalizedProductName.contains("oracle")) {
            return DatabaseType.ORACLE;
        }
        // PostgreSQL 产品名命中时映射到通用层 POSTGRESQL 枚举，兼容当前线上 PostgreSQL 场景。
        if (normalizedProductName.contains("postgresql")) {
            return DatabaseType.POSTGRESQL;
        }
        // 当前数据库产品不在通用层支持列表中时直接失败，避免后续行为不确定。
        throw new IllegalStateException("unsupported database product: " + databaseProductName);
    }

    /**
     * 把可能为空的文本统一转换成非空字符串。
     *
     * @param value 来自 JDBC 元数据的可空文本，例如 {@code "H2"}
     * @return 非空文本，例如输入 {@code "H2"} 返回 {@code "H2"}，输入 null 返回空串
     */
    private String defaultText(String value) {
        // 文本为空时回退空串，保证后续 contains 判断逻辑可以稳定执行。
        return value == null ? "" : value;
    }
}
