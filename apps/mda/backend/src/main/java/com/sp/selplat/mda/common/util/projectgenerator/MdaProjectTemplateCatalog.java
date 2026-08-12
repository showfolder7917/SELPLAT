package com.sp.selplat.mda.common.util.projectgenerator;

import com.sp.selplat.mda.common.util.projectgenerator.MdaProjectNames;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 保存从 Uniauth 提炼的可复用工程模板。
 * 模板只负责稳定目录、分层、注释和默认页面，不读写文件系统。
 */
public final class MdaProjectTemplateCatalog {

    /** 工具类没有实例。 */
    private MdaProjectTemplateCatalog() {
    }

    /**
     * 构建完整新工程的固定文件。
     *
     * @param names 已验证命名，例如 {@code japan/Japan/JapanRegion}
     * @return 相对 apps/japan 的有序文件模板
     */
    public static Map<String, String> projectFiles(MdaProjectNames names) {
        Map<String, String> files = new LinkedHashMap<>();
        String javaRoot = "backend/src/main/java/"
                + names.packageRoot().replace('.', '/') + "/";
        files.put(".selplat-generated-project.json", fill("""
                {
                  "generator": "mda-uniauth-template-v1",
                  "projectName": "@PROJECT@"
                }
                """, names));
        files.put("README.md", fill("""
                # @PROJECT_CLASS@

                由 MDA 创建工程功能根据 Uniauth 固定分层生成。

                - 首个页面：/@PROJECT@/@PROJECT@.html
                - 数据库脚本：db/sql，按 load-order.txt 的显式顺序加载。
                - Java 分层：业务 Controller → 唯一 Service 接口与实现 → DAO → 项目 BaseDao。
                - 默认字段：id、tenantId、lastOperateUserId、sortnum、labelZh、labelJa、labelEn、status、createdAt、updatedAt。
                - 共通职责：common 只生成实际需要的 config 与 persistence；共通能力出现后才进入 util。
                - 扩展能力：ReferenceDataProvider 等框架扩展必须有真实需求后再创建。
                - 冲突保护：仅 MDA 生成器拥有的工程允许追加表，已有目标文件不会被覆盖。
                """, names));
        files.put("build.gradle", fill(
                "// apps/@PROJECT@ 是聚合目录；实际 Java 构建位于 backend。", names));
        files.put("backend/build.gradle", fill(backendBuild(), names));
        files.put(javaRoot + names.projectClass() + "BackendApplication.java",
                fill(applicationJava(), names));
        files.put(javaRoot + "common/config/"
                        + names.projectClass() + "ModuleConfiguration.java",
                fill(moduleConfigurationJava(), names));
        files.put(javaRoot + "common/persistence/"
                        + names.projectClass() + "PersistenceConfiguration.java",
                fill(persistenceJava(), names));
        files.put(javaRoot + "common/persistence/"
                        + names.projectClass() + "BaseDao.java",
                fill(baseDaoJava(), names));
        files.put("backend/src/main/resources/"
                        + names.projectCode() + "-module.properties",
                fill(moduleProperties(), names));
        files.put("backend/src/main/resources/META-INF/spring/"
                        + "org.springframework.boot.autoconfigure.AutoConfiguration.imports",
                names.packageRoot() + ".common.config."
                        + names.projectClass() + "ModuleConfiguration" + System.lineSeparator());
        files.put("backend/src/main/resources/META-INF/selplat-project-tables.list",
                names.tableCode() + "=" + names.actualTableName()
                        + System.lineSeparator());
        files.put("db/sql/schema-CommonSequenceSegment.sql", sequenceSchema());
        files.put("db/sql/data-CommonSequenceSegment.sql",
                sequenceSeed(names) + System.lineSeparator());
        files.put("backend/src/main/resources/db/"
                        + names.projectCode() + "/sql/load-order.txt",
                String.join(System.lineSeparator(),
                        "db/" + names.projectCode()
                                + "/sql/schema-CommonSequenceSegment.sql",
                        "db/" + names.projectCode() + "/sql/schema-"
                                + names.actualTableName() + ".sql",
                        "db/" + names.projectCode() + "/sql/data-"
                                + names.actualTableName() + ".sql",
                        "db/" + names.projectCode()
                                + "/sql/data-CommonSequenceSegment.sql"));
        return files;
    }

    /**
     * 构建一张新业务表及其独立页面。
     *
     * @param names 已验证命名，例如 {@code japan/region/JapanRegion}
     * @param pageCode 首表为工程编码，后续表为表编码
     * @return Controller、Service、DAO、SQL 和 HTML/JS/CSS 文件，不生成未被公共 CRUD 调用的表 Domain
     */
    public static Map<String, String> tableFiles(
            MdaProjectNames names,
            String pageCode) {
        Map<String, String> files = new LinkedHashMap<>();
        String packagePath = "backend/src/main/java/"
                + names.packageRoot().replace('.', '/') + "/";
        String businessPackage = names.tableCode().replace("-", "");
        files.put(packagePath + businessPackage + "/dao/"
                        + names.actualTableName() + "Dao.java",
                fill(daoJava(), names));
        files.put(packagePath + businessPackage + "/dao/"
                        + names.actualTableName() + "DaoImpl.java",
                fill(daoImplJava(), names));
        files.put(packagePath + businessPackage + "/service/"
                        + names.actualTableName() + "Service.java",
                fill(serviceJava(), names));
        files.put(packagePath + businessPackage + "/service/impl/"
                        + names.actualTableName() + "ServiceImpl.java",
                fill(serviceImplJava(), names));
        files.put(packagePath + businessPackage + "/controller/"
                        + names.actualTableName() + "Controller.java",
                fill(controllerJava(), names));
        files.put("db/sql/schema-" + names.actualTableName() + ".sql",
                fill(tableSchema(), names));
        files.put("db/sql/data-" + names.actualTableName() + ".sql",
                "-- " + names.actualTableName()
                        + " 默认不写业务数据，首次打开页面显示空表。\n"
                        + "SELECT 1;\n");
        String staticRoot = "backend/src/main/resources/static/"
                + names.projectCode() + "/" + pageCode;
        files.put(staticRoot + ".html",
                fill(pageHtml(), names).replace("@PAGE@", pageCode));
        files.put(staticRoot + ".js",
                fill(pageJs(), names).replace("@PAGE@", pageCode));
        files.put(staticRoot + ".css", fill(pageCss(), names));
        return files;
    }

