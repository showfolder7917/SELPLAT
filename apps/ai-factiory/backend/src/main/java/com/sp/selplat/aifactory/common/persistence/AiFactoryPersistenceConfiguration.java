package com.sp.selplat.aifactory.common.persistence;

import com.sp.selplat.common.db.datasource.BaseDataSourceContext;
import com.sp.selplat.common.db.sequence.CommonSequenceSegmentDao;
import com.sp.selplat.common.db.sequence.CommonSequenceSegmentDaoImpl;
import com.sp.selplat.common.db.template.BaseTemplateDao;
import com.sp.selplat.common.db.template.BaseTemplateMapper;
import com.sp.selplat.common.service.sequence.SequenceGenerator;
import com.sp.selplat.common.service.sequence.SequenceGeneratorImpl;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import javax.sql.DataSource;
import org.apache.ibatis.mapping.Environment;
import org.apache.ibatis.session.SqlSessionFactory;
import org.apache.ibatis.session.SqlSessionFactoryBuilder;
import org.mybatis.spring.SqlSessionTemplate;
import org.mybatis.spring.transaction.SpringManagedTransactionFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.transaction.PlatformTransactionManager;

/** 创建 AI 工厂唯一私有数据源，并把正式运行库固定在应用 db 目录。 */
@Configuration
public class AiFactoryPersistenceConfiguration {

    // SEQUENCE_TARGETS 固定每张业务表与独立号段的对应关系，启动迁移不会接受外部表名或列名。
    private static final List<SequenceTarget> SEQUENCE_TARGETS = List.of(
            new SequenceTarget("AiRoleId", "AiRole", "id"),
            new SequenceTarget("AiGateId", "AiGate", "id"),
            new SequenceTarget("AiRuleId", "AiRule", "id"),
            new SequenceTarget("AiProjectId", "AiProject", "id"),
            new SequenceTarget("AiWorkflowDefinitionId", "AiWorkflowDefinition", "id"),
            new SequenceTarget("AiWorkflowVersionId", "AiWorkflowVersion", "id"),
            new SequenceTarget("AiWorkflowNodeId", "AiWorkflowNode", "id"),
            new SequenceTarget("AiWorkflowEdgeId", "AiWorkflowEdge", "id"),
            new SequenceTarget("AiWorkflowRunId", "AiWorkflowRun", "id"),
            new SequenceTarget("AiWorkflowNodeRunId", "AiWorkflowNodeRun", "id"));

    /**
     * 创建连接池配置。
     * 真实传参示例：无显式参数，读取 {@code ai-factory.datasource.maximum-pool-size=4}。
     * 真实返回示例：池名为 {@code AiFactoryPool} 的 HikariConfig。
     * 异常或副作用示例：配置格式错误时 Spring 启动失败；不创建数据库。
     *
     * @return AI 工厂连接池配置
     */
    @Bean("aiFactoryHikariConfig")
    @ConfigurationProperties(prefix = "ai-factory.datasource")
    public HikariConfig hikariConfig() {
        return new HikariConfig();
    }

    /**
     * 创建并初始化私有 H2 数据源。
     * 真实传参示例：未配置 jdbcUrl 时使用 AI 工厂应用目录中的正式运行数据库。
     * 真实返回示例：{@code jdbc:h2:file:.../apps/ai-factiory/db/aifactory}。
     * 异常或副作用示例：创建目录或执行 SQL 失败时启动中止；不会读取任务正文。
     *
     * @param config 已绑定的连接池参数
     * @return 初始化后的数据源
     * @throws Exception 文件系统或 SQL 初始化失败
     */
    @Bean(name = "aiFactoryDataSource", destroyMethod = "close")
    public HikariDataSource dataSource(@Qualifier("aiFactoryHikariConfig") HikariConfig config)
            throws Exception {
        Path databaseDirectory = locateRoot().resolve("apps/ai-factiory/db");
        Files.createDirectories(databaseDirectory);
        if (config.getJdbcUrl() == null || config.getJdbcUrl().isBlank()) {
            config.setJdbcUrl("jdbc:h2:file:" + databaseDirectory.resolve("aifactory").toAbsolutePath()
                    + ";MODE=MySQL;DATABASE_TO_UPPER=false");
        } else if (!config.getJdbcUrl().contains("DATABASE_TO_UPPER=")) {
            config.setJdbcUrl(config.getJdbcUrl() + ";MODE=MySQL;DATABASE_TO_UPPER=false");
        }
        HikariDataSource dataSource = new HikariDataSource(config);
        initialize(dataSource);
        return dataSource;
    }

