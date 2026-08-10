package com.sp.selplat.referencedata.common.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

/**
 * 使用隔离 H2 文件验证 reference-data 数据在关闭连接并重新初始化后仍然存在。
 * 测试目录由 JUnit 管理，不读写正式 {@code apps/reference-data/db/reference-data.mv.db}。
 */
class ReferenceDataPersistenceConfigurationTest {

    /**
     * 验证数据库文件不存在时可完全由正式 SQL 重建。
     * 真实传参示例：临时目录内使用尚不存在的 {@code reference-data-rebuild} 文件库。
     * 真实返回示例：生成 mv.db，建立五张表并写入四条独立业务号段。
     * 异常或副作用示例：所有文件仅写入 JUnit 临时目录，不接触正式数据库。
     *
     * @param temporaryDirectory JUnit 提供的隔离临时目录
     */
    @Test
    void shouldRebuildDeletedDatabaseFromSql(@TempDir Path temporaryDirectory) {
        Path databaseBase = temporaryDirectory.resolve("reference-data-rebuild")
                .toAbsolutePath().normalize();
        String databaseUrl = "jdbc:h2:file:" + databaseBase
                + ";MODE=MySQL;AUTO_SERVER=TRUE;DATABASE_TO_UPPER=false";

        ReferenceDataPersistenceConfiguration configuration =
                new ReferenceDataPersistenceConfiguration();
        DataSource rebuiltDataSource = configuration.referenceDataDataSource(databaseUrl, "sa", "");
        JdbcTemplate rebuiltJdbc = configuration.referenceDataJdbcTemplate(rebuiltDataSource);

        Integer requiredTableCount = rebuiltJdbc.queryForObject(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'PUBLIC' "
                        + "AND TABLE_NAME IN ('CommonSequenceSegment', 'ReferenceDataType', "
                        + "'ReferenceDataTreeNode', 'ReferenceDataOption', "
                        + "'ReferenceDataContextMenuItem')",
                Integer.class);
        Integer sequenceCount = rebuiltJdbc.queryForObject(
                "SELECT COUNT(*) FROM CommonSequenceSegment WHERE seqCode IN "
                        + "('ReferenceDataTypeId', 'ReferenceDataTreeNodeId', "
                        + "'ReferenceDataOptionId', 'ReferenceDataContextMenuItemId')",
                Integer.class);
        Integer builtInTypeCount = rebuiltJdbc.queryForObject(
                "SELECT COUNT(*) FROM ReferenceDataType WHERE projectCode = 'reference-data' "
                        + "AND resourceCode = 'resource-kind'",
                Integer.class);

        assertEquals(5, requiredTableCount);
        assertEquals(4, sequenceCount);
        assertEquals(1, builtInTypeCount);
        assertTrue(Files.isRegularFile(Path.of(databaseBase + ".mv.db")));
    }