    /**
     * 返回当前业务表主键号段初始化语句。
     *
     * @param names 表命名，例如真实表 {@code JapanRegion}
     * @return 仅在号段不存在时插入的幂等 H2 SQL
     * 异常或副作用示例：已有号段的 nextStartId 和 versionNo 不会在应用重启时被模板值覆盖。
     */
    public static String sequenceSeed(MdaProjectNames names) {
        return "INSERT INTO CommonSequenceSegment "
                + "(tenantId, lastOperateUserId, seqCode, seqName, "
                + "nextStartId, stepSize, versionNo, remark, sortnum, status) "
                + "SELECT 1, 1, '" + names.actualTableName()
                + "Id', '" + names.actualTableName()
                + " 主键号段', 100000, 1000, 0, "
                + "'按模块缓存号段生成主键', 10.00, 1 "
                + "WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode = '"
                + names.actualTableName() + "Id');";
    }

    /**
     * 替换模板中的受控命名占位符。
     *
     * @param template Java、SQL、页面或说明模板
     * @param names 已验证命名集合
     * @return 不含受控占位符的完整正文
     */
    private static String fill(
            String template,
            MdaProjectNames names) {
        return template
                .replace("@PROJECT@", names.projectCode())
                .replace("@TABLE@", names.tableCode())
                .replace("@PROJECT_CLASS@", names.projectClass())
                .replace("@TABLE_CLASS@", names.tableClass())
                .replace("@ACTUAL_TABLE@", names.actualTableName())
                .replace("@PACKAGE@", names.packageRoot())
                .replace("@TABLE_PACKAGE@", names.tableCode().replace("-", ""))
                .replace("@JS_SCOPE@", names.projectCode().replace("-", "")
                        + names.tableCode().replace("-", ""));
    }

    /** @return 生成模块的 Gradle 构建模板。 */
    private static String backendBuild() {
        return """
                plugins {
                    id 'application'
                }

                group = 'com.sp.selplat.@PROJECT@'

                dependencies {
                    runtimeOnly project(':shared:frontend:sel-ui')
                    implementation project(':shared:backend:common-core')
                    implementation project(':shared:backend:common-web')
                    implementation project(':shared:backend:common-service')
                    implementation project(':shared:backend:common-db')
                    implementation "org.springframework.boot:spring-boot-starter-web:${springBootVersion}"
                    implementation "org.springframework.boot:spring-boot-starter-jdbc:${springBootVersion}"
                    implementation "org.mybatis.spring.boot:mybatis-spring-boot-starter:${mybatisSpringBootVersion}"
                    runtimeOnly "com.h2database:h2:${h2Version}"
                    testImplementation "org.springframework.boot:spring-boot-starter-test:${springBootVersion}"
                }

                application {
                    mainClass = '@PACKAGE@.@PROJECT_CLASS@BackendApplication'
                }

                tasks.named('processResources') {
                    from('../db/sql') {
                        include '*.sql'
                        into 'db/@PROJECT@/sql'
                    }
                }

                tasks.named('jar') {
                    duplicatesStrategy = DuplicatesStrategy.EXCLUDE
                }
                """;
    }

    /** @return 独立 Spring Boot 启动类模板。 */
    private static String applicationJava() {
        return """
                package @PACKAGE@;

                import org.springframework.boot.SpringApplication;
                import org.springframework.boot.autoconfigure.SpringBootApplication;

                /** 独立启动 @PROJECT_CLASS@ 后端并装配本工程私有数据源。 */
                @SpringBootApplication(scanBasePackages = {
                    "@PACKAGE@",
                    "com.sp.selplat.common.service",
                    "com.sp.selplat.common.web"
                })
                public class @PROJECT_CLASS@BackendApplication {

                    /**
                     * 启动本工程独立 HTTP 进程。
                     *
                     * @param args 启动参数，例如 {@code ["--server.port=8090"]}
                     *     <p>执行后无返回值；副作用是创建 Spring 容器和 H2 连接池。
                     */
                    public static void main(String[] args) {
                        SpringApplication.run(
                                @PROJECT_CLASS@BackendApplication.class,
                                args);
                    }
                }
                """;
    }

    /** @return Host 自动发现模块的配置模板。 */
    private static String moduleConfigurationJava() {
        return """
                package @PACKAGE@.common.config;

                import @PACKAGE@.@PROJECT_CLASS@BackendApplication;
                import org.springframework.boot.autoconfigure.AutoConfiguration;
                import org.springframework.context.annotation.ComponentScan;
                import org.springframework.context.annotation.FilterType;
                import org.springframework.context.annotation.PropertySource;

                /** 让统一 Host 自动发现并装配 @PROJECT_CLASS@ 业务组件。 */
                @AutoConfiguration
                @PropertySource("classpath:@PROJECT@-module.properties")
                @ComponentScan(
                    basePackages = "@PACKAGE@",
                    excludeFilters = @ComponentScan.Filter(
                        type = FilterType.ASSIGNABLE_TYPE,
                        classes = @PROJECT_CLASS@BackendApplication.class
                    )
                )
                public class @PROJECT_CLASS@ModuleConfiguration {
                }
                """;
    }