    /**
     * 创建 AI 工厂事务管理器。
     * 真实传参示例：Spring 注入 aiFactoryDataSource。
     * 真实返回示例：只提交 AI 工厂控制面数据库的事务管理器。
     * 异常或副作用示例：无额外异常；不管理 memory 的 SQLite。
     *
     * @param dataSource AI 工厂数据源
     * @return 私有事务管理器
     */
    @Bean("aiFactoryTransactionManager")
    public PlatformTransactionManager transactionManager(
            @Qualifier("aiFactoryDataSource") DataSource dataSource) {
        return new DataSourceTransactionManager(dataSource);
    }

    /**
     * 创建 AI 工厂独立号段 DAO。
     * 真实传参示例：Spring 注入 {@code aiFactoryDataSource}。
     * 真实返回示例：返回只访问 AI 工厂 CommonSequenceSegment 的 DAO。
     * 异常或副作用示例：构造不访问数据库；实际发号失败时由调用方收到数据库异常。
     *
     * @param dataSource AI 工厂私有数据源
     * @return AI 工厂号段 DAO
     */
    @Bean("aiFactoryCommonSequenceSegmentDao")
    public CommonSequenceSegmentDao sequenceDao(
            @Qualifier("aiFactoryDataSource") DataSource dataSource) {
        return new CommonSequenceSegmentDaoImpl(dataSource);
    }

    /**
     * 在未装配平台聚合发号器的单模块运行环境中提供同一公共实现。
     * 真实传参示例：AI 工厂隔离测试只有 {@code aiFactoryCommonSequenceSegmentDao}。
     * 真实返回示例：单模块使用 SequenceGeneratorImpl；Host 已有聚合发号器时不创建本 Bean。
     * 异常或副作用示例：号段缺失时首次发号失败；构造过程不领取或修改号段。
     *
     * @param sequenceDao AI 工厂私有号段 DAO
     * @return 单模块运行所需的公共发号器
     */
    @Bean("aiFactoryStandaloneSequenceGenerator")
    @ConditionalOnMissingBean(SequenceGenerator.class)
    public SequenceGenerator standaloneSequenceGenerator(
            @Qualifier("aiFactoryCommonSequenceSegmentDao") CommonSequenceSegmentDao sequenceDao) {
        return new SequenceGeneratorImpl(sequenceDao);
    }

    /**
     * 创建固定表 DAO 使用的 MyBatis 模板上下文。
     * 真实传参示例：Spring 注入已初始化的 AI 工厂数据源。
     * 真实返回示例：上下文同时包含数据源与 BaseTemplateDao。
     * 异常或副作用示例：Mapper 构建失败时应用启动中止；不修改业务数据。
     *
     * @param dataSource AI 工厂私有数据源
     * @return 固定表 DAO 上下文
     */
    @Bean("aiFactoryBaseDataSourceContext")
    public BaseDataSourceContext context(
            @Qualifier("aiFactoryDataSource") DataSource dataSource) {
        org.apache.ibatis.session.Configuration configuration =
                new org.apache.ibatis.session.Configuration();
        configuration.setEnvironment(new Environment(
                "aifactory", new SpringManagedTransactionFactory(), dataSource));
        configuration.addMapper(BaseTemplateMapper.class);
        SqlSessionFactory factory = new SqlSessionFactoryBuilder().build(configuration);
        BaseTemplateMapper mapper = new SqlSessionTemplate(factory)
                .getMapper(BaseTemplateMapper.class);
        return new BaseDataSourceContext(dataSource, new BaseTemplateDao(mapper, dataSource));
    }

