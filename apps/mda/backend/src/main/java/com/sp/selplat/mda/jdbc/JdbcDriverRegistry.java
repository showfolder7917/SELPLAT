package com.sp.selplat.mda.jdbc;

import java.util.Locale;
import org.springframework.stereotype.Component;

/**
 * 集中维护五类数据库的驱动类名、默认端口与 JDBC URL 规则。
 */
@Component
public class JdbcDriverRegistry {

    /**
     * 解析配置并生成可直接连接的驱动信息。
     *
     * @param definition 连接配置，例如 H2 内存库
     * @return 驱动类名和 JDBC URL
     */
    public JdbcTarget resolve(MdaConnectionDefinition definition) {
        String type = required(definition.databaseType(), "databaseType").toUpperCase(Locale.ROOT);
        if (hasText(definition.customJdbcUrl())) {
            return new JdbcTarget(driverClass(type), definition.customJdbcUrl().trim());
        }
        String parameters = definition.jdbcParameters() == null ? "" : definition.jdbcParameters().trim();
        return switch (type) {
            case "H2" -> new JdbcTarget("org.h2.Driver", h2Url(definition.databaseName(), parameters));
            case "MYSQL" -> new JdbcTarget("com.mysql.cj.jdbc.Driver",
                    "jdbc:mysql://" + host(definition) + ":" + port(definition, 3306) + "/"
                            + required(definition.databaseName(), "databaseName") + query(parameters));
            case "SQLSERVER" -> new JdbcTarget("com.microsoft.sqlserver.jdbc.SQLServerDriver",
                    "jdbc:sqlserver://" + host(definition) + ":" + port(definition, 1433)
                            + ";databaseName=" + required(definition.databaseName(), "databaseName") + semicolon(parameters));
            case "ORACLE" -> new JdbcTarget("oracle.jdbc.OracleDriver",
                    "jdbc:oracle:thin:@//" + host(definition) + ":" + port(definition, 1521) + "/"
                            + required(definition.databaseName(), "databaseName") + query(parameters));
            case "POSTGRESQL" -> new JdbcTarget("org.postgresql.Driver",
                    "jdbc:postgresql://" + host(definition) + ":" + port(definition, 5432) + "/"
                            + required(definition.databaseName(), "databaseName") + query(parameters));
            default -> throw new IllegalArgumentException("不支持的数据库类型：" + type);
        };
    }

    private String driverClass(String type) {
        return switch (type) {
            case "H2" -> "org.h2.Driver";
            case "MYSQL" -> "com.mysql.cj.jdbc.Driver";
            case "SQLSERVER" -> "com.microsoft.sqlserver.jdbc.SQLServerDriver";
            case "ORACLE" -> "oracle.jdbc.OracleDriver";
            case "POSTGRESQL" -> "org.postgresql.Driver";
            default -> throw new IllegalArgumentException("不支持的数据库类型：" + type);
        };
    }

    private String h2Url(String databaseName, String parameters) {
        String name = required(databaseName, "databaseName");
        String base = name.startsWith("jdbc:h2:") ? name : "jdbc:h2:" + name;
        return base + semicolon(parameters);
    }

    private String host(MdaConnectionDefinition definition) {
        return required(definition.host(), "host");
    }

    private int port(MdaConnectionDefinition definition, int defaultPort) {
        return definition.port() == null || definition.port() <= 0 ? defaultPort : definition.port();
    }

    private String query(String parameters) {
        return parameters.isEmpty() ? "" : "?" + parameters.replaceFirst("^[?&]+", "");
    }

    private String semicolon(String parameters) {
        return parameters.isEmpty() ? "" : ";" + parameters.replaceFirst("^[;]+", "");
    }

    private String required(String value, String field) {
        if (!hasText(value)) {
            throw new IllegalArgumentException("连接字段 " + field + " 不能为空。");
        }
        return value.trim();
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    /**
     * @param driverClass JDBC 驱动类
     * @param jdbcUrl 最终 JDBC URL
     */
    public record JdbcTarget(String driverClass, String jdbcUrl) {
    }
}
