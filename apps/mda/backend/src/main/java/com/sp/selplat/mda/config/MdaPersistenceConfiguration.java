package com.sp.selplat.mda.config;

import com.sp.selplat.common.exception.CommonSystemException;
import com.sp.selplat.mda.persistence.MdaDatabase;
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

/**
 * 创建 MDA 自己的永久控制库和默认查询工作库。
 * 两个连接只封装在 MDA 上下文中，不参与统一宿主的主数据源自动装配。
 */
@Configuration
public class MdaPersistenceConfiguration {

    /**
     * 创建并初始化 MDA 独立数据库上下文。
     *
     * @param configuredControlUrl 测试或部署覆盖的控制库 URL；本地为空时固定到 apps/mda/db/mda
     * @param configuredWorkspaceUrl 测试或部署覆盖的工作库 URL；本地为空时固定到 apps/mda/db/mda-workspace
     * @return MDA 专用 JDBC 上下文；本地实际文件为 mda.mv.db 和 mda-workspace.mv.db
     * @throws CommonSystemException 当路径识别、目录创建或脚本初始化失败时抛出
     */
    @Bean
    public MdaDatabase mdaDatabase(
            @Value("${mda.datasource.url:}") String configuredControlUrl,
            @Value("${mda.workspace.datasource.url:}") String configuredWorkspaceUrl) {
        try {
            Path projectRoot = locateProjectRoot(Path.of(System.getProperty("user.dir")));
            Path databaseDirectory = projectRoot.resolve("apps/mda/db").normalize();
            Files.createDirectories(databaseDirectory);
            String controlUrl = resolveUrl(configuredControlUrl, databaseDirectory.resolve("mda"));
            String workspaceUrl = resolveUrl(configuredWorkspaceUrl, databaseDirectory.resolve("mda-workspace"));
            DataSource controlDataSource = dataSource(controlUrl);
            DataSource workspaceDataSource = dataSource(workspaceUrl);
            initialize(controlDataSource, "schema-mda.sql");
            initialize(workspaceDataSource, "schema-mda-workspace.sql");
            JdbcTemplate control = new JdbcTemplate(controlDataSource);
            seedControlDatabase(control, workspaceUrl);
            return new MdaDatabase(control, new JdbcTemplate(workspaceDataSource), controlUrl, workspaceUrl);
        } catch (Exception exception) {
            throw new CommonSystemException(
                    "MDA_DATABASE_INITIALIZATION_FAILED",
                    "MDA 数据库初始化失败。",
                    exception);
        }
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

    private void seedControlDatabase(JdbcTemplate control, String workspaceUrl) {
        control.update("""
                MERGE INTO MdaConnectionProfile KEY(id) VALUES (
                    10001, 1, 1, 'MDA 本地工作库', 'H2', NULL, NULL,
                    ?, 'PUBLIC', 'sa', '', ?, NULL, TRUE, 10.00, 1,
                    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """, workspaceUrl.substring("jdbc:h2:".length()), workspaceUrl);
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
