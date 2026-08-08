package com.sp.selplat.mda.common.persistence;

import com.sp.selplat.common.exception.CommonSystemException;
import com.sp.selplat.common.db.datasource.BaseDataSourceContext;
import com.sp.selplat.common.db.sequence.CommonSequenceSegmentDao;
import com.sp.selplat.common.db.sequence.CommonSequenceSegmentDaoImpl;
import com.sp.selplat.common.db.template.BaseTemplateDao;
import com.sp.selplat.common.db.template.BaseTemplateMapper;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.transaction.PlatformTransactionManager;

/**
 * 创建 MDA 自己的永久控制库。
 * 该连接只封装在 MDA 上下文中，不参与统一宿主的主数据源自动装配。
 */
@Configuration
public class MdaControlPersistenceConfiguration {

    /**
     * 直接把模块资源中的控制库参数绑定到 Hikari 官方配置对象。
     *
     * @return MDA 控制库 Hikari 参数，例如池名 {@code MdaControlPool}、最大连接数 {@code 4}
     */
    @Bean("mdaControlHikariConfig")
    @ConfigurationProperties(prefix = "mda.control.datasource")
    public HikariConfig mdaControlHikariConfig() {
        return new HikariConfig();
    }

    /**
     * 创建并初始化 MDA 模块私有 Hikari 控制库。
     *
     * @param config {@code mda-module.properties} 或测试配置绑定的 Hikari 参数，例如
     *     {@code {"jdbcUrl":"jdbc:h2:mem:selplat_mda_control_test","maximumPoolSize":4}}
     * @return MDA 控制库连接池；本地默认指向 {@code apps/mda/db/mda.mv.db}
     * @throws CommonSystemException 当工程根、数据库目录、连接池或初始化脚本处理失败时抛出，例如
     *     {@code CommonSystemException("MDA_DATABASE_INITIALIZATION_FAILED", "MDA 数据库初始化失败。")}
     */
    @Bean(name = "mdaControlDataSource", destroyMethod = "close")
    public HikariDataSource mdaControlDataSource(
            @Qualifier("mdaControlHikariConfig") HikariConfig config) {
        try {
            Path projectRoot = locateProjectRoot(Path.of(System.getProperty("user.dir")));
            Path databaseDirectory = projectRoot.resolve("apps/mda/db").normalize();
            Files.createDirectories(databaseDirectory);
            config.setJdbcUrl(resolveUrl(config.getJdbcUrl(), databaseDirectory.resolve("mda")));
            HikariDataSource controlDataSource = new HikariDataSource(config);
            initialize(controlDataSource);
            return controlDataSource;
        } catch (Exception exception) {
            throw new CommonSystemException(
                    "MDA_DATABASE_INITIALIZATION_FAILED",
                    "MDA 数据库初始化失败。",
                    exception);
        }
    }

    /**
     * 暴露只访问 MDA 控制库的 JDBC 模板。
     *
     * @param dataSource MDA 模块私有连接池，例如池名 {@code MdaControlPool}
     * @return 可执行连接配置表 SQL 的模板，例如查询 {@code MdaConnectionProfile}
     */
    @Bean("mdaControlJdbcTemplate")
    public JdbcTemplate mdaControlJdbcTemplate(
            @Qualifier("mdaControlDataSource") DataSource dataSource) {
        return new JdbcTemplate(dataSource);
    }

    /**
     * 创建只在 MDA 控制库中查询和推进号段的项目 DAO。
     *
     * @param dataSource MDA 配置按限定名提供的控制库数据源
     * @return MDA 号段 DAO，例如可命中 {@code MdaConnectionProfileId} 且不会访问 Uniauth 数据库
     */
    @Bean("mdaCommonSequenceSegmentDao")
    public CommonSequenceSegmentDao mdaCommonSequenceSegmentDao(
            @Qualifier("mdaControlDataSource") DataSource dataSource) {
        // MDA 控制库数据源 → 连接配置主键号段的唯一数据库入口。
        return new CommonSequenceSegmentDaoImpl(dataSource);
    }