    /** @return 项目私有持久化配置模板。 */
    private static String persistenceJava() {
        return """
                package @PACKAGE@.common.persistence;

                import com.sp.selplat.common.db.datasource.BaseDataSourceContext;
                import com.sp.selplat.common.db.sequence.CommonSequenceSegmentDao;
                import com.sp.selplat.common.db.sequence.CommonSequenceSegmentDaoImpl;
                import com.sp.selplat.common.db.template.BaseTemplateDao;
                import com.sp.selplat.common.db.template.BaseTemplateMapper;
                import com.zaxxer.hikari.HikariConfig;
                import com.zaxxer.hikari.HikariDataSource;
                import java.nio.charset.StandardCharsets;
                import java.nio.file.Files;
                import java.nio.file.Path;
                import javax.sql.DataSource;
                import org.apache.ibatis.mapping.Environment;
                import org.apache.ibatis.session.SqlSessionFactory;
                import org.apache.ibatis.session.SqlSessionFactoryBuilder;
                import org.mybatis.spring.SqlSessionTemplate;
                import org.mybatis.spring.transaction.SpringManagedTransactionFactory;
                import org.springframework.beans.factory.annotation.Qualifier;
                import org.springframework.boot.context.properties.ConfigurationProperties;
                import org.springframework.context.annotation.Bean;
                import org.springframework.context.annotation.Configuration;
                import org.springframework.core.io.ClassPathResource;
                import org.springframework.jdbc.datasource.DataSourceTransactionManager;
                import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
                import org.springframework.transaction.PlatformTransactionManager;

                /** 创建 @PROJECT_CLASS@ 私有数据源、号段、事务和模板 DAO 上下文。 */
                @Configuration
                public class @PROJECT_CLASS@PersistenceConfiguration {

                    /** @return Hikari 参数，例如池名 {@code @PROJECT_CLASS@Pool}。 */
                    @Bean("@PROJECT@HikariConfig")
                    @ConfigurationProperties(prefix = "@PROJECT@.datasource")
                    public HikariConfig hikariConfig() {
                        return new HikariConfig();
                    }

                    /**
                     * 创建模块私有永久数据源并初始化 SQL。
                     *
                     * @param config 模块连接参数，例如 {@code {poolName:"@PROJECT_CLASS@Pool"}}
                     * @return 已初始化的 Hikari 数据源
                     * @throws Exception 目录或 SQL 失败时抛出；副作用是创建本地数据库
                     */
                    @Bean(name = "@PROJECT@DataSource", destroyMethod = "close")
                    public HikariDataSource dataSource(
                            @Qualifier("@PROJECT@HikariConfig")
                            HikariConfig config) throws Exception {
                        Path databaseDirectory =
                                locateRoot().resolve("apps/@PROJECT@/db");
                        Files.createDirectories(databaseDirectory);
                        if (config.getJdbcUrl() == null
                                || config.getJdbcUrl().isBlank()) {
                            config.setJdbcUrl("jdbc:h2:file:"
                                    + databaseDirectory.resolve("@PROJECT@")
                                            .toAbsolutePath()
                                    + ";MODE=MySQL;DATABASE_TO_UPPER=false");
                        }
                        HikariDataSource dataSource =
                                new HikariDataSource(config);
                        initialize(dataSource);
                        return dataSource;
                    }

                    /**
                     * 创建本工程号段 DAO。
                     *
                     * @param dataSource 本工程私有数据源
                     * @return 可生成 @ACTUAL_TABLE@Id 的号段 DAO
                     */
                    @Bean("@PROJECT@CommonSequenceSegmentDao")
                    public CommonSequenceSegmentDao sequenceDao(
                            @Qualifier("@PROJECT@DataSource")
                            DataSource dataSource) {
                        return new CommonSequenceSegmentDaoImpl(dataSource);
                    }

                    /**
                     * 创建本工程事务管理器。
                     *
                     * @param dataSource 本工程私有数据源
                     * @return 只提交当前数据库的事务管理器
                     */
                    @Bean("@PROJECT@TransactionManager")
                    public PlatformTransactionManager transactionManager(
                            @Qualifier("@PROJECT@DataSource")
                            DataSource dataSource) {
                        return new DataSourceTransactionManager(dataSource);
                    }

                    /**
                     * 绑定同一数据源和模板 DAO。
                     *
                     * @param dataSource 本工程私有数据源
                     * @return DAO 继承链使用的固定上下文
                     */
                    @Bean("@PROJECT@BaseDataSourceContext")
                    public BaseDataSourceContext context(
                            @Qualifier("@PROJECT@DataSource")
                            DataSource dataSource) {
                        org.apache.ibatis.session.Configuration configuration =
                                new org.apache.ibatis.session.Configuration();
                        configuration.setEnvironment(new Environment(
                                "@PROJECT@",
                                new SpringManagedTransactionFactory(),
                                dataSource));
                        configuration.addMapper(BaseTemplateMapper.class);
                        SqlSessionFactory factory =
                                new SqlSessionFactoryBuilder()
                                        .build(configuration);
                        BaseTemplateMapper mapper =
                                new SqlSessionTemplate(factory)
                                        .getMapper(BaseTemplateMapper.class);
                        return new BaseDataSourceContext(
                                dataSource,
                                new BaseTemplateDao(mapper, dataSource));
                    }

                    /**
                     * 按显式顺序执行全部 SQL。
                     *
                     * @param dataSource 本工程私有数据源
                     * @throws Exception 顺序文件或 SQL 失败时抛出；副作用是迁移业务表
                     */
                    private void initialize(DataSource dataSource)
                            throws Exception {
                        ResourceDatabasePopulator populator =
                                new ResourceDatabasePopulator();
                        ClassPathResource order = new ClassPathResource(
                                "db/@PROJECT@/sql/load-order.txt");
                        String text = new String(
                                order.getInputStream().readAllBytes(),
                                StandardCharsets.UTF_8);
                        for (String line : text.lines()
                                .map(String::trim)
                                .filter(value -> !value.isEmpty()
                                        && !value.startsWith("#"))
                                .toList()) {
                            populator.addScript(new ClassPathResource(line));
                        }
                        populator.execute(dataSource);
                    }

                    /**
                     * 定位 SELPLAT 根。
                     *
                     * @return 包含 settings.gradle 和 apps/@PROJECT@ 的目录
                     * @throws IllegalStateException 无法定位时抛出
                     */
                    private Path locateRoot() {
                        Path current = Path.of(System.getProperty("user.dir"))
                                .toAbsolutePath();
                        while (current != null) {
                            if (Files.isRegularFile(
                                    current.resolve("settings.gradle"))
                                    && Files.isDirectory(current.resolve(
                                            "apps/@PROJECT@"))) {
                                return current;
                            }
                            current = current.getParent();
                        }
                        throw new IllegalStateException(
                                "无法定位 SELPLAT 工程根");
                    }
                }
                """;
    }

    /** @return 项目 BaseDao 模板。 */
    private static String baseDaoJava() {
        return """
                package @PACKAGE@.common.persistence;

                import com.sp.selplat.common.db.dao.BaseDaoImpl;
                import com.sp.selplat.common.db.datasource.BaseDataSourceContext;
                import org.springframework.beans.factory.annotation.Autowired;
                import org.springframework.beans.factory.annotation.Qualifier;

                /** 为本工程全部业务 DAO 绑定唯一私有数据库。 */
                public abstract class @PROJECT_CLASS@BaseDao
                        extends BaseDaoImpl {

                    // 子类全部通过此上下文访问 @PROJECT@ 私有数据库。
                    private BaseDataSourceContext context;

                    /**
                     * 注入本工程私有上下文。
                     *
                     * @param context 绑定 apps/@PROJECT@/db 的上下文
                     *     <p>执行后无返回值；副作用是绑定全部 DAO 调用。
                     */
                    @Autowired
                    protected final void setContext(
                            @Qualifier("@PROJECT@BaseDataSourceContext")
                            BaseDataSourceContext context) {
                        this.context = context;
                    }

                    /** @return 本工程数据源和模板 DAO 组合。 */
                    @Override
                    protected final BaseDataSourceContext
                            getDataSourceContext() {
                        return context;
                    }
                }
                """;
    }

