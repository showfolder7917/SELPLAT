package com.sp.selplat.mda.jdbc;

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

    public JdbcConnectionFactory(JdbcDriverRegistry driverRegistry) {
        this.driverRegistry = driverRegistry;
    }

    /**
     * 打开一个由调用方负责关闭的 JDBC 连接。
     *
     * @param definition 已解密连接配置
     * @return 打开的 JDBC 连接
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
