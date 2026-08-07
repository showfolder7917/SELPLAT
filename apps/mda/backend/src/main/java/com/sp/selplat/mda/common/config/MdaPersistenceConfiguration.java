package com.sp.selplat.mda.common.config;

import com.sp.selplat.common.exception.CommonSystemException;
import com.sp.selplat.common.db.datasource.BaseDataSourceContext;
import com.sp.selplat.common.db.template.BaseTemplateDao;
import com.sp.selplat.common.db.template.BaseTemplateMapper;
import com.sp.selplat.mda.common.persistence.MdaDatabase;
import java.nio.file.Files;
import java.nio.file.Path;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.apache.ibatis.mapping.Environment;
import org.apache.ibatis.session.SqlSessionFactory;
import org.apache.ibatis.session.SqlSessionFactoryBuilder;
import org.mybatis.spring.SqlSessionTemplate;
import org.mybatis.spring.transaction.SpringManagedTransactionFactory;

/**
 * 创建 MDA 自己的永久控制库。
 * 该连接只封装在 MDA 上下文中，不参与统一宿主的主数据源自动装配。
 */
@Configuration
public class MdaPersistenceConfiguration {

    /**
     * 创建并初始化 MDA 独立数据库上下文。
     *
     * @param configuredControlUrl 测试或部署覆盖的控制库 URL；本地为空时固定到 apps/mda/db/mda
     * @return MDA 专用 JDBC 上下文；本地实际文件为 apps/mda/db/mda.mv.db
     * @throws CommonSystemException 当路径识别、目录创建或脚本初始化失败时抛出
     */
    @Bean
    public MdaDatabase mdaDatabase(@Value("${mda.datasource.url:}") String configuredControlUrl) {
        try {
            Path projectRoot = locateProjectRoot(Path.of(System.getProperty("user.dir")));
            Path databaseDirectory = projectRoot.resolve("apps/mda/db").normalize();
            Files.createDirectories(databaseDirectory);
            String controlUrl = resolveUrl(configuredControlUrl, databaseDirectory.resolve("mda"));
            DataSource controlDataSource = dataSource(controlUrl);
            initialize(controlDataSource, "schema-mda.sql");
            return new MdaDatabase(controlDataSource, new JdbcTemplate(controlDataSource), controlUrl);
        } catch (Exception exception) {
            throw new CommonSystemException(
                    "MDA_DATABASE_INITIALIZATION_FAILED",
                    "MDA 数据库初始化失败。",
                    exception);
        }
    }

    /**
     * 绑定 MDA 控制库与只访问同一控制库的公共模板 DAO。
     *
     * @param database MDA 永久控制库上下文
     * @return MDA 固定表基础 DAO 使用的数据源上下文
     */
    @Bean("mdaBaseDataSourceContext")
    public BaseDataSourceContext mdaBaseDataSourceContext(MdaDatabase database) {
        DataSource dataSource = database.controlDataSource();
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
                + ";MODE=MySQL;AUTO_SERVER=TRUE;DATABASE_TO_UPPER=false";
    }

    private DataSource dataSource(String url) {
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName("org.h2.Driver");
        dataSource.setUrl(url);
        dataSource.setUsername("sa");
        dataSource.setPassword("");
        return dataSource;
    }

    private void initialize(DataSource dataSource, String resource) {
        ResourceDatabasePopulator populator = new ResourceDatabasePopulator(new ClassPathResource(resource));
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
