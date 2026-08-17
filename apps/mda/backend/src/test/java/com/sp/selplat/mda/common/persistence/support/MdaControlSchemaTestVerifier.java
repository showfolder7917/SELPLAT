package com.sp.selplat.mda.common.persistence.support;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.UUID;
import javax.sql.DataSource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;

/**
 * MDA 控制库 SQL 验证器只在随机 H2 内存库执行生产 schema/data，并独立查询元数据和业务记录。
 */
public final class MdaControlSchemaTestVerifier {

    /**
     * 验证器不保存数据库状态，每个 Case 都创建独立随机内存库。
     */
    private MdaControlSchemaTestVerifier() {
    }

    /**
     * 验证空库首次初始化得到普通 BIGINT 主键、MDA 号段和 reference-data 内置连接。
     *
     * @param fixturePath 当前 Case 的空库 fixture，例如
     *     {@code "fixtures/MdaControlSchemaMigrationTest/freshInitialization.sql"}
     * 执行结果示例：{@code IS_IDENTITY=NO}、号段起点为 {@code 100000} 且内置连接为一条。
     */
    public static void verifyFreshInitialization(String fixturePath) {
        DataSource dataSource = initializedDataSource(fixturePath, 1);
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        assertEquals("NO", identityFlag(jdbc));
        assertEquals(1L, segmentCount(jdbc));
        assertEquals(100000L, nextStartId(jdbc));
        assertEquals(2L, jdbc.queryForObject("SELECT COUNT(*) FROM MdaConnectionProfile", Long.class));
        assertReferenceDataConnection(jdbc);
        assertJapaneseQuestionConnection(jdbc);
        assertControlSchema(jdbc);
    }

    /**
     * 验证生产初始化脚本连续执行两次仍只保留一个稳定号段和一条内置连接。
     *
     * @param fixturePath 当前 Case 的空库 fixture，例如
     *     {@code "fixtures/MdaControlSchemaMigrationTest/repeatedInitialization.sql"}
     * 执行结果示例：两次执行后号段和 Reference Data 连接均不重复，游标仍为 {@code 100000}。
     */
    public static void verifyRepeatedInitialization(String fixturePath) {
        DataSource dataSource = initializedDataSource(fixturePath, 2);
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        assertEquals("NO", identityFlag(jdbc));
        assertEquals(1L, segmentCount(jdbc));
        assertEquals(100000L, nextStartId(jdbc));
        assertEquals(0, jdbc.queryForObject(
            "SELECT versionNo FROM CommonSequenceSegment WHERE seqCode = 'MdaConnectionProfileId'",
            Integer.class
        ));
        assertEquals(2L, jdbc.queryForObject("SELECT COUNT(*) FROM MdaConnectionProfile", Long.class));
        assertReferenceDataConnection(jdbc);
        assertJapaneseQuestionConnection(jdbc);
        assertControlSchema(jdbc);
    }

    /**
     * 验证旧 identity 控制库升级时保留连接 ID 和业务字段，并新增不会碰撞的 MDA 号段。
     *
     * @param fixturePath 包含旧 identity 表和连接记录的 fixture，例如
     *     {@code "fixtures/MdaControlSchemaMigrationTest/legacyUpgrade.sql"}
     * 执行结果示例：原 {@code id=10003} 记录与内置连接并存，主键非 identity，号段起点为 {@code 100000}。
     */
    public static void verifyLegacyUpgrade(String fixturePath) {
        DataSource dataSource = initializedDataSource(fixturePath, 1);
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        assertEquals("NO", identityFlag(jdbc));
        assertEquals("旧库连接", jdbc.queryForObject(
            "SELECT connectionName FROM MdaConnectionProfile WHERE id = 10003",
            String.class
        ));
        assertEquals(3L, jdbc.queryForObject("SELECT COUNT(*) FROM MdaConnectionProfile", Long.class));
        assertReferenceDataConnection(jdbc);
        assertJapaneseQuestionConnection(jdbc);
        assertEquals(1L, segmentCount(jdbc));
        assertEquals(100000L, nextStartId(jdbc));
        assertControlSchema(jdbc);
    }

    /**
     * 创建随机隔离 H2，先加载当前 Case fixture，再按生产顺序执行 schema 与 data。
     *
     * @param fixturePath 测试类和方法唯一对应的 SQL fixture
     * @param initializationCount 生产脚本执行次数，例如首次初始化为 {@code 1}、重复初始化为 {@code 2}
     * @return 已完成当前迁移场景的隔离数据库
     */
    private static DataSource initializedDataSource(String fixturePath, int initializationCount) {
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName("org.h2.Driver");
        dataSource.setUrl("jdbc:h2:mem:" + UUID.randomUUID()
            + ";MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=false");
        dataSource.setUsername("sa");
        dataSource.setPassword("");
        // fixture 只描述当前 Case 初始数据库状态，生产脚本不在测试 Java 中复制 SQL。
        new ResourceDatabasePopulator(new ClassPathResource(fixturePath)).execute(dataSource);
        for (int index = 0; index < initializationCount; index++) {
            ResourceDatabasePopulator productionScripts = new ResourceDatabasePopulator();
            productionScripts.addScript(new ClassPathResource("db/mda/sql/schema-CommonSequenceSegment.sql"));
            productionScripts.addScript(new ClassPathResource("db/mda/sql/schema-MdaConnectionProfile.sql"));
            productionScripts.addScript(new ClassPathResource("db/mda/sql/data-MdaConnectionProfile.sql"));
            productionScripts.addScript(new ClassPathResource("db/mda/sql/data-CommonSequenceSegment.sql"));
            productionScripts.execute(dataSource);
        }
        return dataSource;
    }

