package com.sp.selplat.referencedata.common.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;

/** 使用隔离 H2 文件验证七张表可以重建为空结构且重启不回填数据。 */
class ReferenceDataPersistenceConfigurationTest {

    /**
     * 验证全新数据库只建立七张空表，并包含表格登记、统一审计字段与表格头字段。
     *
     * @param temporaryDirectory JUnit 提供的隔离临时目录
     * 执行结果示例：七张表记录数均为 0，ReferenceDataTable 包含项目、表格配置 ID 和页面位置。
     * 异常或副作用示例：只在临时目录创建 H2 文件，不读写正式数据库。
     */
    @Test
    void shouldRebuildSevenEmptyTablesWithCurrentSchema(@TempDir Path temporaryDirectory) {
        Path databaseBase = temporaryDirectory.resolve("reference-data-empty").toAbsolutePath().normalize();
        JdbcTemplate jdbc = open(databaseBase);

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

        assertEquals(7, tableCount);
        assertEquals(0, rowCount);
        assertEquals(12, auditColumnCount);
        assertEquals(5, tableRegistryColumnCount);
        assertEquals(8, tableHeaderColumnCount);
        assertTrue(Files.isRegularFile(Path.of(databaseBase + ".mv.db")));
    }

    /**
     * 验证空库重启仍为空，同时管理员后来写入的数据不会被启动过程清除。
     *
     * @param temporaryDirectory JUnit 提供的隔离临时目录
     * 执行结果示例：第一次重启七表仍为 0；手动插入类型后再次重启记录仍为 1。
     * 异常或副作用示例：只修改 JUnit 临时文件库。
     */
    @Test
    void shouldKeepEmptyStateAndPreserveLaterManualData(@TempDir Path temporaryDirectory) {
        Path databaseBase = temporaryDirectory.resolve("reference-data-reopen").toAbsolutePath().normalize();
        JdbcTemplate firstJdbc = open(databaseBase);
        JdbcTemplate emptyReopenedJdbc = open(databaseBase);
        assertEquals(0, emptyReopenedJdbc.queryForObject("SELECT COUNT(*) FROM ReferenceDataType", Integer.class));

        firstJdbc.update(
                "INSERT INTO ReferenceDataType "
                        + "(id, tenantId, lastOperateUserId, projectCode, resourceCode, nameZh) "
                        + "VALUES (?, ?, ?, ?, ?, ?)",
                100001L, 1L, 1L, "manual", "first-type", "首条类型");
        JdbcTemplate populatedReopenedJdbc = open(databaseBase);
        assertEquals(1, populatedReopenedJdbc.queryForObject(
                "SELECT COUNT(*) FROM ReferenceDataType WHERE id = 100001", Integer.class));
        assertEquals(0, populatedReopenedJdbc.queryForObject(
                "SELECT COUNT(*) FROM CommonSequenceSegment", Integer.class));
    }

    private JdbcTemplate open(Path databaseBase) {
        String databaseUrl = "jdbc:h2:file:" + databaseBase
                + ";MODE=MySQL;AUTO_SERVER=TRUE;DATABASE_TO_UPPER=false";
        ReferenceDataPersistenceConfiguration configuration = new ReferenceDataPersistenceConfiguration();
        DataSource dataSource = configuration.referenceDataDataSource(databaseUrl, "sa", "");
        return configuration.referenceDataJdbcTemplate(dataSource);
    }
}
