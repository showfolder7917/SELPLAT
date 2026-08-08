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
     * 验证空库首次初始化得到普通 BIGINT 主键与一条 MDA 号段配置。
     *
     * @param fixturePath 当前 Case 的空库 fixture，例如
     *     {@code "fixtures/MdaControlSchemaMigrationTest/freshInitialization.sql"}
     * 执行结果示例：{@code IS_IDENTITY=NO} 且号段起点为 {@code 100000}。
     */
    public static void verifyFreshInitialization(String fixturePath) {
        DataSource dataSource = initializedDataSource(fixturePath, 1);
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        assertEquals("NO", identityFlag(jdbc));
        assertEquals(1L, segmentCount(jdbc));
        assertEquals(100000L, nextStartId(jdbc));
        assertEquals(0L, jdbc.queryForObject("SELECT COUNT(*) FROM MdaConnectionProfile", Long.class));
    }

    /**
     * 验证生产初始化脚本连续执行两次仍只保留一个稳定号段且不重置游标。
     *
     * @param fixturePath 当前 Case 的空库 fixture，例如
     *     {@code "fixtures/MdaControlSchemaMigrationTest/repeatedInitialization.sql"}
     * 执行结果示例：两次执行后 {@code MdaConnectionProfileId} 仍只有一条且起点为 {@code 100000}。
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
    }

    /**
     * 验证旧 identity 控制库升级时保留连接 ID 和业务字段，并新增不会碰撞的 MDA 号段。
     *
     * @param fixturePath 包含旧 identity 表和连接记录的 fixture，例如
     *     {@code "fixtures/MdaControlSchemaMigrationTest/legacyUpgrade.sql"}
     * 执行结果示例：原 {@code id=10003} 记录仍存在，主键变为非 identity，MDA 号段起点为 {@code 100000}。
     */
    public static void verifyLegacyUpgrade(String fixturePath) {
        DataSource dataSource = initializedDataSource(fixturePath, 1);
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        assertEquals("NO", identityFlag(jdbc));
        assertEquals("旧库连接", jdbc.queryForObject(
            "SELECT connectionName FROM MdaConnectionProfile WHERE id = 10003",
            String.class
        ));
        assertEquals(1L, jdbc.queryForObject("SELECT COUNT(*) FROM MdaConnectionProfile", Long.class));
        assertEquals(1L, segmentCount(jdbc));
        assertEquals(100000L, nextStartId(jdbc));
        assertEquals(0L, jdbc.queryForObject(
            "SELECT COUNT(*) FROM CommonSequenceSegment WHERE seqCode = 'UniauthUserId'",
            Long.class
        ));
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
