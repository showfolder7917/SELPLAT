package com.sp.selplat.mda.projectgenerator.template;

import com.sp.selplat.mda.projectgenerator.model.MdaProjectNames;
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
                - Java 分层：Controller → Service → 项目 BaseService → DAO → 项目 BaseDao。
                - 默认字段：id、tenantId、lastOperateUserId、name、sortnum、status、createdAt、updatedAt。
                - 引用数据：每张表的 ReferenceDataProvider 已注册到 reference-data。
                - 冲突保护：仅 MDA 生成器拥有的工程允许追加表，已有目标文件不会被覆盖。
                """, names));
        files.put("build.gradle", fill(
                "// apps/@PROJECT@ 是聚合目录；实际 Java 构建位于 backend。", names));
        files.put("manifest/module.json", fill("""
                {
                  "code": "@PROJECT@",
                  "name": "@PROJECT_CLASS@",
                  "backendModule": "apps:@PROJECT@:backend",
                  "referenceData": true
                }
                """, names));
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
        files.put(javaRoot + "common/service/"
                        + names.projectClass() + "BaseServiceImpl.java",
                fill(baseServiceJava(), names));
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
     * @return Controller、Service、DAO、SQL 和 HTML/JS/CSS 文件
     */
    public static Map<String, String> tableFiles(
            MdaProjectNames names,
            String pageCode) {
        Map<String, String> files = new LinkedHashMap<>();
        String packagePath = "backend/src/main/java/"
                + names.packageRoot().replace('.', '/') + "/"
                + names.tableCode().replace("-", "") + "/";
        files.put(packagePath + "domain/" + names.actualTableName() + ".java",
                fill(domainJava(), names));
        files.put(packagePath + "dao/" + names.actualTableName() + "Dao.java",
                fill(daoJava(), names));
        files.put(packagePath + "dao/" + names.actualTableName() + "DaoImpl.java",
                fill(daoImplJava(), names));
        files.put(packagePath + "service/" + names.actualTableName() + "Service.java",
                fill(serviceJava(), names));
        files.put(packagePath + "service/impl/"
                        + names.actualTableName() + "ServiceImpl.java",
                fill(serviceImplJava(), names));
        files.put(packagePath + "controller/"
                        + names.actualTableName() + "Controller.java",
                fill(controllerJava(), names));
        files.put(packagePath + "reference/"
                        + names.actualTableName() + "ReferenceDataProvider.java",
                fill(referenceProviderJava(), names));
        files.put("db/sql/schema-" + names.actualTableName() + ".sql",
                fill(tableSchema(), names));
        files.put("db/sql/data-" + names.actualTableName() + ".sql",
                "-- " + names.actualTableName()
                        + " 默认不写业务数据，首次打开页面显示空表。");
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
     * @return 可重复执行的 H2 MERGE
     */
    public static String sequenceSeed(MdaProjectNames names) {
        return "MERGE INTO CommonSequenceSegment "
                + "(tenantId, lastOperateUserId, seqCode, seqName, "
                + "nextStartId, stepSize, versionNo, remark, sortnum, status) "
                + "KEY(seqCode) VALUES (1, 1, '" + names.actualTableName()
                + "Id', '" + names.actualTableName()
                + " 主键号段', 100000, 1000, 0, "
                + "'按模块缓存号段生成主键', 10.00, 1);";
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
                    implementation project(':apps:reference-data:backend')
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
                    "com.sp.selplat.common.db",
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

    /** @return 项目 BaseService 模板。 */
    private static String baseServiceJava() {
        return """
                package @PACKAGE@.common.service;

                import com.sp.selplat.common.db.dao.BaseDao;
                import com.sp.selplat.common.service.BaseServiceImpl;
                import com.sp.selplat.common.util.CommonPageParam;
                import com.sp.selplat.common.util.CommonPageResult;
                import com.sp.selplat.common.util.CommonParam;
                import com.sp.selplat.common.util.CommonResult;
                import java.time.LocalDateTime;

                /**
                 * 统一补租户、操作者、排序、状态和日期字段。
                 *
                 * @param <D> 当前表 DAO，例如 {@code @ACTUAL_TABLE@Dao}
                 */
                public abstract class @PROJECT_CLASS@BaseServiceImpl<
                        D extends BaseDao> extends BaseServiceImpl<D> {

                    /**
                     * 查询有效记录并保持稳定排序。
                     *
                     * @param queryIn 分页条件，例如 {@code {pageNo:1,pageSize:20}}
                     * @return status=1 且按 sortnum、id 排序的结果
                     */
                    @Override
                    public CommonPageResult getStore(
                            CommonPageParam queryIn) {
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
                     * 补齐默认字段并生成主键。
                     *
                     * @param saveIn 新增字段，例如 {@code {name:"示例"}}
                     * @return 含固定字段的新增结果
                     */
                    @Override
                    public CommonResult insert(CommonParam saveIn) {
                        LocalDateTime now = LocalDateTime.now();
                        putIfAbsent(saveIn, "tenantId", 1L);
                        putIfAbsent(saveIn, "lastOperateUserId", 1L);
                        putIfAbsent(saveIn, "sortnum", 0);
                        putIfAbsent(saveIn, "status", 1);
                        putIfAbsent(saveIn, "createdAt", now);
                        putIfAbsent(saveIn, "updatedAt", now);
                        return super.insert(saveIn);
                    }

                    /**
                     * 刷新更新时间并更新记录。
                     *
                     * @param saveIn 更新字段，例如 {@code {id:100001,name:"新名称"}}
                     * @return 含更新时间的更新结果
                     */
                    @Override
                    public CommonResult update(CommonParam saveIn) {
                        saveIn.putParam("updatedAt", LocalDateTime.now());
                        return super.update(saveIn);
                    }

                    /**
                     * 只补空字段。
                     *
                     * @param target 当前新增参数
                     * @param key 默认字段名，例如 {@code tenantId}
                     * @param value 默认值，例如 {@code 1L}
                     *     <p>执行后无返回值；已有值保持不变。
                     */
                    private void putIfAbsent(
                            CommonParam target,
                            String key,
                            Object value) {
                        if (target.getParam(key) == null) {
                            target.putParam(key, value);
                        }
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

    /** @return 默认业务表结构模板。 */
    private static String tableSchema() {
        return """
                CREATE TABLE IF NOT EXISTS @ACTUAL_TABLE@ (
                    id BIGINT PRIMARY KEY,
                    tenantId BIGINT NOT NULL,
                    lastOperateUserId BIGINT NOT NULL,
                    name VARCHAR(200) NOT NULL,
                    sortnum DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
                    status INT NOT NULL DEFAULT 1,
                    createdAt TIMESTAMP NOT NULL,
                    updatedAt TIMESTAMP NOT NULL
                );

                COMMENT ON TABLE @ACTUAL_TABLE@ IS '@PROJECT_CLASS@ 工程 @TABLE_CLASS@ 业务表';
                COMMENT ON COLUMN @ACTUAL_TABLE@.id IS '主键，由项目号段生成';
                COMMENT ON COLUMN @ACTUAL_TABLE@.tenantId IS '租户主键';
                COMMENT ON COLUMN @ACTUAL_TABLE@.lastOperateUserId IS '最后操作用户主键';
                COMMENT ON COLUMN @ACTUAL_TABLE@.name IS '业务名称';
                COMMENT ON COLUMN @ACTUAL_TABLE@.sortnum IS '人工排序值，升序';
                COMMENT ON COLUMN @ACTUAL_TABLE@.status IS '状态，1 有效、0 已删除';
                COMMENT ON COLUMN @ACTUAL_TABLE@.createdAt IS '创建时间';
                COMMENT ON COLUMN @ACTUAL_TABLE@.updatedAt IS '最后更新时间';
                """;
    }

    /** @return 默认实体模板。 */
    private static String domainJava() {
        return """
                package @PACKAGE@.@TABLE_PACKAGE@.domain;

                import com.sp.selplat.common.util.Domain;

                /** 承接 @ACTUAL_TABLE@ 默认业务和审计字段。 */
                public class @ACTUAL_TABLE@ extends Domain {

                    // id、tenantId、lastOperateUserId、sortnum、status 和日期字段继承公共 Domain。
                    // name 是脚手架提供的默认业务名称。
                    private String name;

                    /** @return 业务名称，例如 {@code 东京区域}。 */
                    public String getName() {
                        return name;
                    }

                    /** @param name 业务名称，例如 {@code 东京区域}。 */
                    public void setName(String name) {
                        this.name = name;
                    }
                }
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

                import @PACKAGE@.common.service.@PROJECT_CLASS@BaseServiceImpl;
                import @PACKAGE@.@TABLE_PACKAGE@.dao.@ACTUAL_TABLE@Dao;
                import @PACKAGE@.@TABLE_PACKAGE@.service.@ACTUAL_TABLE@Service;
                import org.springframework.stereotype.Service;

                /** 绑定当前表 DAO，默认字段和 CRUD 由项目父类提供。 */
                @Service
                public class @ACTUAL_TABLE@ServiceImpl
                        extends @PROJECT_CLASS@BaseServiceImpl<@ACTUAL_TABLE@Dao>
                        implements @ACTUAL_TABLE@Service {
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

    /** @return reference-data Provider 模板。 */
    private static String referenceProviderJava() {
        return """
                package @PACKAGE@.@TABLE_PACKAGE@.reference;

                import com.sp.selplat.referencedata.backend.provider.ReferenceDataProvider;
                import com.sp.selplat.referencedata.contract.model.ReferenceDataQuery;
                import com.sp.selplat.referencedata.contract.model.TreeNode;
                import com.sp.selplat.referencedata.contract.model.TypeOption;
                import java.util.List;
                import java.util.Map;
                import org.springframework.stereotype.Component;

                /**
                 * 向 reference-data 注册 @PROJECT@/@TABLE@。
                 * 未来树和类型直接在本 Provider 中替换为真实业务查询。
                 */
                @Component
                public class @ACTUAL_TABLE@ReferenceDataProvider
                        implements ReferenceDataProvider {

                    /** @return 工程稳定编码，例如 {@code "@PROJECT@"}。 */
                    @Override
                    public String getProjectCode() {
                        return "@PROJECT@";
                    }

                    /** @return 资源稳定编码，例如 {@code "@TABLE@"}。 */
                    @Override
                    public String getResourceCode() {
                        return "@TABLE@";
                    }

                    /**
                     * 返回页面左侧树的初始根节点。
                     *
                     * @param query 租户和过滤条件，例如 {@code {tenantId:"1"}}
                     * @return 初始根节点；未来替换为真实业务树
                     */
                    @Override
                    public List<TreeNode> loadTree(ReferenceDataQuery query) {
                        return List.of(new TreeNode(
                                "@TABLE@-root",
                                null,
                                "全部@TABLE_CLASS@",
                                "root",
                                List.of(),
                                Map.of()));
                    }

                    /**
                     * 返回默认状态类型。
                     *
                     * @param query 租户和过滤条件，例如 {@code {tenantId:"1"}}
                     * @return 有效和停用两个默认选项
                     */
                    @Override
                    public List<TypeOption> loadOptions(
                            ReferenceDataQuery query) {
                        return List.of(
                                new TypeOption(
                                        "1", "有效", "status",
                                        10, false, Map.of()),
                                new TypeOption(
                                        "0", "停用", "status",
                                        20, false, Map.of()));
                    }
                }
                """;
    }

    /** @return 左树右表格页面模板。 */
    private static String pageHtml() {
        return """
                <!doctype html>
                <!-- @PROJECT_CLASS@ 页面声明左树、右表格和编辑窗口。 -->
                <html lang="zh-CN" data-sel-theme="glass-admin" data-sel-mode="dark">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width,initial-scale=1">
                    <title>@PROJECT_CLASS@ · @TABLE_CLASS@</title>
                    <link rel="stylesheet" href="/sel/core/selBaseReset.css">
                    <link rel="stylesheet" href="/sel/theme/contract/selThemeContract.css">
                    <link rel="stylesheet" href="/sel/theme/packs/glass-admin/theme.css">
                    <link rel="stylesheet" href="/sel/theme/packs/glass-admin/modes/dark.css">
                    <link rel="stylesheet" href="./@PAGE@.css">
                </head>
                <body>
                    <main class="@PROJECT@-page">
                        <header class="@PROJECT@-header">
                            <div>
                                <h1>@PROJECT_CLASS@ · @TABLE_CLASS@</h1>
                                <p>左侧引用数据树，右侧业务表格</p>
                            </div>
                            <div>
                                <button type="button" data-action="refresh">刷新</button>
                                <button type="button" data-action="create">新增记录</button>
                            </div>
                        </header>
                        <section class="@PROJECT@-workspace">
                            <aside>
                                <h2>@TABLE_CLASS@ 树</h2>
                                <nav data-tree></nav>
                            </aside>
                            <section>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>ID</th><th>名称</th><th>租户</th>
                                            <th>排序</th><th>状态</th><th>更新时间</th>
                                            <th>操作</th>
                                        </tr>
                                    </thead>
                                    <tbody data-grid></tbody>
                                </table>
                                <p data-empty hidden>暂无数据，可点击“新增记录”。</p>
                            </section>
                        </section>
                        <dialog data-editor>
                            <form method="dialog">
                                <h2>编辑记录</h2>
                                <input type="hidden" name="id">
                                <label>名称<input name="name" required maxlength="200"></label>
                                <label>租户 ID<input name="tenantId" type="number" value="1" required></label>
                                <label>操作用户 ID<input name="lastOperateUserId" type="number" value="1" required></label>
                                <label>排序<input name="sortnum" type="number" value="0"></label>
                                <menu>
                                    <button value="cancel">取消</button>
                                    <button value="default" data-action="save">保存</button>
                                </menu>
                                <p data-feedback></p>
                            </form>
                        </dialog>
                    </main>
                    <script src="./@PAGE@.js"></script>
                </body>
                </html>
                """;
    }

    /** @return 页面真实接口装配脚本模板。 */
    private static String pageJs() {
        return """
                /*
                 * @PAGE@.js：装配 @PROJECT_CLASS@ @TABLE_CLASS@ 的引用树和业务表格。
                 * 网络错误显式展示，不创建静默兜底数据。
                 */
                (function @JS_SCOPE@Page() {
                    "use strict";

                    const root = document.querySelector(".@PROJECT@-page");
                    const grid = root.querySelector("[data-grid]");
                    const empty = root.querySelector("[data-empty]");
                    const dialog = root.querySelector("[data-editor]");
                    const form = dialog.querySelector("form");
                    const api = "/api/@PROJECT@/@TABLE@/";
                    const treeApi =
                            "/api/reference-data/@PROJECT@/@TABLE@/tree";
                    let records = [];

                    // 统一解析公共成功或异常响应。
                    async function request(url, options = {}) {
                        const response = await fetch(url, {
                            headers: { "Content-Type": "application/json" },
                            ...options
                        });
                        const data = await response.json();
                        if (!response.ok || data.success === false) {
                            throw new Error(data.msg || "请求失败。");
                        }
                        return data;
                    }

                    // 用真实接口记录重绘右侧表格。
                    function render() {
                        grid.replaceChildren(...records.map((item) => {
                            const row = document.createElement("tr");
                            [
                                item.id, item.name, item.tenantId, item.sortnum,
                                item.status === 1 ? "有效" : "停用",
                                item.updatedAt || ""
                            ].forEach((value) => {
                                const cell = document.createElement("td");
                                cell.textContent = String(value ?? "");
                                row.appendChild(cell);
                            });
                            const actions = document.createElement("td");
                            const edit = document.createElement("button");
                            edit.type = "button";
                            edit.textContent = "编辑";
                            edit.addEventListener(
                                    "click", () => openEditor(item));
                            const removeButton =
                                    document.createElement("button");
                            removeButton.type = "button";
                            removeButton.textContent = "删除";
                            removeButton.addEventListener(
                                    "click", () => remove(item));
                            actions.append(edit, removeButton);
                            row.appendChild(actions);
                            return row;
                        }));
                        empty.hidden = records.length > 0;
                    }

                    // 读取当前表前一百条有效记录。
                    async function load() {
                        const data = await request(
                                api + "getStore.htm?pageNo=1&pageSize=100");
                        records = data.records || [];
                        render();
                    }

                    // 从 reference-data 统一路由加载左侧树。
                    async function loadTree() {
                        const data = await request(treeApi + "?tenantId=1");
                        const host = root.querySelector("[data-tree]");
                        const items = Array.isArray(data.data) ? data.data : [];
                        host.replaceChildren(...items.map((item) => {
                            const button = document.createElement("button");
                            button.type = "button";
                            button.textContent = item.label;
                            return button;
                        }));
                    }

                    // 新增使用默认字段，编辑回填真实记录。
                    function openEditor(item = {}) {
                        form.reset();
                        form.elements.id.value = item.id || "";
                        form.elements.name.value = item.name || "";
                        form.elements.tenantId.value = item.tenantId || 1;
                        form.elements.lastOperateUserId.value =
                                item.lastOperateUserId || 1;
                        form.elements.sortnum.value = item.sortnum || 0;
                        dialog.showModal();
                    }

                    // 根据是否存在主键选择新增或更新接口。
                    async function save(event) {
                        event.preventDefault();
                        const values =
                                Object.fromEntries(new FormData(form));
                        const editing = Boolean(values.id);
                        if (!editing) delete values.id;
                        await request(
                                api + (editing ? "update.htm" : "create.htm"),
                                {
                                    method: "POST",
                                    body: JSON.stringify(values)
                                });
                        dialog.close();
                        await load();
                    }

                    // 删除提交主键和固定操作人，由公共 Service 假删除。
                    async function remove(item) {
                        if (!window.confirm(
                                "确认删除“" + item.name + "”？")) return;
                        await request(api + "delete.htm", {
                            method: "POST",
                            body: JSON.stringify({
                                id: item.id,
                                lastOperateUserId: 1
                            })
                        });
                        await load();
                    }

                    root.querySelector("[data-action='refresh']")
                            .addEventListener("click", load);
                    root.querySelector("[data-action='create']")
                            .addEventListener("click", () => openEditor());
                    root.querySelector("[data-action='save']")
                            .addEventListener("click", save);
                    Promise.all([load(), loadTree()]).catch((error) => {
                        root.querySelector("[data-feedback]").textContent =
                                error.message;
                    });
                })();
                """;
    }

    /** @return 工程前缀隔离的页面样式模板。 */
    private static String pageCss() {
        return """
                /* @PROJECT@ 页面样式严格使用工程名前缀。 */
                html,
                body {
                    min-height: 100%;
                    margin: 0;
                    color: #e8f1ff;
                    background: #071326;
                    font-family: Arial, sans-serif;
                }

                .@PROJECT@-page {
                    padding: 24px;
                }

                .@PROJECT@-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 18px;
                    padding: 20px;
                    border: 1px solid #24436b;
                    border-radius: 16px;
                    background: #0d1e36;
                }

                .@PROJECT@-header h1 {
                    margin: 0 0 6px;
                }

                .@PROJECT@-header p {
                    margin: 0;
                    color: #9fb4cf;
                }

                button {
                    margin: 3px;
                    padding: 9px 14px;
                    border: 1px solid #315579;
                    border-radius: 9px;
                    color: #eef7ff;
                    background: #163456;
                    cursor: pointer;
                }

                .@PROJECT@-workspace {
                    display: grid;
                    grid-template-columns: 260px minmax(0, 1fr);
                    gap: 16px;
                    min-height: 620px;
                }

                aside,
                .@PROJECT@-workspace > section {
                    padding: 18px;
                    border: 1px solid #24436b;
                    border-radius: 16px;
                    background: #0d1e36;
                }

                nav button {
                    display: block;
                    width: 100%;
                    text-align: left;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                }

                th,
                td {
                    padding: 11px;
                    border-bottom: 1px solid #213b5d;
                    text-align: left;
                }

                dialog {
                    min-width: 420px;
                    border: 1px solid #315579;
                    border-radius: 14px;
                    color: #e8f1ff;
                    background: #0d1e36;
                }

                dialog form,
                dialog label {
                    display: grid;
                    gap: 12px;
                }

                dialog input {
                    padding: 10px;
                    border: 1px solid #315579;
                    border-radius: 8px;
                    color: #fff;
                    background: #09172a;
                }

                @media (max-width: 900px) {
                    .@PROJECT@-workspace {
                        grid-template-columns: 1fr;
                    }
                }
                """;
    }
}
