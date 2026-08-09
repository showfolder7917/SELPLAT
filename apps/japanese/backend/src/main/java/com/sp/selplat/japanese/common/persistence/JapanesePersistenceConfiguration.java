package com.sp.selplat.japanese.common.persistence;

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

/** 创建 Japanese 私有数据源、号段、事务和模板 DAO 上下文。 */
@Configuration
public class JapanesePersistenceConfiguration {

    /** @return Hikari 参数，例如池名 {@code JapanesePool}。 */
    @Bean("japaneseHikariConfig")
    @ConfigurationProperties(prefix = "japanese.datasource")
    public HikariConfig hikariConfig() {
        return new HikariConfig();
    }

    /**
     * 创建模块私有永久数据源并初始化 SQL。
     *
     * @param config 模块连接参数，例如 {@code {poolName:"JapanesePool"}}
     * @return 已初始化的 Hikari 数据源
     * @throws Exception 目录或 SQL 失败时抛出；副作用是创建本地数据库
     */
    @Bean(name = "japaneseDataSource", destroyMethod = "close")
    public HikariDataSource dataSource(
            @Qualifier("japaneseHikariConfig")
            HikariConfig config) throws Exception {
        Path databaseDirectory =
                locateRoot().resolve("apps/japanese/db");
        Files.createDirectories(databaseDirectory);
        if (config.getJdbcUrl() == null
                || config.getJdbcUrl().isBlank()) {
            config.setJdbcUrl("jdbc:h2:file:"
                    + databaseDirectory.resolve("japanese")
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
     * @return 可生成 JapaneseN2BlueBookQuestionId 的号段 DAO
     */
    @Bean("japaneseCommonSequenceSegmentDao")
    public CommonSequenceSegmentDao sequenceDao(
            @Qualifier("japaneseDataSource")
            DataSource dataSource) {
        return new CommonSequenceSegmentDaoImpl(dataSource);
    }

    /**
     * 创建本工程事务管理器。
     *
     * @param dataSource 本工程私有数据源
     * @return 只提交当前数据库的事务管理器
     */
    @Bean("japaneseTransactionManager")
    public PlatformTransactionManager transactionManager(
            @Qualifier("japaneseDataSource")
            DataSource dataSource) {
        return new DataSourceTransactionManager(dataSource);
    }

    /**
     * 绑定同一数据源和模板 DAO。
     *
     * @param dataSource 本工程私有数据源
     * @return DAO 继承链使用的固定上下文
     */
    @Bean("japaneseBaseDataSourceContext")
    public BaseDataSourceContext context(
            @Qualifier("japaneseDataSource")
            DataSource dataSource) {
        org.apache.ibatis.session.Configuration configuration =
                new org.apache.ibatis.session.Configuration();
        configuration.setEnvironment(new Environment(
                "japanese",
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
                "db/japanese/sql/load-order.txt");
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
     * @return 包含 settings.gradle 和 apps/japanese 的目录
     * @throws IllegalStateException 无法定位时抛出
     */
    private Path locateRoot() {
        Path current = Path.of(System.getProperty("user.dir"))
                .toAbsolutePath();
        while (current != null) {
            if (Files.isRegularFile(
                    current.resolve("settings.gradle"))
                    && Files.isDirectory(current.resolve(
                            "apps/japanese"))) {
                return current;
            }
            current = current.getParent();
        }
        throw new IllegalStateException(
                "无法定位 SELPLAT 工程根");
    }
}