    /** @return 模块数据源属性模板。 */
    private static String moduleProperties() {
        return """
                @PROJECT@.datasource.jdbc-url=
                @PROJECT@.datasource.pool-name=@PROJECT_CLASS@Pool
                @PROJECT@.datasource.username=sa
                @PROJECT@.datasource.password=123456
                @PROJECT@.datasource.driver-class-name=org.h2.Driver
                @PROJECT@.datasource.minimum-idle=1
                @PROJECT@.datasource.maximum-pool-size=4
                """;
    }

    /** @return 公共号段表结构模板。 */
    private static String sequenceSchema() {
        return """
                CREATE TABLE IF NOT EXISTS CommonSequenceSegment (
                    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                    tenantId BIGINT NOT NULL,
                    lastOperateUserId BIGINT NOT NULL,
                    seqCode VARCHAR(64) NOT NULL UNIQUE,
                    seqName VARCHAR(128) NOT NULL,
                    nextStartId BIGINT NOT NULL,
                    stepSize INT NOT NULL,
                    versionNo INT NOT NULL DEFAULT 0,
                    remark VARCHAR(255),
                    sortnum DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
                    status INTEGER NOT NULL DEFAULT 1,
                    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                COMMENT ON TABLE CommonSequenceSegment IS '公共主键号段配置表';
                COMMENT ON COLUMN CommonSequenceSegment.id IS '号段配置记录标识';
                COMMENT ON COLUMN CommonSequenceSegment.tenantId IS '数据所属租户标识';
                COMMENT ON COLUMN CommonSequenceSegment.lastOperateUserId IS '最近操作用户标识';
                COMMENT ON COLUMN CommonSequenceSegment.seqCode IS '号段编码';
                COMMENT ON COLUMN CommonSequenceSegment.seqName IS '号段中文名称';
                COMMENT ON COLUMN CommonSequenceSegment.nextStartId IS '下次分配起始主键';
                COMMENT ON COLUMN CommonSequenceSegment.stepSize IS '单次号段长度';
                COMMENT ON COLUMN CommonSequenceSegment.versionNo IS '乐观锁版本号';
                COMMENT ON COLUMN CommonSequenceSegment.remark IS '号段补充说明';
                COMMENT ON COLUMN CommonSequenceSegment.sortnum IS '业务排序值';
                COMMENT ON COLUMN CommonSequenceSegment.status IS '逻辑状态标记';
                COMMENT ON COLUMN CommonSequenceSegment.createdAt IS '数据创建时间';
                COMMENT ON COLUMN CommonSequenceSegment.updatedAt IS '数据更新时间';
                """;
    }

    /**
     * 生成新业务表必须遵循的租户、操作人、排序、多语言标签、状态和时间字段结构。
     *
     * <p>真实返回示例：模板包含 {@code tenantId BIGINT NOT NULL}、
     * {@code labelZh VARCHAR(200) NOT NULL} 和 {@code labelJa/labelEn} 可选字段。
     *
     * <p>异常或副作用示例：本方法只返回未填充占位符的 SQL 文本，不连接数据库也不创建表。
     *
     * @return 含 {@code @ACTUAL_TABLE@} 占位符和全部平台默认字段的幂等建表 SQL
     */
    private static String tableSchema() {
        return """
                CREATE TABLE IF NOT EXISTS @ACTUAL_TABLE@ (
                    id BIGINT PRIMARY KEY,
                    tenantId BIGINT NOT NULL,
                    lastOperateUserId BIGINT NOT NULL,
                    sortnum DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
                    labelZh VARCHAR(200) NOT NULL,
                    labelJa VARCHAR(200),
                    labelEn VARCHAR(200),
                    status INT NOT NULL DEFAULT 1,
                    createdAt TIMESTAMP NOT NULL,
                    updatedAt TIMESTAMP NOT NULL
                );

                COMMENT ON TABLE @ACTUAL_TABLE@ IS '@PROJECT_CLASS@ 工程 @TABLE_CLASS@ 业务表';
                COMMENT ON COLUMN @ACTUAL_TABLE@.id IS '主键，由项目号段生成';
                COMMENT ON COLUMN @ACTUAL_TABLE@.tenantId IS '租户主键';
                COMMENT ON COLUMN @ACTUAL_TABLE@.lastOperateUserId IS '最后操作用户主键';
                COMMENT ON COLUMN @ACTUAL_TABLE@.sortnum IS '人工排序值，升序';
                COMMENT ON COLUMN @ACTUAL_TABLE@.labelZh IS '中文显示标签';
                COMMENT ON COLUMN @ACTUAL_TABLE@.labelJa IS '日文显示标签';
                COMMENT ON COLUMN @ACTUAL_TABLE@.labelEn IS '英文显示标签';
                COMMENT ON COLUMN @ACTUAL_TABLE@.status IS '状态，1 有效、0 已删除';
                COMMENT ON COLUMN @ACTUAL_TABLE@.createdAt IS '创建时间';
                COMMENT ON COLUMN @ACTUAL_TABLE@.updatedAt IS '最后更新时间';
                """;
    }

    /** @return 默认 DAO 接口模板。 */
    private static String daoJava() {
        return """
                package @PACKAGE@.@TABLE_PACKAGE@.dao;

                import com.sp.selplat.common.db.dao.BaseDao;

                /** 标记 @ACTUAL_TABLE@ 公共持久化契约。 */
                public interface @ACTUAL_TABLE@Dao extends BaseDao {
                }
                """;
    }

    /** @return 默认 DAO 实现模板。 */
    private static String daoImplJava() {
        return """
                package @PACKAGE@.@TABLE_PACKAGE@.dao;

                import @PACKAGE@.common.persistence.@PROJECT_CLASS@BaseDao;
                import org.springframework.stereotype.Repository;

                /** 绑定 @ACTUAL_TABLE@ 与本工程私有 BaseDao。 */
                @Repository
                public class @ACTUAL_TABLE@DaoImpl
                        extends @PROJECT_CLASS@BaseDao
                        implements @ACTUAL_TABLE@Dao {
                }
                """;
    }

    /** @return 默认 Service 接口模板。 */
    private static String serviceJava() {
        return """
                package @PACKAGE@.@TABLE_PACKAGE@.service;

                import com.sp.selplat.common.service.BaseService;

                /** 标记 @ACTUAL_TABLE@ 公共 CRUD Service。 */
                public interface @ACTUAL_TABLE@Service extends BaseService {
                }
                """;
    }

