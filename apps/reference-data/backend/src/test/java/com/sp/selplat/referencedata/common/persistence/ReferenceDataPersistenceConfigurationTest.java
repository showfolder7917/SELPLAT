package com.sp.selplat.referencedata.common.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;

/** 使用隔离 H2 文件验证 Hikari 私有连接池、七张表、测试数据和重启幂等性。 */
class ReferenceDataPersistenceConfigurationTest {

    /**
     * 验证全新数据库通过具名 Hikari 池建立七张表，并只初始化号段、六个表格定义及四十六条列配置。
     *
     * @param temporaryDirectory JUnit 提供的隔离临时目录，例如 {@code /tmp/junit/reference-data-empty}
     * 执行结果示例：池名为 {@code ReferenceDataEmptyTestPool}，总计 58 条初始化记录，
     *     ReferenceDataTable 包含 6 条、列配置包含 46 条。
     * 异常或副作用示例：只在临时目录创建和关闭 H2 文件与连接池，不读写正式数据库。
     */
    @Test
    void shouldInitializeEditableTableDefinitionFixtures(@TempDir Path temporaryDirectory) {
        Path databaseBase = temporaryDirectory.resolve("reference-data-empty").toAbsolutePath().normalize();
        try (HikariDataSource dataSource = open(databaseBase, "ReferenceDataEmptyTestPool")) {
            JdbcTemplate jdbc = new JdbcTemplate(dataSource);

            Integer tableCount = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'PUBLIC' "
                            + "AND TABLE_NAME IN ('CommonSequenceSegment', 'ReferenceDataType', "
                            + "'ReferenceDataTreeNode', 'ReferenceDataOption', "
                            + "'ReferenceDataContextMenuItem', 'ReferenceDataTable', 'ReferenceDataTableColumn')",
                    Integer.class);
            Integer rowCount = jdbc.queryForObject(
                    "SELECT SUM(rowCount) FROM ("
                            + "SELECT COUNT(*) rowCount FROM CommonSequenceSegment "
                            + "UNION ALL SELECT COUNT(*) FROM ReferenceDataType "
                            + "UNION ALL SELECT COUNT(*) FROM ReferenceDataTreeNode "
                            + "UNION ALL SELECT COUNT(*) FROM ReferenceDataOption "
                            + "UNION ALL SELECT COUNT(*) FROM ReferenceDataContextMenuItem "
                            + "UNION ALL SELECT COUNT(*) FROM ReferenceDataTable "
                            + "UNION ALL SELECT COUNT(*) FROM ReferenceDataTableColumn) rows",
                    Integer.class);
            Integer auditColumnCount = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'PUBLIC' "
                            + "AND TABLE_NAME IN ('ReferenceDataType', 'ReferenceDataTreeNode', "
                            + "'ReferenceDataOption', 'ReferenceDataContextMenuItem', "
                            + "'ReferenceDataTable', 'ReferenceDataTableColumn') "
                            + "AND COLUMN_NAME IN ('tenantId', 'lastOperateUserId')",
                    Integer.class);
            Integer tableRegistryColumnCount = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'PUBLIC' "
                            + "AND TABLE_NAME = 'ReferenceDataTable' AND COLUMN_NAME IN "
                            + "('projectName', 'tableName', 'gridColumnId', 'description', 'pagePath')",
                    Integer.class);
            Integer tableHeaderColumnCount = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'PUBLIC' "
                            + "AND TABLE_NAME = 'ReferenceDataTableColumn' AND COLUMN_NAME IN "
                            + "('tableName', 'gridId', 'gridColumnId', 'tableFieldName', "
                            + "'tableSecondaryFieldName', 'cellRenderer', 'cellIcon', 'cellIconVisible')",
                    Integer.class);
            Integer registeredTableCount = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM ReferenceDataTable", Integer.class);
            Integer configuredColumnCount = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM ReferenceDataTableColumn", Integer.class);

            assertInstanceOf(HikariDataSource.class, dataSource);
            assertInstanceOf(DataSourceTransactionManager.class,
                    new ReferenceDataPersistenceConfiguration().referenceDataTransactionManager(dataSource));
            assertEquals("ReferenceDataEmptyTestPool", dataSource.getPoolName());
            assertEquals(7, tableCount);
            assertEquals(58, rowCount);
            assertEquals(12, auditColumnCount);
            assertEquals(5, tableRegistryColumnCount);
            assertEquals(8, tableHeaderColumnCount);
            assertEquals(6, registeredTableCount);
            assertEquals(46, configuredColumnCount);
        }
        assertTrue(Files.isRegularFile(Path.of(databaseBase + ".mv.db")));
    }

    /**
     * 验证初始化数据在连接池关闭并重启后不重复，同时管理员后来写入的数据不会被启动过程清除。
     *
     * @param temporaryDirectory JUnit 提供的隔离临时目录，例如 {@code /tmp/junit/reference-data-reopen}
     * 执行结果示例：重启后表格定义仍为 6；手动插入类型后再次打开仍能查询到 1 条。
     * 异常或副作用示例：每次重启都先关闭旧池，仅修改 JUnit 临时文件库。
     */
    @Test
    void shouldKeepEmptyStateAndPreserveLaterManualData(@TempDir Path temporaryDirectory) {
        Path databaseBase = temporaryDirectory.resolve("reference-data-reopen").toAbsolutePath().normalize();
        try (HikariDataSource firstDataSource = open(databaseBase, "ReferenceDataFirstTestPool")) {
            JdbcTemplate firstJdbc = new JdbcTemplate(firstDataSource);
            assertEquals(6, firstJdbc.queryForObject(
                    "SELECT COUNT(*) FROM ReferenceDataTable", Integer.class));
            assertEquals(46, firstJdbc.queryForObject(
                    "SELECT COUNT(*) FROM ReferenceDataTableColumn", Integer.class));
            firstJdbc.update(
                    "INSERT INTO ReferenceDataType "
                            + "(id, tenantId, lastOperateUserId, projectCode, resourceCode, nameZh) "
                            + "VALUES (?, ?, ?, ?, ?, ?)",
                    100001L, 1L, 1L, "manual", "first-type", "首条类型");
        }
        try (HikariDataSource reopenedDataSource = open(
                databaseBase, "ReferenceDataReopenedTestPool")) {
            JdbcTemplate populatedReopenedJdbc = new JdbcTemplate(reopenedDataSource);
            assertEquals(1, populatedReopenedJdbc.queryForObject(
                    "SELECT COUNT(*) FROM ReferenceDataType WHERE id = 100001", Integer.class));
            assertEquals(6, populatedReopenedJdbc.queryForObject(
                    "SELECT COUNT(*) FROM CommonSequenceSegment", Integer.class));
        }
    }

    /**
     * 验证早期正式库缺少租户和操作员字段时原地补列，保留已有类型数据并继续完成全部初始化。
     *
     * @param temporaryDirectory JUnit 提供的隔离临时目录，例如 {@code /tmp/junit/reference-data-legacy}
     * 执行结果示例：旧记录 {@code legacy-type} 保持 1 条，新增审计字段均回填为 {@code 1}，
     *     ReferenceDataTable 与 ReferenceDataTableColumn 同时完成首次建表。
     * 异常或副作用示例：迁移只发生在 JUnit 临时文件库；生产脚本失败时连接池关闭且原异常被保留。
     */
    @Test
    void shouldAddAuditColumnsWithoutDroppingLegacyTypeData(@TempDir Path temporaryDirectory) {
        Path databaseBase = temporaryDirectory.resolve("reference-data-legacy").toAbsolutePath().normalize();
        createLegacyTypeDatabase(databaseBase);

        try (HikariDataSource dataSource = open(databaseBase, "ReferenceDataLegacyTestPool")) {
            JdbcTemplate jdbc = new JdbcTemplate(dataSource);
            assertEquals(1, jdbc.queryForObject(
                    "SELECT COUNT(*) FROM ReferenceDataType WHERE resourceCode = 'legacy-type'",
                    Integer.class));
            assertEquals(1L, jdbc.queryForObject(
                    "SELECT tenantId FROM ReferenceDataType WHERE resourceCode = 'legacy-type'",
                    Long.class));
            assertEquals(1L, jdbc.queryForObject(
                    "SELECT lastOperateUserId FROM ReferenceDataType WHERE resourceCode = 'legacy-type'",
                    Long.class));
            assertEquals(1, jdbc.queryForObject(
                    "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'PUBLIC' "
                            + "AND TABLE_NAME = 'ReferenceDataTableColumn'",
                    Integer.class));
        }
    }

    /**
     * 创建只有早期 ReferenceDataType 结构和一条管理员数据的文件库，稳定复现缺审计字段启动失败。
     *
     * @param databaseBase JUnit 临时数据库基础路径，例如 {@code /tmp/reference-data-legacy}
     * 执行结果示例：文件库仅有 ReferenceDataType，记录 {@code legacy-type} 不含 tenantId 和 lastOperateUserId。
     * 异常或副作用示例：DDL 失败时测试立即失败；成功后旧池在生产配置接管前关闭。
     */
    private void createLegacyTypeDatabase(Path databaseBase) {
        HikariConfig legacyConfig = new HikariConfig();
        legacyConfig.setJdbcUrl("jdbc:h2:file:" + databaseBase
                + ";MODE=MySQL;DATABASE_TO_UPPER=false");
        legacyConfig.setPoolName("ReferenceDataLegacyFixturePool");
        legacyConfig.setUsername("sa");
        legacyConfig.setPassword("");
        legacyConfig.setDriverClassName("org.h2.Driver");
        legacyConfig.setMaximumPoolSize(1);
        try (HikariDataSource legacyDataSource = new HikariDataSource(legacyConfig)) {
            JdbcTemplate jdbc = new JdbcTemplate(legacyDataSource);
            jdbc.execute("CREATE TABLE ReferenceDataType ("
                    + "id BIGINT PRIMARY KEY, projectCode VARCHAR(64) NOT NULL, "
                    + "resourceCode VARCHAR(64) NOT NULL, nameZh VARCHAR(120) NOT NULL, "
                    + "nameJa VARCHAR(120), nameEn VARCHAR(120), descriptionZh VARCHAR(500), "
                    + "descriptionJa VARCHAR(500), descriptionEn VARCHAR(500), "
                    + "status INTEGER NOT NULL DEFAULT 1, sortnum DECIMAL(18, 2) NOT NULL DEFAULT 0, "
                    + "createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, "
                    + "updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)");
            jdbc.update("INSERT INTO ReferenceDataType "
                    + "(id, projectCode, resourceCode, nameZh) VALUES (?, ?, ?, ?)",
                    199999L, "legacy", "legacy-type", "旧类型");
        }
    }

    /**
     * 为单个测试文件库创建与生产结构相同、但生命周期完全隔离的 Hikari 连接池。
     *
     * @param databaseBase JUnit 临时数据库基础路径，例如 {@code /tmp/reference-data-empty}
     * @param poolName 当前测试唯一池名，例如 {@code ReferenceDataEmptyTestPool}
     * @return 已完成七表初始化的连接池，例如 JDBC URL 以 {@code jdbc:h2:file:} 开头
     * 异常或副作用示例：初始化失败时生产配置关闭池并抛出
     *     {@code REFERENCE_DATA_DATABASE_INITIALIZATION_FAILED}；成功时调用方必须关闭返回池。
     */
    private HikariDataSource open(Path databaseBase, String poolName) {
        HikariConfig hikariConfig = new HikariConfig();
        hikariConfig.setJdbcUrl("jdbc:h2:file:" + databaseBase
                + ";MODE=MySQL;DATABASE_TO_UPPER=false");
        hikariConfig.setPoolName(poolName);
        hikariConfig.setUsername("sa");
        hikariConfig.setPassword("");
        hikariConfig.setDriverClassName("org.h2.Driver");
        hikariConfig.setMinimumIdle(1);
        hikariConfig.setMaximumPoolSize(2);
        ReferenceDataPersistenceConfiguration configuration = new ReferenceDataPersistenceConfiguration();
        return configuration.referenceDataDataSource(hikariConfig);
    }
}