    /**
     * 读取连接配置主键的真实 identity 元数据。
     *
     * @param jdbc 当前 Case 隔离数据库查询模板
     * @return identity 标记，例如普通号段主键返回 {@code "NO"}
     */
    private static String identityFlag(JdbcTemplate jdbc) {
        return jdbc.queryForObject(
            "SELECT IS_IDENTITY FROM INFORMATION_SCHEMA.COLUMNS "
                + "WHERE TABLE_NAME = 'MdaConnectionProfile' AND COLUMN_NAME = 'id'",
            String.class
        );
    }

    /**
     * 读取指定 MDA 控制表的真实字段数量，防止与当前表职责无关的字段重新进入。
     *
     * @param jdbc 当前 Case 的隔离数据库查询模板，例如已初始化的 H2 内存库
     * @param tableName MDA 控制表名，例如 {@code "MdaConnectionProfile"}
     * @return 当前表的真实字段数量，例如连接配置表返回 {@code 16L}
     */
    private static long columnCount(JdbcTemplate jdbc, String tableName) {
        return jdbc.queryForObject(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS "
                + "WHERE TABLE_SCHEMA = 'PUBLIC' AND TABLE_NAME = ?",
            Long.class,
            tableName
        );
    }

    /**
     * 验证 MDA 控制库的连接配置和号段两张固定表均存在，且字段数量与当前单一职责一致。
     *
     * @param jdbc 当前 Case 已完成生产 SQL 初始化的隔离 H2 查询模板
     *     <p>执行完成后无返回值；副作用示例为新库、重复初始化库和旧库均断言两张表及 {@code 11/16} 列。
     */
    private static void assertControlSchema(JdbcTemplate jdbc) {
        assertEquals(2L, jdbc.queryForObject(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES "
                + "WHERE TABLE_SCHEMA = 'PUBLIC' "
                + "AND TABLE_NAME IN ('CommonSequenceSegment', 'MdaConnectionProfile')",
            Long.class
        ));
        assertEquals(11L, columnCount(jdbc, "CommonSequenceSegment"));
        assertEquals(16L, columnCount(jdbc, "MdaConnectionProfile"));
    }

    /**
     * 验证生产种子只创建一条可跨机器解析的 reference-data H2 连接。
     * 真实传参示例：传入已经执行生产 schema/data 的隔离控制库 JdbcTemplate。
     * 真实返回示例：连接路径为 {@code file:./apps/reference-data/db/reference-data}，账号密码为 sa/123456。
     * 异常或副作用示例：记录缺失、重复或字段错误时断言失败，不修改隔离数据库。
     *
     * @param jdbc 当前 Case 的隔离控制库查询模板
     */
    private static void assertReferenceDataConnection(JdbcTemplate jdbc) {
        assertEquals(1L, jdbc.queryForObject(
            "SELECT COUNT(*) FROM MdaConnectionProfile WHERE connectionName = 'Reference Data 数据库'",
            Long.class
        ));
        assertEquals("file:./apps/reference-data/db/reference-data", jdbc.queryForObject(
            "SELECT databaseName FROM MdaConnectionProfile WHERE connectionName = 'Reference Data 数据库'",
            String.class
        ));
        assertEquals("sa", jdbc.queryForObject(
            "SELECT username FROM MdaConnectionProfile WHERE connectionName = 'Reference Data 数据库'",
            String.class
        ));
        assertEquals("123456", jdbc.queryForObject(
            "SELECT password FROM MdaConnectionProfile WHERE connectionName = 'Reference Data 数据库'",
            String.class
        ));
    }

    /**
     * 验证日语题库连接可以只依靠启动 SQL 在空 MDA 控制库中恢复。
     * 真实传参示例：传入已执行生产 schema/data 的隔离控制库 JdbcTemplate。
     * 真实返回示例：连接名唯一，路径为 {@code file:./apps/japanese/db/japanese}。
     * 异常或副作用示例：记录缺失或重复时断言失败，不修改隔离数据库。
     *
     * @param jdbc 当前 Case 的隔离控制库查询模板
     */
    private static void assertJapaneseQuestionConnection(JdbcTemplate jdbc) {
        assertEquals(1L, jdbc.queryForObject(
            "SELECT COUNT(*) FROM MdaConnectionProfile WHERE connectionName = 'N2 蓝宝书1000题数据库'",
            Long.class
        ));
        assertEquals("file:./apps/japanese/db/japanese", jdbc.queryForObject(
            "SELECT databaseName FROM MdaConnectionProfile WHERE connectionName = 'N2 蓝宝书1000题数据库'",
            String.class
        ));
    }

    /**
     * 读取当前数据库中 MDA 连接配置号段数量。
     *
     * @param jdbc 当前 Case 隔离数据库查询模板
     * @return 稳定业务坐标的记录数量，例如 {@code 1L}
     */
    private static long segmentCount(JdbcTemplate jdbc) {
        return jdbc.queryForObject(
            "SELECT COUNT(*) FROM CommonSequenceSegment WHERE seqCode = 'MdaConnectionProfileId'",
            Long.class
        );
    }

    /**
     * 读取当前 MDA 连接配置号段游标。
     *
     * @param jdbc 当前 Case 隔离数据库查询模板
     * @return 下次领取起点，例如 {@code 100000L}
     */
    private static long nextStartId(JdbcTemplate jdbc) {
        return jdbc.queryForObject(
            "SELECT nextStartId FROM CommonSequenceSegment WHERE seqCode = 'MdaConnectionProfileId'",
            Long.class
        );
    }
}