    /** @return 默认 Service 实现模板。 */
    private static String serviceImplJava() {
        return """
                package @PACKAGE@.@TABLE_PACKAGE@.service.impl;

                import com.sp.selplat.common.service.BaseServiceImpl;
                import com.sp.selplat.common.util.CommonPageParam;
                import com.sp.selplat.common.util.CommonPageResult;
                import com.sp.selplat.common.util.CommonParam;
                import com.sp.selplat.common.util.CommonResult;
                import @PACKAGE@.@TABLE_PACKAGE@.dao.@ACTUAL_TABLE@Dao;
                import @PACKAGE@.@TABLE_PACKAGE@.service.@ACTUAL_TABLE@Service;
                import java.time.LocalDateTime;
                import org.springframework.stereotype.Service;

                /** 绑定 @ACTUAL_TABLE@ DAO，并维护本表的查询、默认字段和更新时间规则。 */
                @Service
                public class @ACTUAL_TABLE@ServiceImpl
                        extends BaseServiceImpl<@ACTUAL_TABLE@Dao>
                        implements @ACTUAL_TABLE@Service {

                    /**
                     * 查询当前表的有效记录并保持稳定排序。
                     * 真实传参示例：{@code {pageNo:1,pageSize:20,nameLike:"示例"}}。
                     * 真实返回示例：返回 status=1 且按 sortnum、id 升序排列的分页结果。
                     * 异常或副作用示例：数据库查询失败时沿用公共异常；只读当前表。
                     *
                     * @param queryIn 当前表分页和筛选条件
                     * @return 有效记录的稳定分页结果
                     */
                    @Override
                    public CommonPageResult getStore(CommonPageParam queryIn) {
                        CommonPageParam value = queryIn == null
                                ? new CommonPageParam() : queryIn;
                        value.putParam("status", 1);
                        return getDao().getPageList(
                                value.getParamMap(),
                                "sortnum asc id asc",
                                value.getPageNo(),
                                value.getPageSize());
                    }

                    /**
                     * 补齐当前表新增所需的平台默认字段并调用公共新增流程。
                     * 真实传参示例：{@code {labelZh:"示例记录",labelJa:"サンプル"}}。
                     * 真实返回示例：返回含新主键、服务端身份、status=1 和创建更新时间的记录。
                     * 异常或副作用示例：数据库写入失败时抛出公共异常；成功后新增一条记录。
                     *
                     * @param saveIn 当前待新增的业务字段
                     * @return 含生成主键和实际落库字段的公共结果
                     */
                    @Override
                    public CommonResult insert(CommonParam saveIn) {
                        LocalDateTime now = LocalDateTime.now();
                        putIfAbsent(saveIn, "sortnum", 0);
                        putIfAbsent(saveIn, "status", 1);
                        putIfAbsent(saveIn, "createdAt", now);
                        putIfAbsent(saveIn, "updatedAt", now);
                        return super.insert(saveIn);
                    }

                    /**
                     * 刷新当前记录的最后更新时间并调用公共更新流程。
                     * 真实传参示例：{@code {id:100001,labelZh:"修正后的标签"}}。
                     * 真实返回示例：返回包含服务端当前 updatedAt 的更新字段。
                     * 异常或副作用示例：主键无效或数据库失败时抛出公共异常；成功后更新记录。
                     *
                     * @param saveIn 当前表主键和待更新字段
                     * @return 含最终更新时间的公共更新结果
                     */
                    @Override
                    public CommonResult update(CommonParam saveIn) {
                        saveIn.putParam("updatedAt", LocalDateTime.now());
                        return super.update(saveIn);
                    }

                    /**
                     * 只在字段缺失时补入服务端默认值。
                     * 真实传参示例：参数缺少 sortnum，字段名为 sortnum，默认值为 0。
                     * 真实返回示例：执行后参数包含 sortnum=0；已有值时保持原值。
                     * 异常或副作用示例：目标参数为空时调用方产生空指针异常；只修改当前参数映射。
                     *
                     * @param target 当前新增参数
                     * @param key 默认字段名
                     * @param value 缺失时写入的默认值
                     */
                    private void putIfAbsent(CommonParam target, String key, Object value) {
                        if (target.getParam(key) == null) {
                            target.putParam(key, value);
                        }
                    }
                }
                """;
    }

    /** @return 默认 Controller 模板。 */
    private static String controllerJava() {
        return """
                package @PACKAGE@.@TABLE_PACKAGE@.controller;

                import com.sp.selplat.common.web.controller.BaseController;
                import com.sp.selplat.common.web.controller.ModuleDescription;
                import @PACKAGE@.@TABLE_PACKAGE@.service.@ACTUAL_TABLE@Service;
                import org.springframework.http.MediaType;
                import org.springframework.web.bind.annotation.RequestMapping;
                import org.springframework.web.bind.annotation.RestController;

                /** 发布 @ACTUAL_TABLE@ 固定表公共 CRUD。 */
                @RestController
                @ModuleDescription(
                    code = "@PROJECT@-@TABLE@",
                    name = "@TABLE_CLASS@",
                    description = "@ACTUAL_TABLE@ 管理"
                )
                @RequestMapping(
                    value = "/api/@PROJECT@/@TABLE@/",
                    produces = MediaType.APPLICATION_JSON_VALUE
                )
                public class @ACTUAL_TABLE@Controller
                        extends BaseController<@ACTUAL_TABLE@Service> {
                }
                """;
    }

