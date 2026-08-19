package com.sp.selplat.aifactory.common.persistence;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.transaction.PlatformTransactionManager;

/** 创建 AI 工厂唯一私有数据源，并把本地开发数据放入 OPTION/temp。 */
@Configuration
public class AiFactoryPersistenceConfiguration {

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
     * 真实传参示例：未配置 jdbcUrl 时使用唯一运行根的开发数据库。
     * 真实返回示例：{@code jdbc:h2:file:.../OPTION/temp/ai-factory/服务端开发数据/数据库/aifactory}。
     * 异常或副作用示例：创建目录或执行 SQL 失败时启动中止；不会读取任务正文。
     *
     * @param config 已绑定的连接池参数
     * @return 初始化后的数据源
     * @throws Exception 文件系统或 SQL 初始化失败
     */
    @Bean(name = "aiFactoryDataSource", destroyMethod = "close")
    public HikariDataSource dataSource(@Qualifier("aiFactoryHikariConfig") HikariConfig config)
            throws Exception {
        Path databaseDirectory = locateRoot().resolve("OPTION/temp/ai-factory/服务端开发数据/数据库");
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

    private void initialize(DataSource dataSource) throws Exception {
        ResourceDatabasePopulator populator = new ResourceDatabasePopulator();
        ClassPathResource order = new ClassPathResource("db/aifactory/sql/load-order.txt");
        String text = new String(order.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        for (String line : text.lines().map(String::trim)
                .filter(value -> !value.isEmpty() && !value.startsWith("#")).toList()) {
            populator.addScript(new ClassPathResource(line));
        }
        populator.execute(dataSource);
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
}
