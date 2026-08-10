package com.sp.selplat.mda.targetdatabase.common.jdbc;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import org.springframework.stereotype.Component;

/**
 * 集中维护五类数据库的驱动类名、默认端口与 JDBC URL 规则。
 */
@Component
public class JdbcDriverRegistry {

    // SELPLAT 工程根用于把连接配置中的 apps 相对路径稳定映射到正式数据库，而不受 Host 启动目录影响。
    private final Path selplatProjectRoot;

    /**
     * 使用当前 Java 进程目录向上识别 SELPLAT 工程根。
     *
     * <p>真实传参示例：Host 从 {@code apps/host/backend} 启动时读取
     * {@code user.dir=/workspace/SELPLAT/apps/host/backend}。
     *
     * <p>真实返回示例：构造完成后，{@code file:./apps/reference-data/db/reference-data} 会解析为
     * {@code file:/workspace/SELPLAT/apps/reference-data/db/reference-data}。
     *
     * <p>异常或副作用示例：当前目录不属于 SELPLAT 时抛出
     * {@code IllegalStateException("无法定位 SELPLAT 工程根")}; 构造过程不创建目录或数据库文件。
     */
    public JdbcDriverRegistry() {
        this(Path.of(System.getProperty("user.dir")));
    }

    /**
     * 从指定目录向上识别 SELPLAT 工程根，供隔离测试验证子目录启动场景。
     *
     * <p>真实传参示例：{@code /tmp/SELPLAT/apps/host/backend}。
     *
     * <p>真实返回示例：构造完成后内部工程根为 {@code /tmp/SELPLAT}。
     *
     * <p>异常或副作用示例：父级不存在 {@code settings.gradle} 与 {@code apps} 时抛出
     * {@code IllegalStateException}; 不修改传入目录。
     *
     * @param startPath MDA 所在 Java 进程的当前目录或其测试替代目录
     */
    JdbcDriverRegistry(Path startPath) {
        this.selplatProjectRoot = locateSelplatProjectRoot(startPath);
    }

    /**
     * 解析配置并生成可直接连接的驱动信息。
     *
     * @param definition Service 组装的连接配置，例如
     *     {@code {"databaseType":"POSTGRESQL","host":"127.0.0.1","port":5432,"databaseName":"demo"}}
     * @return 驱动类名和最终 URL，例如
     *     {@code {"driverClass":"org.postgresql.Driver","jdbcUrl":"jdbc:postgresql://127.0.0.1:5432/demo"}}
     * @throws IllegalArgumentException 当数据库类型不受支持或必填字段为空时抛出，例如
     *     {@code IllegalArgumentException("不支持的数据库类型：SQLITE")}
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
        // file:./apps/... 是 SELPLAT 工程坐标 → 先锚定工程根，避免 Host 子目录下误建同名空库。
        String resolvedName = resolveSelplatH2FileName(name);
        String base = resolvedName.startsWith("jdbc:h2:") ? resolvedName : "jdbc:h2:" + resolvedName;
        return base + semicolon(parameters);
    }

    private String resolveSelplatH2FileName(String databaseName) {
        String jdbcPrefix = databaseName.startsWith("jdbc:h2:") ? "jdbc:h2:" : "";
        String h2Name = jdbcPrefix.isEmpty() ? databaseName : databaseName.substring(jdbcPrefix.length());
        String projectPrefix = "file:./apps/";
        if (!h2Name.startsWith(projectPrefix)) {
            // 内存库、绝对路径和非 SELPLAT 相对路径 → 保持调用方原始连接语义。
            return databaseName;
        }
        Path resolvedPath = selplatProjectRoot.resolve(h2Name.substring("file:./".length())).normalize();
        if (!resolvedPath.startsWith(selplatProjectRoot)) {
            // 规范化结果逃出工程根 → 阻止连接到未授权文件位置。
            throw new IllegalArgumentException("SELPLAT H2 工程路径不能逃出工程根：" + databaseName);
        }
        // 工程坐标 → H2 可跨启动目录识别的绝对 file 路径。
        return jdbcPrefix + "file:" + resolvedPath.toString().replace('\\', '/');
    }

    private Path locateSelplatProjectRoot(Path startPath) {
        Path currentPath = startPath.toAbsolutePath().normalize();
        while (currentPath != null) {
            // 构建入口和 apps 目录同时存在 → 当前父级是唯一 SELPLAT 工程根。
            if (Files.isRegularFile(currentPath.resolve("settings.gradle"))
                    && Files.isDirectory(currentPath.resolve("apps"))) {
                return currentPath;
            }
            currentPath = currentPath.getParent();
        }
        // 无工程根时禁止退回进程目录，避免重新制造位置不明的 H2 文件。
        throw new IllegalStateException("无法定位 SELPLAT 工程根：" + startPath);
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
     * 保存一次驱动解析得到的类名和可直接连接 URL。
     *
     * @param driverClass JDBC 驱动类，例如 {@code org.postgresql.Driver}
     * @param jdbcUrl 最终 JDBC URL，例如 {@code jdbc:postgresql://127.0.0.1:5432/demo}
     */
    public record JdbcTarget(String driverClass, String jdbcUrl) {
    }
}
