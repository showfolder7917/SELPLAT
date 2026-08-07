package com.sp.selplat.referencedata.backend.config;

import com.sp.selplat.common.exception.CommonSystemException;
import com.sp.selplat.referencedata.backend.persistence.ReferenceDataDatabase;
import java.nio.file.Files;
import java.nio.file.Path;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.PropertySource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 创建 reference-data 自己的永久文件数据库并执行可重复初始化脚本。
 * 配置不会向 Host 暴露第二个 {@code DataSource} Bean，避免改变其他应用的数据源自动装配。
 */
@Configuration
@PropertySource("classpath:reference-data-module.properties")
public class ReferenceDataPersistenceConfiguration {

    // 数据库脚本按固定版本顺序执行；脚本使用 IF NOT EXISTS 和条件种子保证服务重启安全。
    private static final String[] MIGRATION_RESOURCES = {
        "db/reference-data/migration/V001__create_reference_data_tables.sql",
        "db/reference-data/migration/V002__seed_reference_data_catalog.sql"
    };

    /**
     * 创建并初始化 reference-data 独立数据库上下文。
     *
     * @param configuredUrl 测试或部署环境显式提供的 JDBC URL；空值时定位工程内永久文件库
     * @param username 数据库用户名，例如 {@code "sa"}
     * @param password 数据库密码，本地默认空字符串
     * @return 可注入 Repository 的独立上下文，例如 JDBC URL 指向
     *     {@code apps/reference-data/db/data/reference-data}
     * @throws CommonSystemException 当工程根、目录或数据库脚本无法初始化时抛出，例如
     *     {@code CommonSystemException("REFERENCE_DATA_DATABASE_INITIALIZATION_FAILED", "引用数据数据库初始化失败。", cause)}
     */
    @Bean
    public ReferenceDataDatabase referenceDataDatabase(
            @Value("${reference-data.datasource.url:}") String configuredUrl,
            @Value("${reference-data.datasource.username:sa}") String username,
            @Value("${reference-data.datasource.password:}") String password) {
        try {
            // 测试显式 URL 或工程永久路径 → reference-data 独立 H2 连接地址。
            String databaseUrl = resolveDatabaseUrl(configuredUrl);
            // 独立数据源只保存在本模块上下文对象内部，不参与 Host 主数据源候选。
            DriverManagerDataSource dataSource = new DriverManagerDataSource();
            dataSource.setDriverClassName("org.h2.Driver");
            dataSource.setUrl(databaseUrl);
            dataSource.setUsername(username);
            dataSource.setPassword(password);
            // 版本脚本依次执行 → 创建缺失表并仅补充缺失的内置目录记录。
            initializeDatabase(dataSource);
            // 同一独立数据源 → 查询模板和显式事务模板。
            JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);
            TransactionTemplate transactionTemplate = new TransactionTemplate(
                    new DataSourceTransactionManager(dataSource));
            // 返回不污染 Host DataSource 自动配置的 reference-data 数据库上下文。
            return new ReferenceDataDatabase(jdbcTemplate, transactionTemplate);
        } catch (RuntimeException exception) {
            // 路径、驱动或 SQL 初始化失败 → 保留技术原因并输出稳定系统异常。
            throw new CommonSystemException(
                    "REFERENCE_DATA_DATABASE_INITIALIZATION_FAILED",
                    "引用数据数据库初始化失败。",
                    exception);
        }
    }

    /**
     * 解析测试 URL 或工程内永久数据库路径。
     *
     * @param configuredUrl 配置文件或测试传入的 URL，例如 {@code jdbc:h2:mem:reference_data_test}
     * @return 实际 JDBC URL；本地默认形如
     *     {@code jdbc:h2:file:/workspace/SELPLAT/apps/reference-data/db/data/reference-data;MODE=MySQL}
     */
    private String resolveDatabaseUrl(String configuredUrl) {
        // 显式 URL 主要供隔离测试和部署覆盖，禁止再推导工程目录。
        if (configuredUrl != null && !configuredUrl.trim().isEmpty()) {
            return configuredUrl.trim();
        }
        // 当前进程目录 → 向上识别包含 settings.gradle 和 reference-data 模块的 SELPLAT 根。
        Path projectRoot = locateProjectRoot(Path.of(System.getProperty("user.dir")));
        // 权威数据库目录固定属于 reference-data，服务重启不删除此目录。
        Path databaseDirectory = projectRoot.resolve("apps/reference-data/db/data").normalize();
        try {
            // 首次启动创建数据目录 → 后续 H2 在相同路径打开已有数据库。
            Files.createDirectories(databaseDirectory);
        } catch (Exception exception) {
            throw new IllegalStateException("无法创建引用数据数据库目录: " + databaseDirectory, exception);
        }
        // 不附加 .mv.db 扩展名，由 H2 按文件数据库约定生成实际数据文件。
        Path databaseFile = databaseDirectory.resolve("reference-data").toAbsolutePath().normalize();
        return "jdbc:h2:file:" + databaseFile
                + ";MODE=MySQL;AUTO_SERVER=TRUE;DATABASE_TO_UPPER=false";
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
     * 按版本顺序执行 reference-data 建表与种子脚本。
     *
     * @param dataSource 当前独立文件库或隔离测试库
     * 执行结果示例：数据库包含 {@code ReferenceDataType}、{@code ReferenceDataItem} 和内置
     *     {@code reference-data/resource-kind} 类型。
     */
    private void initializeDatabase(DataSource dataSource) {
        // 固定资源清单 → 可重复执行的数据库初始化器。
        ResourceDatabasePopulator populator = new ResourceDatabasePopulator();
        for (String migrationResource : MIGRATION_RESOURCES) {
            // 每个版本脚本按数组顺序加入，禁止依赖文件系统遍历顺序。
            populator.addScript(new ClassPathResource(migrationResource));
        }
        // 当前数据源执行完整脚本；任一 SQL 失败都会阻止模块以半初始化状态启动。
        populator.execute(dataSource);
    }
}