    /**
     * 生成左树右表格页面，并按公共控件中央登记顺序加载 Tree 的 ContextMenu 硬依赖。
     * @return 页面 HTML 模板；例如包含 {@code selContextMenu.js} 后再加载 {@code selTree.js}。
     *     本方法只返回字符串，不写入工程文件；实际写入由项目生成流程统一执行。
     */
    private static String pageHtml() {
        return """
                <!doctype html>
                <!-- 页面只声明挂载点；管理界面由 SEL 公共控件创建。 -->
                <html lang="zh-CN" data-sel-theme="glass-admin" data-sel-mode="dark"
                      data-sel-accent="base" data-sel-density="compact">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <meta name="color-scheme" content="dark light">
                    <title>@PROJECT_CLASS@ · @TABLE_CLASS@</title>
                    <link rel="icon" href="data:,">
                    <link rel="preconnect" href="https://cdn.jsdelivr.net">
                    <link rel="stylesheet"
                          href="https://cdn.jsdelivr.net/npm/remixicon@4.6.0/fonts/remixicon.css">
                    <link rel="stylesheet" href="/sel/core/selBaseReset.css">
                    <link rel="stylesheet" href="/sel/core/selBaseAccessibility.css">
                    <link rel="stylesheet" href="/sel/core/selBaseToast.css">
                    <link rel="stylesheet" href="/sel/theme/contract/selThemeContract.css">
                    <link rel="stylesheet" href="/sel/theme/contract/selThemeStates.css">
                    <link rel="stylesheet" href="/sel/theme/contract/selThemeTypography.css">
                    <link rel="stylesheet" href="/sel/components/panel/selPanel.css">
                    <link rel="stylesheet" href="/sel/components/search/selSearch.css">
                    <link rel="stylesheet" href="/sel/components/context-menu/selContextMenu.css">
                    <link rel="stylesheet" href="/sel/components/tooltip/selTooltip.css">
                    <link rel="stylesheet" href="/sel/components/tree/selTree.css">
                    <link rel="stylesheet" href="/sel/components/dropdown/selDropdownMenu.css">
                    <link rel="stylesheet" href="/sel/components/grid/selGrid.css">
                    <link rel="stylesheet" href="/sel/components/page-background/selPageBackground.css">
                    <link rel="stylesheet" href="/sel/components/window/selWindow.css">
                    <link rel="stylesheet" href="/sel/components/confirm-dialog/selConfirmDialog.css">
                    <link rel="stylesheet" href="/sel/components/floating-panel/selFloatingPanel.css">
                    <link rel="stylesheet" href="/sel/components/personalization/selPersonalization.css">
                    <link rel="stylesheet" href="/sel/theme/packs/crystal-tech/theme.css">
                    <link rel="stylesheet" href="/sel/theme/packs/crystal-tech/modes/dark.css">
                    <link rel="stylesheet" href="/sel/theme/packs/crystal-tech/modes/light.css">
                    <link rel="stylesheet" href="/sel/theme/packs/candy-adventure/theme.css">
                    <link rel="stylesheet" href="/sel/theme/packs/candy-adventure/modes/dark.css">
                    <link rel="stylesheet" href="/sel/theme/packs/candy-adventure/modes/light.css">
                    <link rel="stylesheet" href="/sel/theme/packs/glass-admin/theme.css">
                    <link rel="stylesheet" href="/sel/theme/packs/glass-admin/modes/dark.css">
                    <link rel="stylesheet" href="/sel/theme/packs/glass-admin/modes/light.css">
                    <link rel="stylesheet" href="./@PAGE@.css">
                </head>
                <body>
                    <div data-sel-page-background-host></div>
                    <div data-sel-personalization-host></div>
                    <main class="@PROJECT@-page-stage" data-@PROJECT@-app
                          aria-label="@PROJECT_CLASS@ @TABLE_CLASS@ 管理"></main>

                    <script src="/sel/core/selBaseRuntime.js"></script>
                    <script src="/sel/core/selAjax.js"></script>
                    <script src="/sel/theme/runtime/selThemeRegistry.js"></script>
                    <script src="/sel/theme/packs/crystal-tech/manifest.js"></script>
                    <script src="/sel/theme/packs/candy-adventure/manifest.js"></script>
                    <script src="/sel/theme/packs/glass-admin/manifest.js"></script>
                    <script src="/sel/theme/runtime/selThemeManager.js"></script>
                    <script src="/sel/components/panel/selPanel.js"></script>
                    <script src="/sel/components/search/selSearch.js"></script>
                    <script src="/sel/components/context-menu/selContextMenu.js"></script>
                    <script src="/sel/components/tooltip/selTooltip.js"></script>
                    <script src="/sel/components/tree/selTree.js"></script>
                    <script src="/sel/components/dropdown/selDropdownMenu.js"></script>
                    <script src="/sel/components/grid/selGrid.js"></script>
                    <script src="/sel/components/page-background/selPageBackground.js"></script>
                    <script src="/sel/components/floating-panel/selFloatingPanel.js"></script>
                    <script src="/sel/components/personalization/selPersonalizationRegistry.js"></script>
                    <script src="/sel/components/personalization/selPersonalization.js"></script>
                    <script src="/sel/components/window/selWindow.js"></script>
                    <script src="/sel/components/confirm-dialog/selConfirmDialog.js"></script>
                    <script src="./@PAGE@.js"></script>
                </body>
                </html>
                """;
    }

