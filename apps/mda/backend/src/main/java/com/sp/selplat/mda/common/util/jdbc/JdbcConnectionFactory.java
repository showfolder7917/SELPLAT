package com.sp.selplat.mda.common.util.jdbc;

import java.sql.Connection;
import java.sql.SQLException;
import org.springframework.stereotype.Component;

/**
 * 根据页面保存的配置按需创建目标数据库连接，不把动态连接注册为 Spring 主数据源。
 */
@Component
public class JdbcConnectionFactory {

    private final MdaTargetDataSourceRegistry dataSourceRegistry;

    /**
     * 创建按数据库类型解析驱动和 URL 的动态连接工厂。
     *
     * @param dataSourceRegistry Spring 注入的目标数据源注册表，例如 {@code MdaTargetDataSourceRegistry}
     */
    public JdbcConnectionFactory(MdaTargetDataSourceRegistry dataSourceRegistry) {
        // 注册表负责按有效配置复用隔离连接池，工厂继续保持 SQL 与元数据模块的统一入口。
        this.dataSourceRegistry = dataSourceRegistry;
    }

    /**
     * 借出一个由调用方负责关闭并归还连接池的 JDBC 连接。
     *
     * @param definition Service 在内存中组装的已解密连接配置，例如
     *     {@code {"databaseType":"H2","databaseName":"mem:mda_demo","username":"sa"}}
     * @return 由调用方关闭并归还池的目标库连接，例如 URL 为 {@code jdbc:h2:mem:mda_demo} 的连接
     * @throws SQLException 当连接池无法连接目标数据库时抛出，例如 {@code SQLException("Connection refused")}
     * @throws IllegalStateException 当目标数据库驱动未安装时抛出，例如
     *     {@code IllegalStateException("JDBC 驱动未安装：org.postgresql.Driver")}
     */
    public Connection open(MdaConnectionDefinition definition) throws SQLException {
        return dataSourceRegistry.borrow(definition);
    }

    /**
     * 配置成功更新或删除后关闭旧定义对应的目标连接池。
     *
     * @param definition 变更前的旧连接定义，例如旧 URL、账号和口令组合
     * @return 旧池存在并已关闭时返回 {@code true}，尚未使用该配置时返回 {@code false}
     */
    public boolean invalidate(MdaConnectionDefinition definition) {
        return dataSourceRegistry.invalidate(definition);
    }

    /**
     * 返回当前目标池数量，供运行状态和真实连接复用验证使用。
     *
     * @return 当前目标池数量，例如同一目标连接连续查询后为 {@code 1}
     */
    public int activePoolCount() {
        return dataSourceRegistry.activePoolCount();
    }
}