    /**
     * 创建 MDA 控制库专用事务管理器，避免 Host 中多个数据源之间发生误选。
     *
     * @param dataSource MDA 模块私有控制库连接池
     * @return 只提交或回滚 {@code MdaConnectionProfile} 操作的事务管理器
     */
    @Bean("mdaTransactionManager")
    public PlatformTransactionManager mdaTransactionManager(
            @Qualifier("mdaControlDataSource") DataSource dataSource) {
        return new DataSourceTransactionManager(dataSource);
    }

    /**
     * 绑定 MDA 控制库与只访问同一控制库的公共模板 DAO。
     *
     * @param dataSource MDA 永久控制库连接池
     * @return MDA 固定表基础 DAO 使用的数据源与模板 DAO 组合，例如
     *     {@code new BaseDataSourceContext(mdaControlDataSource, mdaBaseTemplateDao)}
     */
    @Bean("mdaBaseDataSourceContext")
    public BaseDataSourceContext mdaBaseDataSourceContext(
            @Qualifier("mdaControlDataSource") DataSource dataSource) {
        org.apache.ibatis.session.Configuration configuration = new org.apache.ibatis.session.Configuration();
        configuration.setEnvironment(new Environment(
                "mda-control",
                new SpringManagedTransactionFactory(),
                dataSource));
        configuration.addMapper(BaseTemplateMapper.class);
        SqlSessionFactory sqlSessionFactory = new SqlSessionFactoryBuilder().build(configuration);
        SqlSessionTemplate sqlSessionTemplate = new SqlSessionTemplate(sqlSessionFactory);
        BaseTemplateMapper mapper = sqlSessionTemplate.getMapper(BaseTemplateMapper.class);
        return new BaseDataSourceContext(dataSource, new BaseTemplateDao(mapper, dataSource));
    }

    private String resolveUrl(String configuredUrl, Path defaultFile) {
        if (configuredUrl != null && !configuredUrl.trim().isEmpty()) {
            return configuredUrl.trim();
        }
        return "jdbc:h2:file:" + defaultFile.toAbsolutePath().normalize()
                + ";MODE=MySQL;DATABASE_TO_UPPER=false";
    }

    /**
     * 按表依赖顺序执行 MDA 控制库的结构脚本和初始化数据脚本。
     *
     * @param dataSource 已创建的 MDA 控制库数据源，例如池名为 {@code MdaControlPool} 的内存测试数据源
     *     {@code jdbc:h2:mem:selplat_mda_test}
     *     <p>执行成功时无返回值；副作用是创建或迁移控制库表、清理已退役默认连接并初始化 MDA 主键号段。
     *     脚本缺失或 SQL 执行失败时由 Spring 数据库初始化器抛出运行时异常，外层统一转换为
     *     {@code MDA_DATABASE_INITIALIZATION_FAILED}。
     */
    private void initialize(DataSource dataSource) {
        ResourceDatabasePopulator populator = new ResourceDatabasePopulator();
        // 先创建号段表，再创建依赖号段的连接配置表。
        populator.addScript(new ClassPathResource("db/mda/sql/schema-CommonSequenceSegment.sql"));
        populator.addScript(new ClassPathResource("db/mda/sql/schema-MdaConnectionProfile.sql"));
        // 先清理连接配置表的已退役默认工作库，再按最终真实主键上界初始化项目号段。
        populator.addScript(new ClassPathResource("db/mda/sql/data-MdaConnectionProfile.sql"));
        populator.addScript(new ClassPathResource("db/mda/sql/data-CommonSequenceSegment.sql"));
        populator.execute(dataSource);
    }

    private Path locateProjectRoot(Path startPath) {
        Path currentPath = startPath.toAbsolutePath().normalize();
        while (currentPath != null) {
            if (Files.isRegularFile(currentPath.resolve("settings.gradle"))
                    && Files.isDirectory(currentPath.resolve("apps/mda"))) {
                return currentPath;
            }
            currentPath = currentPath.getParent();
        }
        throw new IllegalStateException("无法定位 SELPLAT 工程根");
    }
}