    /**
     * 验证相同文件 URL 第二次打开时保留第一次写入的业务类型。
     *
     * @param temporaryDirectory JUnit 提供的隔离临时目录
     * 执行结果示例：第一次写入 {@code persistence-check}，第二次初始化查询数量仍为 {@code 1}。
     */
    @Test
    void shouldKeepReferenceDataAfterDatabaseIsReopened(@TempDir Path temporaryDirectory) {
        // 隔离文件路径 → 与正式运行相同的 H2 file 和 AUTO_SERVER 模式。
        String databaseUrl = "jdbc:h2:file:"
                + temporaryDirectory.resolve("reference-data-test").toAbsolutePath().normalize()
                + ";MODE=MySQL;AUTO_SERVER=TRUE;DATABASE_TO_UPPER=false";
        ReferenceDataPersistenceConfiguration configuration = new ReferenceDataPersistenceConfiguration();
        // 第一次初始化执行正式 migration 并写入一条测试业务类型。
        DataSource firstDataSource = configuration.referenceDataDataSource(databaseUrl, "sa", "");
        JdbcTemplate firstJdbc = configuration.referenceDataJdbcTemplate(firstDataSource);
        firstJdbc.update(
                "INSERT INTO ReferenceDataType "
                        + "(id, projectCode, resourceCode, nameZh, status, sortnum) VALUES (?, ?, ?, ?, ?, ?)",
                900001L, "test-project", "persistence-check", "持久化验证", 1, 10);
        // 模拟进程已成功领取 ReferenceDataTypeId 号段，重启不得把游标和乐观锁版本重置。
        firstJdbc.update(
                "UPDATE CommonSequenceSegment SET nextStartId = ?, versionNo = ? WHERE seqCode = ?",
                345000L,
                7,
                "ReferenceDataTypeId");
        // 使用相同 URL 重新初始化 → migration 可重复执行且既有业务记录不被覆盖或删除。
        DataSource reopenedDataSource = configuration.referenceDataDataSource(databaseUrl, "sa", "");
        JdbcTemplate reopenedJdbc = configuration.referenceDataJdbcTemplate(reopenedDataSource);
        Integer persistedCount = reopenedJdbc.queryForObject(
                "SELECT COUNT(*) FROM ReferenceDataType WHERE projectCode = ? AND resourceCode = ?",
                Integer.class,
                "test-project",
                "persistence-check");
        Map<String, Object> preservedSequence = reopenedJdbc.queryForMap(
                "SELECT nextStartId, versionNo FROM CommonSequenceSegment WHERE seqCode = ?",
                "ReferenceDataTypeId");
        // 第二次数据库上下文仍能读到第一次写入记录，证明文件存储跨重启保留。
        assertEquals(1, persistedCount);
        assertEquals(345000L, ((Number) preservedSequence.get("nextStartId")).longValue());
        assertEquals(7, ((Number) preservedSequence.get("versionNo")).intValue());
    }

