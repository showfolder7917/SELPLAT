package com.sp.selplat.referencedata.common.persistence;

import com.sp.selplat.common.db.datasource.BaseDataSourceContext;
import com.sp.selplat.common.db.sequence.CommonSequenceSegmentDao;
import com.sp.selplat.common.db.sequence.CommonSequenceSegmentDaoImpl;
import com.sp.selplat.common.db.template.BaseTemplateDao;
import com.sp.selplat.common.db.template.BaseTemplateMapper;
import com.sp.selplat.common.exception.CommonSystemException;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import java.nio.file.Files;
import java.nio.file.Path;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.PropertySource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.transaction.PlatformTransactionManager;
import org.apache.ibatis.mapping.Environment;
import org.apache.ibatis.session.SqlSessionFactory;
import org.apache.ibatis.session.SqlSessionFactoryBuilder;
import org.mybatis.spring.SqlSessionTemplate;
import org.mybatis.spring.transaction.SpringManagedTransactionFactory;

/**
 * 创建 reference-data 自己的永久文件数据库并执行可重复初始化脚本。
 * 数据源使用模块限定名且不标记为 Primary，避免改变 Host 中其他应用的数据源选择。
 */
@Configuration(proxyBeanMethods = false)
@PropertySource("classpath:reference-data-module.properties")
public class ReferenceDataPersistenceConfiguration {

    // 数据库脚本按类型表、树节点表和类型初始数据的固定职责顺序执行，避免依赖文件系统遍历顺序。
    private static final String[] DATABASE_RESOURCES = {
        "db/reference-data/sql/schema-CommonSequenceSegment.sql",
        "db/reference-data/sql/schema-ReferenceDataType.sql",
        "db/reference-data/sql/schema-ReferenceDataTreeNode.sql",
        "db/reference-data/sql/schema-ReferenceDataOption.sql",
        "db/reference-data/sql/schema-ReferenceDataContextMenuItem.sql",
        "db/reference-data/sql/schema-ReferenceDataTable.sql",
        "db/reference-data/sql/schema-ReferenceDataTableColumn.sql",
        "db/reference-data/sql/data-CommonSequenceSegment.sql",
        "db/reference-data/sql/data-ReferenceDataType.sql",
        "db/reference-data/sql/data-ReferenceDataTreeNode.sql",
        "db/reference-data/sql/data-ReferenceDataOption.sql",
        "db/reference-data/sql/data-ReferenceDataContextMenuItem.sql",
        "db/reference-data/sql/data-ReferenceDataTable.sql",
        "db/reference-data/sql/data-ReferenceDataTableColumn.sql"
    };
    // 旧正式库的业务表曾使用 identity；只按固定白名单迁移，禁止动态拼接外部表名。
    private static final String[] BUSINESS_TABLES = {
        "ReferenceDataType",
        "ReferenceDataTreeNode",
        "ReferenceDataOption",
        "ReferenceDataContextMenuItem",
        "ReferenceDataTable",
        "ReferenceDataTableColumn"
    };

    /**
     * 把模块资源中的私有数据库参数绑定到 Hikari 官方配置对象。
     *
     * @return Reference Data 连接池参数，例如
     *     {@code {"poolName":"ReferenceDataPool","maximumPoolSize":4}}
     * 异常或副作用示例：该方法只创建未启动的配置对象，不打开数据库连接。
     */
    @Bean("referenceDataHikariConfig")
    @ConfigurationProperties(prefix = "reference-data.datasource")
    public HikariConfig referenceDataHikariConfig() {
        // 模块 properties → Hikari 标准参数；连接池的创建和关闭仍由下一个具名 Bean 管理。
        return new HikariConfig();
    }

    /**
     * 创建并初始化 reference-data 独立 Hikari 连接池。
     *
     * @param config 模块资源或隔离测试绑定的 Hikari 参数，例如
     *     {@code {"jdbcUrl":"jdbc:h2:mem:reference_data_test","poolName":"ReferenceDataTestPool"}}
     * @return 可注入 DAO 的模块私有连接池；本地默认指向
     *     {@code apps/reference-data/db/reference-data.mv.db}
     * @throws CommonSystemException 当工程根、目录、连接池或数据库脚本无法初始化时抛出，例如
     *     {@code CommonSystemException("REFERENCE_DATA_DATABASE_INITIALIZATION_FAILED", "引用数据数据库初始化失败。", cause)}
     */
    @Bean(name = "referenceDataDataSource", destroyMethod = "close")
    public HikariDataSource referenceDataDataSource(
            @Qualifier("referenceDataHikariConfig") HikariConfig config) {
        HikariDataSource dataSource = null;
        try {
            // 测试显式 URL 或工程永久路径 → 连接池唯一 JDBC 地址。
            config.setJdbcUrl(resolveDatabaseUrl(config.getJdbcUrl()));
            // HikariConfig → 模块私有连接池；具名 Bean 保证 Host 不按类型误选其他项目数据源。
            dataSource = new HikariDataSource(config);
            // 固定 SQL 清单依次执行 → 创建缺失结构并幂等补充表格定义演示数据与六表号段。
            initializeDatabase(dataSource);
            // 初始化完成的连接池 → DAO、号段和 BaseDataSourceContext 共用同一数据库。
            return dataSource;
        } catch (RuntimeException exception) {
            // 初始化中途失败 → 先关闭已经启动的池，避免 Host 重试时残留连接与文件锁。
            if (dataSource != null) {
                dataSource.close();
            }
            // 路径、驱动或 SQL 初始化失败 → 保留技术原因并输出稳定系统异常。
            throw new CommonSystemException(
                    "REFERENCE_DATA_DATABASE_INITIALIZATION_FAILED",
                    "引用数据数据库初始化失败。",
                    exception);
        }
    }