    private void initialize(DataSource dataSource) throws Exception {
        ResourceDatabasePopulator populator = new ResourceDatabasePopulator();
        ClassPathResource order = new ClassPathResource("db/aifactory/sql/load-order.txt");
        String text = new String(order.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        for (String line : text.lines().map(String::trim)
                .filter(value -> !value.isEmpty() && !value.startsWith("#")).toList()) {
            populator.addScript(new ClassPathResource(line));
        }
        populator.execute(dataSource);
        migrateLegacyIdentityColumns(dataSource);
        synchronizeSequenceCursors(dataSource);
    }

    /**
     * 把仍在使用的新版业务表自增列原位迁移为普通 BIGINT 主键。
     * 真实传参示例：包含旧版 {@code AiRole.id IDENTITY} 及既有角色记录的数据源。
     * 真实返回示例：方法完成后既有角色记录不变，{@code AiRole.id} 不再自动生成。
     * 异常或副作用示例：任一列迁移失败时启动中止，不继续提供可能重复发号的服务。
     *
     * @param dataSource 已完成建表和种子数据初始化的 AI 工厂数据源
     */
    private void migrateLegacyIdentityColumns(DataSource dataSource) {
        JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);
        for (SequenceTarget target : SEQUENCE_TARGETS) {
            // 只迁移常量清单中经确认的表列，避免外部输入改变数据库结构。
            Integer identityCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS "
                            + "WHERE TABLE_SCHEMA = 'PUBLIC' AND TABLE_NAME = ? "
                            + "AND COLUMN_NAME = ? AND IS_IDENTITY = 'YES'",
                    Integer.class,
                    target.tableName(),
                    target.columnName());
            if (identityCount != null && identityCount > 0) {
                jdbcTemplate.execute("ALTER TABLE " + target.tableName()
                        + " ALTER COLUMN " + target.columnName() + " DROP IDENTITY");
            }
        }
    }

    /**
     * 按每张表的现有最大主键向前校准独立号段游标。
     * 真实传参示例：{@code AiRole} 最大 id 为 100016，种子游标为 101000。
     * 真实返回示例：游标保持 100000；若最大 id 为 100120，则提升到 100121。
     * 异常或副作用示例：查询或更新失败时启动中止；游标永远不会向后更新。
     *
     * @param dataSource 已完成旧自增列迁移的 AI 工厂数据源
     */
    private void synchronizeSequenceCursors(DataSource dataSource) {
        JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);
        for (SequenceTarget target : SEQUENCE_TARGETS) {
            // 表名和列名来自类内固定清单，不接收请求参数或配置文件动态拼接。
            Long maximumId = jdbcTemplate.queryForObject(
                    "SELECT COALESCE(MAX(" + target.columnName() + "), 0) FROM "
                            + target.tableName(),
                    Long.class);
            long requiredNextStartId = maximumId == null ? 1L : maximumId + 1L;
            jdbcTemplate.update(
                    "UPDATE CommonSequenceSegment SET nextStartId=?, updatedAt=CURRENT_TIMESTAMP "
                            + "WHERE seqCode=? AND nextStartId<?",
                    requiredNextStartId,
                    target.sequenceCode(),
                    requiredNextStartId);
        }
    }

    private Path locateRoot() {
        Path current = Path.of(System.getProperty("user.dir")).toAbsolutePath();
        while (current != null) {
            if (Files.isRegularFile(current.resolve("settings.gradle"))
                    && Files.isDirectory(current.resolve("apps/ai-factiory"))) {
                return current;
            }
            current = current.getParent();
        }
        throw new IllegalStateException("无法定位 SELPLAT 工程根");
    }

    /**
     * 描述一个业务主键列与其唯一号段编码的固定迁移关系。
     *
     * @param sequenceCode 号段编码，例如 {@code AiRoleId}
     * @param tableName 固定业务表名，例如 {@code AiRole}
     * @param columnName 固定主键列名，例如 {@code id}
     */
    private record SequenceTarget(String sequenceCode, String tableName, String columnName) {
    }
}
