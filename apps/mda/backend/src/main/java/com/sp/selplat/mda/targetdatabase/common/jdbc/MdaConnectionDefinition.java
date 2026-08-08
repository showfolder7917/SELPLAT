package com.sp.selplat.mda.targetdatabase.common.jdbc;

/**
 * 动态 JDBC 连接所需的不可变配置，不携带连接配置表的审计字段。
 *
 * @param databaseType 数据库类型，例如 {@code H2}
 * @param host 主机，例如 {@code 127.0.0.1}
 * @param port 端口，例如 {@code 5432}
 * @param databaseName 数据库名、H2 路径或 Oracle service name
 * @param schemaName 默认 schema，可空
 * @param username 用户名
 * @param password 控制库保存并用于建立目标连接的明文口令
 * @param customJdbcUrl 可选完整 JDBC URL
 * @param jdbcParameters URL 附加参数
 * @param defaultAutoCommit 默认自动提交开关
 */
public record MdaConnectionDefinition(
        String databaseType,
        String host,
        Integer port,
        String databaseName,
        String schemaName,
        String username,
        String password,
        String customJdbcUrl,
        String jdbcParameters,
        boolean defaultAutoCommit) {
}