    /**
     * 创建只访问 reference-data 永久库的 JDBC 模板。
     *
     * @param dataSource 带限定名的 reference-data 模块私有数据源
     * @return ReferenceDataType 自定义查询使用的 JDBC 模板
     */
    @Bean("referenceDataJdbcTemplate")
    public JdbcTemplate referenceDataJdbcTemplate(
            @Qualifier("referenceDataDataSource") DataSource dataSource) {
        // 模块私有数据源 → DAO 自定义查询使用的唯一 JDBC 模板。
        return new JdbcTemplate(dataSource);
    }

    /**
     * 创建 Reference Data 永久库专用事务管理器，避免 Host 多数据源运行时误选其他应用数据库。
     *
     * @param dataSource Reference Data 模块私有连接池，例如池名 {@code ReferenceDataPool}
     * @return 只提交或回滚 Reference Data 六张业务表操作的事务管理器
     * 异常或副作用示例：页面列宽批量更新中任一列未命中时，管理器回滚同批次已经执行的更新。
     */
    @Bean("referenceDataTransactionManager")
    public PlatformTransactionManager referenceDataTransactionManager(
            @Qualifier("referenceDataDataSource") DataSource dataSource) {
        return new DataSourceTransactionManager(dataSource);
    }

    /**
     * 创建只在 reference-data 私有数据库中查询和推进号段的项目 DAO。
     *
     * @param dataSource reference-data 配置按限定名提供的私有数据源
     * @return 可分别命中六张业务表号段的 DAO，例如命中 {@code ReferenceDataTypeId}
     * 异常或副作用示例：多个进程并发抢号时只原子推进当前 seqCode 的 nextStartId 和 versionNo。
     */
    @Bean("referenceDataCommonSequenceSegmentDao")
    public CommonSequenceSegmentDao referenceDataCommonSequenceSegmentDao(
            @Qualifier("referenceDataDataSource") DataSource dataSource) {
        // reference-data 私有数据源 → 六张业务表号段唯一查询和推进边界。
        return new CommonSequenceSegmentDaoImpl(dataSource);
    }

    /**
     * 绑定 reference-data 永久库与只访问同一数据库的公共模板 DAO。
     *
     * @param dataSource 带限定名的 reference-data 模块私有数据源
     * @return ReferenceDataType 等固定表使用的数据源上下文
     */
    @Bean("referenceDataBaseDataSourceContext")
    public BaseDataSourceContext referenceDataBaseDataSourceContext(
            @Qualifier("referenceDataDataSource") DataSource dataSource) {
        org.apache.ibatis.session.Configuration configuration = new org.apache.ibatis.session.Configuration();
        configuration.setEnvironment(new Environment(
                "reference-data",
                new SpringManagedTransactionFactory(),
                dataSource));
        configuration.addMapper(BaseTemplateMapper.class);
        SqlSessionFactory sqlSessionFactory = new SqlSessionFactoryBuilder().build(configuration);
        SqlSessionTemplate sqlSessionTemplate = new SqlSessionTemplate(sqlSessionFactory);
        BaseTemplateMapper mapper = sqlSessionTemplate.getMapper(BaseTemplateMapper.class);
        return new BaseDataSourceContext(dataSource, new BaseTemplateDao(mapper, dataSource));
    }

