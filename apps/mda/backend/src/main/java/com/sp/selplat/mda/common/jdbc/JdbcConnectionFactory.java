package com.sp.selplat.mda.common.jdbc;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.Properties;
import org.springframework.stereotype.Component;

/**
 * 根据页面保存的配置按需创建目标数据库连接，不把动态连接注册为 Spring 主数据源。
 */
@Component
public class JdbcConnectionFactory {

    private final JdbcDriverRegistry driverRegistry;

    /**
     * 创建按数据库类型解析驱动和 URL 的动态连接工厂。
     *
     * @param driverRegistry Spring 注入的驱动注册表，例如 {@code JdbcDriverRegistry}
     */
    public JdbcConnectionFactory(JdbcDriverRegistry driverRegistry) {
        // 注册表负责数据库类型到驱动和 URL 的映射，连接工厂只负责加载驱动并打开连接。
        this.driverRegistry = driverRegistry;
    }

    /**
     * 打开一个由调用方负责关闭的 JDBC 连接。
     *
     * @param definition Service 在内存中组装的已解密连接配置，例如
     *     {@code {"databaseType":"H2","databaseName":"mem:mda_demo","username":"sa"}}
     * @return 由调用方关闭的目标库连接，例如 URL 为 {@code jdbc:h2:mem:mda_demo} 的 {@code Connection}
     * @throws SQLException 当 DriverManager 无法连接目标数据库时抛出，例如 {@code SQLException("Connection refused")}
     * @throws IllegalStateException 当目标数据库驱动未安装时抛出，例如
     *     {@code IllegalStateException("JDBC 驱动未安装：org.postgresql.Driver")}
     */
    public Connection open(MdaConnectionDefinition definition) throws SQLException {
        JdbcDriverRegistry.JdbcTarget target = driverRegistry.resolve(definition);
        try {
            // 显式加载驱动，使缺少离线 JAR 时返回可识别错误而不是模糊的无合适驱动异常。
            Class.forName(target.driverClass());
        } catch (ClassNotFoundException exception) {
            throw new IllegalStateException("JDBC 驱动未安装：" + target.driverClass(), exception);
        }
        Properties properties = new Properties();
        if (definition.username() != null) {
            properties.setProperty("user", definition.username());
        }
        if (definition.password() != null) {
            properties.setProperty("password", definition.password());
        }
        // 只把最终 URL 和账号属性交给 DriverManager，目标库连接不会污染 MDA 配置库事务。
        return DriverManager.getConnection(target.jdbcUrl(), properties);
    }
}
