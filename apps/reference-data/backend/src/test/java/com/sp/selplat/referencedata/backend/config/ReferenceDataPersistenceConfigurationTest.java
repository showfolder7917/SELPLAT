package com.sp.selplat.referencedata.backend.config;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.sp.selplat.referencedata.backend.persistence.ReferenceDataDatabase;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/**
 * 使用隔离 H2 文件验证 reference-data 数据在关闭连接并重新初始化后仍然存在。
 * 测试目录由 JUnit 管理，不读写正式 {@code apps/reference-data/db/data}。
 */
class ReferenceDataPersistenceConfigurationTest {

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
        ReferenceDataDatabase firstDatabase = configuration.referenceDataDatabase(databaseUrl, "sa", "");
        firstDatabase.jdbcTemplate().update(
                "INSERT INTO ReferenceDataType "
                        + "(projectCode, resourceCode, nameZh, dataShape, status, sortnum) VALUES (?, ?, ?, ?, ?, ?)",
                "test-project", "persistence-check", "持久化验证", "BOTH", 1, 10);
        // 使用相同 URL 重新初始化 → migration 可重复执行且既有业务记录不被覆盖或删除。
        ReferenceDataDatabase reopenedDatabase = configuration.referenceDataDatabase(databaseUrl, "sa", "");
        Integer persistedCount = reopenedDatabase.jdbcTemplate().queryForObject(
                "SELECT COUNT(*) FROM ReferenceDataType WHERE projectCode = ? AND resourceCode = ?",
                Integer.class,
                "test-project",
                "persistence-check");
        // 第二次数据库上下文仍能读到第一次写入记录，证明文件存储跨重启保留。
        assertEquals(1, persistedCount);
    }
}