    /**
     * 解析测试 URL 或工程内永久数据库路径。
     *
     * @param configuredUrl 配置文件或测试传入的 URL，例如 {@code jdbc:h2:mem:reference_data_test}
     * @return 实际 JDBC URL；本地默认形如
     *     {@code jdbc:h2:file:/workspace/SELPLAT/apps/reference-data/db/reference-data;MODE=MySQL}
     */
    private String resolveDatabaseUrl(String configuredUrl) {
        // 显式 URL 主要供隔离测试和部署覆盖，禁止再推导工程目录。
        if (configuredUrl != null && !configuredUrl.trim().isEmpty()) {
            return configuredUrl.trim();
        }
        // 当前进程目录 → 向上识别包含 settings.gradle 和 reference-data 模块的 SELPLAT 根。
        Path projectRoot = locateProjectRoot(Path.of(System.getProperty("user.dir")));
        // 权威数据库目录固定属于 reference-data，服务重启不删除此目录。
        Path databaseDirectory = projectRoot.resolve("apps/reference-data/db").normalize();
        try {
            // 首次启动创建数据目录 → 后续 H2 在相同路径打开已有数据库。
            Files.createDirectories(databaseDirectory);
        } catch (Exception exception) {
            throw new IllegalStateException("无法创建引用数据数据库目录: " + databaseDirectory, exception);
        }
        // 不附加 .mv.db 扩展名，由 H2 按文件数据库约定生成实际数据文件。
        Path databaseFile = databaseDirectory.resolve("reference-data").toAbsolutePath().normalize();
        return "jdbc:h2:file:" + databaseFile
                + ";MODE=MySQL;DATABASE_TO_UPPER=false";
    }

    /**
     * 从当前工作目录向上定位唯一 SELPLAT 工程根。
     *
     * @param startPath Java 进程当前目录，例如 {@code apps/host/backend}
     * @return 同时包含 {@code settings.gradle} 与 {@code apps/reference-data} 的工程根路径
     * @throws IllegalStateException 当向上遍历仍无法定位工程根时抛出，例如
     *     {@code IllegalStateException("无法定位 SELPLAT 工程根")}
     */
    private Path locateProjectRoot(Path startPath) {
        // 从真实绝对目录开始逐级向上，避免依赖机器固定绝对路径。
        Path currentPath = startPath.toAbsolutePath().normalize();
        while (currentPath != null) {
            // 根构建入口与目标应用同时存在 → 当前目录是唯一工程根。
            if (Files.isRegularFile(currentPath.resolve("settings.gradle"))
                    && Files.isDirectory(currentPath.resolve("apps/reference-data"))) {
                return currentPath;
            }
            // 未命中时检查父目录，直到文件系统根为止。
            currentPath = currentPath.getParent();
        }
        // 无根目录时禁止退回用户目录或临时路径，避免业务数据落到未知位置。
        throw new IllegalStateException("无法定位 SELPLAT 工程根");
    }

    /**
     * 按固定顺序执行 reference-data 建表、号段和表格定义演示数据脚本。
     *
     * @param dataSource 当前独立文件库或隔离测试库
     * 执行结果示例：数据库包含七张表、六条号段、六条表格定义和四十六条可编辑表格列；
     *     再次执行不会覆盖管理员修改。
     */
    private void initializeDatabase(DataSource dataSource) {
        // 固定结构和数据资源清单 → 可重复执行的数据库初始化器。
        ResourceDatabasePopulator populator = new ResourceDatabasePopulator();
        for (String databaseResource : DATABASE_RESOURCES) {
            // 每个职责脚本按数组顺序加入，禁止把多张表重新合并到同一个 SQL 文件。
            populator.addScript(new ClassPathResource(databaseResource));
        }
        // 当前数据源执行完整脚本；任一 SQL 失败都会阻止模块以半初始化状态启动。
        populator.execute(dataSource);
        // 已有正式库可能仍保留旧 identity 元数据 → 数据保留不变，只移除业务表自增属性。
        migrateLegacyIdentityColumns(dataSource);
    }

    /**
     * 把旧正式库业务表的 identity 主键原地迁移为公共号段主键。
     *
     * @param dataSource 当前 reference-data 私有数据源，例如旧库中 ReferenceDataType.id 仍为 identity
     * 执行结果示例：六张表的现有 id 和外键保持不变，IS_IDENTITY 统一变为 NO
     * 异常或副作用示例：ALTER 失败时数据库初始化整体失败，不会创建替代表或重写已有记录。
     */
    private void migrateLegacyIdentityColumns(DataSource dataSource) {
        JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);
        for (String tableName : BUSINESS_TABLES) {
            // 固定表名查询元数据 → 只在旧列仍声明 identity 时执行一次兼容 ALTER。
            Integer identityCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS "
                            + "WHERE TABLE_SCHEMA = 'PUBLIC' AND TABLE_NAME = ? "
                            + "AND COLUMN_NAME = 'id' AND IS_IDENTITY = 'YES'",
                    Integer.class,
                    tableName);
            if (identityCount != null && identityCount > 0) {
                // H2 原地删除自增属性；主键值、索引和引用当前 id 的外键均保持不变。
                jdbcTemplate.execute("ALTER TABLE " + tableName + " ALTER COLUMN id DROP IDENTITY");
            }
        }
    }
}