    /**
     * 验证旧数据库升级时保留类型数据，同时只兼容移除无效输出形态字段。
     * 真实传参示例：临时旧库包含 {@code legacy-project/legacy-type} 和旧 ReferenceDataItem 表。
     * 真实返回示例：旧类型和旧表均保留，新业务表完成兼容创建。
     * 异常或副作用示例：升级只发生在 JUnit 临时文件库，不删除旧表或覆盖已有业务记录。
     *
     * @param temporaryDirectory JUnit 提供的隔离临时目录
     */
    @Test
    void shouldUpgradeLegacySchemaWithoutLosingTypeData(@TempDir Path temporaryDirectory) {
        // 隔离旧库路径 → 模拟已经包含 dataShape 和 ReferenceDataItem 的正式数据库。
        String databaseUrl = "jdbc:h2:file:"
                + temporaryDirectory.resolve("reference-data-legacy-test").toAbsolutePath().normalize()
                + ";MODE=MySQL;AUTO_SERVER=TRUE;DATABASE_TO_UPPER=false";
        DriverManagerDataSource legacyDataSource = new DriverManagerDataSource(databaseUrl, "sa", "");
        legacyDataSource.setDriverClassName("org.h2.Driver");
        JdbcTemplate legacyJdbc = new JdbcTemplate(legacyDataSource);
        // 旧类型结构包含已确认无控制作用的 dataShape 字段，其余列与正式旧库保持一致。
        legacyJdbc.execute("CREATE TABLE ReferenceDataType ("
                + "id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, "
                + "projectCode VARCHAR(64) NOT NULL, resourceCode VARCHAR(64) NOT NULL, "
                + "nameZh VARCHAR(120) NOT NULL, nameJa VARCHAR(120), nameEn VARCHAR(120), "
                + "descriptionZh VARCHAR(500), descriptionJa VARCHAR(500), descriptionEn VARCHAR(500), "
                + "dataShape VARCHAR(16) NOT NULL DEFAULT 'BOTH', status INTEGER NOT NULL DEFAULT 1, "
                + "sortnum DECIMAL(18, 2) NOT NULL DEFAULT 0, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, "
                + "updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, "
                + "CONSTRAINT uk_reference_data_type_coordinate UNIQUE (projectCode, resourceCode), "
                + "CONSTRAINT ck_reference_data_type_shape CHECK (dataShape IN ('TREE', 'OPTIONS', 'BOTH')), "
                + "CONSTRAINT ck_reference_data_type_status CHECK (status IN (0, 1, 2)))");
        // 旧明细表在当前正式库中已经确认没有业务记录，仅保留最小结构用于验证升级清理动作。
        legacyJdbc.execute("CREATE TABLE ReferenceDataItem (id BIGINT PRIMARY KEY)");
        legacyJdbc.update(
                "INSERT INTO ReferenceDataType "
                        + "(projectCode, resourceCode, nameZh, dataShape, status, sortnum) VALUES (?, ?, ?, ?, ?, ?)",
                "legacy-project", "legacy-type", "旧类型", "BOTH", 1, 50);

        // 正式初始化入口 → 执行拆分后的两个 schema 文件和类型数据文件。
        ReferenceDataPersistenceConfiguration configuration = new ReferenceDataPersistenceConfiguration();
        DataSource upgradedDataSource = configuration.referenceDataDataSource(databaseUrl, "sa", "");
        JdbcTemplate upgradedJdbc = configuration.referenceDataJdbcTemplate(upgradedDataSource);
        // 稳定业务坐标仍存在 → 删除旧字段没有重建或覆盖原类型记录。
        Integer preservedTypeCount = upgradedJdbc.queryForObject(
                "SELECT COUNT(*) FROM ReferenceDataType WHERE projectCode = ? AND resourceCode = ?",
                Integer.class,
                "legacy-project",
                "legacy-type");
        assertEquals(1, preservedTypeCount);
        // 数据库元数据 → dataShape 兼容移除，但旧表不会被启动脚本直接清空或删除。
        Integer legacyColumnCount = upgradedJdbc.queryForObject(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS "
                        + "WHERE TABLE_SCHEMA = 'PUBLIC' AND TABLE_NAME = 'ReferenceDataType' AND COLUMN_NAME = 'dataShape'",
                Integer.class);
        Integer legacyTableCount = upgradedJdbc.queryForObject(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES "
                        + "WHERE TABLE_SCHEMA = 'PUBLIC' AND TABLE_NAME = 'ReferenceDataItem'",
                Integer.class);
        Integer treeTableCount = upgradedJdbc.queryForObject(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES "
                        + "WHERE TABLE_SCHEMA = 'PUBLIC' AND TABLE_NAME = 'ReferenceDataTreeNode'",
                Integer.class);
        Integer optionTableCount = upgradedJdbc.queryForObject(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES "
                        + "WHERE TABLE_SCHEMA = 'PUBLIC' AND TABLE_NAME = 'ReferenceDataOption'",
                Integer.class);
        Integer menuTableCount = upgradedJdbc.queryForObject(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES "
                        + "WHERE TABLE_SCHEMA = 'PUBLIC' AND TABLE_NAME = 'ReferenceDataContextMenuItem'",
                Integer.class);
        Integer sequenceRowCount = upgradedJdbc.queryForObject(
                "SELECT COUNT(*) FROM CommonSequenceSegment WHERE status = 1 "
                        + "AND seqCode IN ('ReferenceDataTypeId', 'ReferenceDataTreeNodeId', "
                        + "'ReferenceDataOptionId', 'ReferenceDataContextMenuItemId')",
                Integer.class);
        Integer remainingBusinessIdentityCount = upgradedJdbc.queryForObject(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS "
                        + "WHERE TABLE_SCHEMA = 'PUBLIC' AND COLUMN_NAME = 'id' AND IS_IDENTITY = 'YES' "
                        + "AND TABLE_NAME IN ('ReferenceDataType', 'ReferenceDataTreeNode', "
                        + "'ReferenceDataOption', 'ReferenceDataContextMenuItem')",
                Integer.class);
        assertEquals(0, legacyColumnCount);
        assertEquals(1, legacyTableCount);
        assertEquals(1, treeTableCount);
        assertEquals(1, optionTableCount);
        assertEquals(1, menuTableCount);
        assertEquals(4, sequenceRowCount);
        assertEquals(0, remainingBusinessIdentityCount);
    }
}
