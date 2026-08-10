package com.sp.selplat.mda.common.util.jdbc;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/**
 * 五种驱动 URL 规则使用纯单元测试锁定，不依赖未投放的厂商 JDBC JAR。
 */
class JdbcDriverRegistryTest {

    private final JdbcDriverRegistry registry = new JdbcDriverRegistry();

    @TempDir
    Path temporaryDirectory;

    @Test
    void shouldBuildAllSupportedJdbcUrls() {
        assertTarget(definition("H2", null, null, "mem:test", "MODE=MySQL"),
                "org.h2.Driver", "jdbc:h2:mem:test;MODE=MySQL");
        assertTarget(definition("MYSQL", "db.local", null, "sales", "useSSL=false"),
                "com.mysql.cj.jdbc.Driver", "jdbc:mysql://db.local:3306/sales?useSSL=false");
        assertTarget(definition("SQLSERVER", "db.local", 1444, "erp", "encrypt=true"),
                "com.microsoft.sqlserver.jdbc.SQLServerDriver",
                "jdbc:sqlserver://db.local:1444;databaseName=erp;encrypt=true");
        assertTarget(definition("ORACLE", "db.local", null, "ORCL", "TNS_ADMIN=/wallet"),
                "oracle.jdbc.OracleDriver", "jdbc:oracle:thin:@//db.local:1521/ORCL?TNS_ADMIN=/wallet");
        assertTarget(definition("POSTGRESQL", "db.local", null, "analytics", "sslmode=disable"),
                "org.postgresql.Driver", "jdbc:postgresql://db.local:5432/analytics?sslmode=disable");
    }

    @Test
    void shouldPreferCustomJdbcUrl() {
        MdaConnectionDefinition definition = new MdaConnectionDefinition(
                "H2", null, null, "ignored", null, "sa", "", "jdbc:h2:mem:custom", null, true);
        assertThat(registry.resolve(definition).jdbcUrl()).isEqualTo("jdbc:h2:mem:custom");
    }

    @Test
    void shouldResolveSelplatH2ApplicationPathFromNestedHostDirectory() throws Exception {
        Path projectRoot = temporaryDirectory.resolve("SELPLAT");
        Path hostDirectory = projectRoot.resolve("apps/host/backend");
        Files.createDirectories(hostDirectory);
        Files.createFile(projectRoot.resolve("settings.gradle"));
        JdbcDriverRegistry nestedRegistry = new JdbcDriverRegistry(hostDirectory);

        JdbcDriverRegistry.JdbcTarget target = nestedRegistry.resolve(
                definition("H2", null, null, "file:./apps/reference-data/db/reference-data", "MODE=MySQL"));

        assertThat(target.jdbcUrl()).isEqualTo("jdbc:h2:file:"
                + projectRoot.resolve("apps/reference-data/db/reference-data").toString().replace('\\', '/')
                + ";MODE=MySQL");
    }

    private MdaConnectionDefinition definition(
            String type, String host, Integer port, String databaseName, String parameters) {
        return new MdaConnectionDefinition(
                type, host, port, databaseName, null, "user", "password", null, parameters, true);
    }

    private void assertTarget(MdaConnectionDefinition definition, String driverClass, String jdbcUrl) {
        JdbcDriverRegistry.JdbcTarget target = registry.resolve(definition);
        assertThat(target.driverClass()).isEqualTo(driverClass);
        assertThat(target.jdbcUrl()).isEqualTo(jdbcUrl);
    }
}