    /**
     * 生成页面真实接口装配脚本，并在挂载前检查所有登记的公共组件依赖。
     * @return 页面 JavaScript 模板；例如缺少 {@code selContextMenu} 时抛出“缺少 SEL 公共组件”。
     *     本方法只返回字符串，不执行浏览器脚本或业务接口调用。
     */
    private static String pageJs() {
        return """
                /*
                 * @PAGE@.js：用 SEL 公共控件装配 @PROJECT_CLASS@ @TABLE_CLASS@。
                 * 应用层只维护接口、标准 payload 和业务事件，不创建控件内部 DOM。
                 */
                (function @JS_SCOPE@Page() {
                    "use strict";

                    const required = [
                        "selBaseRuntime", "selPanel", "selSearch", "selContextMenu", "selTooltip", "selTree",
                        "selDropdownMenu", "selGrid", "selWindow",
                        "selConfirmDialog", "selPageBackground",
                        "selPersonalization", "selThemeManager"
                    ];
                    const missing = required.filter((name) => !window[name]);
                    if (missing.length > 0) {
                        throw new Error("缺少 SEL 公共组件：" + missing.join("、"));
                    }

                    const root = window.selBaseRuntime.query(
                            "[data-@PROJECT@-app]");
                    const backgroundHost = window.selBaseRuntime.query(
                            "[data-sel-page-background-host]");
                    const personalizationHost = window.selBaseRuntime.query(
                            "[data-sel-personalization-host]");
                    const api = "/api/@PROJECT@/@TABLE@/";
                    const gridId = "@ACTUAL_TABLE@Grid";
                    const editorId = "@ACTUAL_TABLE@Editor";
                    const state = {
                        records: [],
                        treeItems: [],
                        editingId: null,
                        grid: null,
                        editor: null,
                        confirm: null
                    };

                    const layout = Object.freeze({
                        top: Object.freeze([
                            Object.freeze({component: "title", payload: "title"}),
                            Object.freeze({component: "toolbar", children: Object.freeze([
                                Object.freeze({component: "selSearch", payload: "search"}),
                                Object.freeze({component: "filterReset", payload: "title"})
                            ])})
                        ]),
                        left: Object.freeze([
                            Object.freeze({component: "selTree", payload: "tree"})
                        ]),
                        center: Object.freeze([
                            Object.freeze({component: "selGrid", payload: "$aggregate"})
                        ]),
                        right: Object.freeze([]),
                        bottom: Object.freeze([
                            Object.freeze({component: "footer", children: Object.freeze([
                                Object.freeze({component: "gridSummary", payload: "pagination",
                                    children: Object.freeze([Object.freeze({
                                        component: "selDropdownMenu", slot: "pageSize",
                                        payload: "select.pageSize"
                                    })])}),
                                Object.freeze({component: "pagination", payload: "pagination"}),
                                Object.freeze({component: "feedback", payload: "title.messages"})
                            ])})
                        ])
                    });

                    async function request(url, options = {}) {
                        const response = await fetch(url, options);
                        const data = await response.json();
                        if (!response.ok || data.success === false) {
                            throw new Error(data.msg || "请求失败。");
                        }
                        return data;
                    }

                    async function loadRecords() {
                        const data = await request(
                                api + "getStore.htm?pageNo=1&pageSize=100");
                        return Array.isArray(data.records) ? data.records : [];
                    }

                    function loadTree() {
                        return [{
                            id: "@TABLE@-root",
                            label: "全部@TABLE_CLASS@",
                            value: "ALL",
                            children: []
                        }];
                    }

                    function treeItems(items) {
                        return items.map((item) => Object.freeze({
                            id: String(item.id || item.value || "root"),
                            label: String(item.label || "全部@TABLE_CLASS@"),
                            icon: "ri-folder-3-line",
                            count: state.records.length,
                            filter: Object.freeze({}),
                            children: Array.isArray(item.children)
                                ? Object.freeze(treeItems(item.children)) : undefined
                        }));
                    }

                    function payload() {
                        const normalizedTree = treeItems(state.treeItems);
                        return Object.freeze({
                            grid: Object.freeze({mode: "records", idField: "id",
                                statusField: "status",
                                searchFields: Object.freeze(["id", "labelZh", "labelJa", "labelEn"])}),
                            data: Object.freeze({items: Object.freeze([...state.records]),
                                selectedIds: Object.freeze([])}),
                            column: Object.freeze({gridId,
                                ariaLabel: "@TABLE_CLASS@ 表格",
                                emptyText: "暂无@TABLE_CLASS@记录",
                                items: Object.freeze([
                                    Object.freeze({id: "id", field: "id", label: "ID",
                                        renderer: "text", width: "7%"}),
                                    Object.freeze({id: "labelZh", field: "labelZh", label: "中文",
                                        renderer: "text", width: "15%"}),
                                    Object.freeze({id: "labelJa", field: "labelJa", label: "日文",
                                        renderer: "text", width: "15%"}),
                                    Object.freeze({id: "labelEn", field: "labelEn", label: "英文",
                                        renderer: "text", width: "15%"}),
                                    Object.freeze({id: "tenantId", field: "tenantId", label: "租户",
                                        renderer: "text", width: "8%"}),
                                    Object.freeze({id: "sortnum", field: "sortnum", label: "排序",
                                        renderer: "text", width: "7%"}),
                                    Object.freeze({id: "status", field: "status", label: "状态",
                                        renderer: "badge", labelSource: "status", width: "8%"}),
                                    Object.freeze({id: "updatedAt", field: "updatedAt",
                                        label: "更新时间", renderer: "time", nowrap: true,
                                        width: "15%"}),
                                    Object.freeze({id: "actions", field: "id", label: "操作",
                                        renderer: "actions", width: "10%", actions: Object.freeze([
                                            Object.freeze({id: "edit", label: "编辑记录",
                                                icon: "ri-edit-line"}),
                                            Object.freeze({id: "delete", label: "删除记录",
                                                icon: "ri-delete-bin-6-line", tone: "danger"})
                                        ])})
                                ])}),
                            title: Object.freeze({title: "@PROJECT_CLASS@ · @TABLE_CLASS@",
                                subtitle: "SELPLAT GENERATED APPLICATION",
                                description: "左侧引用数据树，右侧业务表格",
                                ariaLabel: "@TABLE_CLASS@ 管理面板",
                                ariaLabels: Object.freeze({statusTabs: "状态统计",
                                    headerActions: "快捷操作", toolbar: "筛选工具栏",
                                    sidebar: "引用数据树", content: "业务列表",
                                    board: "业务表格", pagination: "业务分页"}),
                                statusTabs: Object.freeze([
                                    Object.freeze({value: "", label: "全部",
                                        count: state.records.length})
                                ]),
                                actions: Object.freeze([
                                    Object.freeze({id: "filter", label: "搜索",
                                        icon: "ri-search-line"}),
                                    Object.freeze({id: "new", label: "新增记录",
                                        icon: "ri-add-line", primary: true})
                                ]),
                                resetLabel: "重置",
                                messages: Object.freeze({selectProject: "选择记录",
                                    viewProject: "查看记录", editProject: "编辑记录",
                                    moreActions: "更多操作", filtersReset: "筛选已重置",
                                    treePrefix: "目录", expandLeftRegion: "展开目录",
                                    collapseLeftRegion: "收起目录",
                                    filterActivated: "搜索框已激活",
                                    newOpened: "已打开新增窗口",
                                    exportPreparing: "操作已触发", movePrefix: "移动到"})}),
                            search: Object.freeze({gridId, label: "搜索记录",
                                placeholder: "ID 或名称…", buttonLabel: "查询",
                                clearLabel: "清空搜索条件", icon: "ri-search-line",
                                buttonIcon: "ri-search-line", clearIcon: "ri-close-line",
                                defaultValue: "", clearable: true,
                                submitOnEnter: true, submitOnClear: true,
                                allowEmpty: true, trim: true}),
                            tree: Object.freeze({gridId, ariaLabel: "@TABLE_CLASS@ 引用数据树",
                                heading: "@TABLE_CLASS@ 目录",
                                summary: state.records.length + " 条记录",
                                selectedId: normalizedTree[0]?.id || "root",
                                items: Object.freeze(normalizedTree)}),
                            menu: Object.freeze({gridId, ariaLabel: "记录操作"}),
                            pagination: Object.freeze({gridId, currentPage: 1, pageSize: 20,
                                totalCount: state.records.length,
                                summaryAll: "共 {total} 条",
                                summaryFiltered: "当前 {visible} 条 · 共 {total} 条",
                                previousLabel: "上一页", nextLabel: "下一页",
                                pageChangedMessage: "已切换到第 {page} 页",
                                pageSizeChangedMessage: "每页显示 {size} 条"}),
                            select: Object.freeze({pageSize: Object.freeze({gridId,
                                role: "page-size", label: "每页显示条数",
                                ariaLabel: "每页显示条数",
                                currentTemplate: "{label}，当前：{value}",
                                menuTitle: "选择每页显示条数", scrollAfter: 4,
                                options: Object.freeze([
                                    Object.freeze({value: "10", label: "10 条/页",
                                        icon: "ri-list-check-3"}),
                                    Object.freeze({value: "20", label: "20 条/页",
                                        icon: "ri-list-check-3", selected: true}),
                                    Object.freeze({value: "50", label: "50 条/页",
                                        icon: "ri-list-check-3"})
                                ])})})
                        });
                    }

                    function editorOptions(editing) {
                        return Object.freeze({id: editorId,
                            title: editing ? "编辑@TABLE_CLASS@" : "新增@TABLE_CLASS@",
                            subtitle: "租户与操作员由服务端写入，页面只维护业务字段",
                            closeLabel: "关闭编辑窗口", cancelLabel: "取消",
                            submitLabel: editing ? "保存修改" : "保存记录",
                            validationMessage: "请完成全部必填字段", autoSuccess: false,
                            rows: Object.freeze([
                                Object.freeze([Object.freeze({name: "labelZh", label: "中文标签",
                                    type: "text", icon: "ri-translate-2", required: true,
                                    maxLength: 200})]),
                                Object.freeze([
                                    Object.freeze({name: "labelJa", label: "日文标签",
                                        type: "text", icon: "ri-translate-2", maxLength: 200}),
                                    Object.freeze({name: "labelEn", label: "英文标签",
                                        type: "text", icon: "ri-translate-2", maxLength: 200})
                                ]),
                                Object.freeze([Object.freeze({name: "sortnum", label: "排序",
                                    type: "number", icon: "ri-sort-number-asc", value: "0"})])
                            ])});
                    }

                    function openEditor(item = null) {
                        state.editingId = item?.id || null;
                        state.editor.setLocale(editorOptions(Boolean(item)));
                        state.editor.reset();
                        state.editor.setValues({labelZh: "", labelJa: "", labelEn: "",
                            sortnum: 0, ...(item || {})});
                        state.editor.open();
                    }

                    async function save(values) {
                        state.editor.setLoading(true);
                        try {
                            const editing = Boolean(state.editingId);
                            await request(api + (editing ? "update.htm" : "create.htm"), {
                                method: "POST",
                                headers: {"Content-Type":
                                    "application/x-www-form-urlencoded;charset=UTF-8"},
                                body: new URLSearchParams(editing
                                    ? {...values, id: state.editingId} : values)
                            });
                            state.editor.close();
                            await refresh();
                        } catch (error) {
                            state.editor.setFeedback(error.message, true);
                        } finally {
                            state.editor.setLoading(false);
                        }
                    }

                    async function remove(item) {
                        const confirmed = await state.confirm.open({
                            title: "删除@TABLE_CLASS@", message: "删除后记录将不再显示。",
                            target: String(item.labelZh || item.labelJa || item.labelEn || item.id),
                            tone: "danger",
                            confirmLabel: "确认删除", cancelLabel: "取消"
                        });
                        if (!confirmed) return;
                        await request(api + "delete.htm", {
                            method: "POST",
                            headers: {"Content-Type":
                                "application/x-www-form-urlencoded;charset=UTF-8"},
                            body: new URLSearchParams({id: item.id})
                        });
                        await refresh();
                    }

                    async function refresh() {
                        state.records = await loadRecords();
                        state.treeItems = loadTree();
                        const nextPayload = payload();
                        window.selPanel.setLocale(window.selPanel.get(gridId),
                                {view: nextPayload});
                        state.grid.setLocale(nextPayload);
                    }

                    async function mount() {
                        state.records = await loadRecords();
                        state.treeItems = loadTree();
                        const view = payload();
                        const panel = window.selPanel.create(root, {gridId,
                            sourceId: gridId, entity: "@ACTUAL_TABLE@", view: "list",
                            layout: "single", structure: layout,
                            ariaLabel: view.title.ariaLabel});
                        if (!panel || !window.selPanel.mount(panel, {view})) {
                            throw new Error("SEL 公共面板挂载失败。");
                        }
                        if (!window.selSearch.mount(panel, view.search)
                                || !window.selTree.mount(panel, view.tree)) {
                            throw new Error("SEL 搜索或树控件挂载失败。");
                        }
                        window.selDropdownMenu.mountAll(panel);
                        state.grid = window.selGrid.mount(panel, view);
                        const messages = await request(
                                "/sel/components/window/i18n/zh-CN.json");
                        state.editor = window.selWindow.mount(root,
                                {messages, ...editorOptions(false)});
                        state.confirm = window.selConfirmDialog.mount(root,
                                {id: "@ACTUAL_TABLE@DeleteConfirm"});
                        if (!state.grid || !state.editor || !state.confirm) {
                            throw new Error("SEL 表格或窗口控件挂载失败。");
                        }
                        panel.addEventListener("selGrid:new", () => openEditor());
                        panel.addEventListener("selGrid:action", (event) => {
                            const detail = event.detail;
                            if (!detail || detail.instanceKey !== gridId) return;
                            if (detail.action === "edit") openEditor(detail.record);
                            if (detail.action === "delete") {
                                remove(detail.record).catch(showError);
                            }
                        });
                        root.addEventListener("selWindow:submit", (event) => {
                            if (event.detail?.id === editorId) save(event.detail.values);
                        });
                    }

                    function showError(error) {
                        console.error("@TABLE_CLASS@ 页面操作失败。", error);
                    }

                    const background = window.selPageBackground.mount(backgroundHost,
                            {defaults: Object.freeze({theme: "solid-dark", overlay: 0,
                                brightness: 100, blur: 0})});
                    if (!background || !window.selPersonalization.mount(
                            personalizationHost, {backgroundController: background})) {
                        throw new Error("SEL 主题个性化控件挂载失败。");
                    }
                    mount().catch(showError);
                })();
                """;
    }

    /** @return 工程前缀隔离的页面样式模板。 */
    private static String pageCss() {
        return """
                /* 应用 CSS 只分配 SEL 公共面板的页面舞台，不覆盖控件内部结构。 */
                html {
                    min-width: 1080px;
                    min-height: 100%;
                    background: var(--sel-theme-page-background);
                    scrollbar-color: var(--sel-theme-scrollbar-thumb)
                        var(--sel-theme-scrollbar-track);
                    scrollbar-width: thin;
                }

                body {
                    min-height: 100vh;
                    margin: 0;
                    overflow: auto;
                    color: var(--sel-theme-text-body);
                    background: var(--sel-theme-page-background);
                    font-family: var(--sel-theme-font-family);
                    -webkit-font-smoothing: antialiased;
                    isolation: isolate;
                }

                .@PROJECT@-page-stage {
                    display: grid;
                    width: 100%;
                    min-height: 100vh;
                    box-sizing: border-box;
                    grid-template-columns: minmax(0, 1fr);
                    place-items: center;
                    padding: var(--sel-theme-viewport-gap);
                }

                @media (max-height: 620px) {
                    .@PROJECT@-page-stage {
                        align-items: start;
                    }
                }
                """;
    }
}
