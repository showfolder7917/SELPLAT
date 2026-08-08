package com.sp.selplat.uniauth.common.persistence;

import com.sp.selplat.common.exception.CommonSystemException;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import java.nio.file.Files;
import java.nio.file.Path;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;

/**
 * 创建 Uniauth 模块自己的永久数据库连接池并执行可重复初始化脚本。
 * 该数据源属于 Uniauth，不再由 Host 的全局 {@code spring.datasource} 配置间接创建。
 */
@Configuration(proxyBeanMethods = false)
public class UniauthPersistenceConfiguration {

    /**
     * 直接把模块资源中的数据库参数绑定到 Hikari 官方配置对象。
     *
     * @return Uniauth 数据库连接池参数，例如池名 {@code UniauthPool}、最大连接数 {@code 4}
     */
    @Bean("uniauthHikariConfig")
    @ConfigurationProperties(prefix = "uniauth.datasource")
    public HikariConfig uniauthHikariConfig() {
        return new HikariConfig();
    }

    /**
     * 创建并初始化 Uniauth 私有永久数据库。
     *
     * @param config {@code uniauth-module.properties} 或测试资源绑定的 Hikari 参数，例如
     *     {@code {"jdbcUrl":"jdbc:h2:mem:selplat_uniauth_test","password":""}}
     * @return Uniauth 私有连接池；本地默认指向 {@code apps/uniauth/db/uniauth.mv.db}
     * @throws CommonSystemException 当工程根、数据库目录、连接池或初始化脚本处理失败时抛出，例如
     *     {@code CommonSystemException("UNIAUTH_DATABASE_INITIALIZATION_FAILED", "Uniauth 数据库初始化失败。")}
     */
    @Bean(name = "uniauthDataSource", destroyMethod = "close")
    @Primary
    public HikariDataSource uniauthDataSource(
            @Qualifier("uniauthHikariConfig") HikariConfig config) {
        try {
            Path projectRoot = locateProjectRoot(Path.of(System.getProperty("user.dir")));
            Path databaseDirectory = projectRoot.resolve("apps/uniauth/db").normalize();
            Files.createDirectories(databaseDirectory);
            config.setJdbcUrl(resolveUrl(config.getJdbcUrl(), databaseDirectory.resolve("uniauth")));
            HikariDataSource dataSource = new HikariDataSource(config);
            initialize(dataSource);
            return dataSource;
        } catch (Exception exception) {
            throw new CommonSystemException(
                    "UNIAUTH_DATABASE_INITIALIZATION_FAILED",
                    "Uniauth 数据库初始化失败。",
                    exception);
        }
    }

    private String resolveUrl(String configuredUrl, Path defaultFile) {
        if (configuredUrl != null && !configuredUrl.trim().isEmpty()) {
            return configuredUrl.trim();
        }
        return "jdbc:h2:file:" + defaultFile.toAbsolutePath().normalize()
                + ";MODE=MySQL;DATABASE_TO_UPPER=false";
    }

    /**
     * 按表依赖顺序执行 Uniauth 的结构脚本和初始化数据脚本。
     *
     * @param dataSource 已创建的 Uniauth 连接池，例如池名为 {@code UniauthPool} 的内存测试数据源
     *     {@code jdbc:h2:mem:selplat_uniauth_test}
     *     <p>执行成功时无返回值；副作用是创建或补齐三张表，并幂等写入号段、默认租户和管理员账号。
     *     脚本缺失或 SQL 执行失败时由 Spring 数据库初始化器抛出运行时异常，外层统一转换为
     *     {@code UNIAUTH_DATABASE_INITIALIZATION_FAILED}。
     */
    private void initialize(HikariDataSource dataSource) {
        ResourceDatabasePopulator populator = new ResourceDatabasePopulator();
        populator.addScript(new ClassPathResource("db/uniauth/sql/schema-CommonSequenceSegment.sql"));
        populator.addScript(new ClassPathResource("db/uniauth/sql/schema-UniauthTenant.sql"));
        populator.addScript(new ClassPathResource("db/uniauth/sql/schema-UniauthUser.sql"));
        populator.addScript(new ClassPathResource("db/uniauth/sql/data-CommonSequenceSegment.sql"));
        populator.addScript(new ClassPathResource("db/uniauth/sql/data-UniauthTenant.sql"));
        populator.addScript(new ClassPathResource("db/uniauth/sql/data-UniauthUser.sql"));
        populator.execute(dataSource);
    }

    private Path locateProjectRoot(Path startPath) {
        Path currentPath = startPath.toAbsolutePath().normalize();
        while (currentPath != null) {
            if (Files.isRegularFile(currentPath.resolve("settings.gradle"))
                    && Files.isDirectory(currentPath.resolve("apps/uniauth"))) {
                return currentPath;
            }
            currentPath = currentPath.getParent();
        }
        throw new IllegalStateException("无法定位 SELPLAT 工程根");
    }
}
