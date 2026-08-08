package com.sp.selplat.mda.targetdatabase.common.jdbc;

import com.sp.selplat.mda.targetdatabase.common.config.MdaTargetPoolProperties;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import jakarta.annotation.PreDestroy;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 按有效目标连接定义维护相互隔离的 Hikari 小型连接池。
 * 页面请求归还的是逻辑连接；配置变更、长期闲置或应用停止时才关闭对应物理连接池。
 */
@Component
public class MdaTargetDataSourceRegistry implements AutoCloseable {

    private final JdbcDriverRegistry driverRegistry;
    private final MdaTargetPoolProperties properties;
    private final Map<MdaConnectionDefinition, PoolEntry> pools = new ConcurrentHashMap<>();
    private final AtomicLong poolSequence = new AtomicLong();

    /**
     * 创建目标数据源注册表。
     *
     * @param driverRegistry 数据库类型到驱动和 URL 的注册表，例如 {@code H2 -> org.h2.Driver}
     * @param properties 目标池配置，例如 {@code {"maximumPoolSize":3,"registryIdleTimeoutMs":900000}}
     */
    public MdaTargetDataSourceRegistry(
            JdbcDriverRegistry driverRegistry,
            MdaTargetPoolProperties properties) {
        this.driverRegistry = driverRegistry;
        this.properties = properties;
    }

    /**
     * 从当前定义对应的连接池借出一个逻辑连接。
     *
     * @param definition 页面选择的目标连接定义，例如
     *     {@code {"databaseType":"H2","databaseName":"mem:mda_demo","username":"sa"}}
     * @return 调用方关闭后归还池的连接，例如 {@code HikariProxyConnection}
     * @throws SQLException 当目标库拒绝连接或连接超时时抛出，例如 {@code SQLException("Connection refused")}
     */
    public Connection borrow(MdaConnectionDefinition definition) throws SQLException {
        while (true) {
            PoolEntry entry = pools.computeIfAbsent(definition, this::createPool);
            try {
                // 借出前刷新最后使用时间；try-with-resources 关闭后连接回到同一个目标池。
                return entry.borrow();
            } catch (PoolClosedException exception) {
                // 闲置清理与新请求竞争时移除已关闭条目，再为同一配置创建新池。
                pools.remove(definition, entry);
            }
        }
    }

    /**
     * 使旧目标连接定义立即失效。
     *
     * @param definition 更新或删除前的旧配置，例如旧密码对应的连接定义
     * @return 是否找到并关闭旧池，例如池存在时返回 {@code true}
     */
    public boolean invalidate(MdaConnectionDefinition definition) {
        if (definition == null) {
            return false;
        }
        PoolEntry entry = pools.remove(definition);
        if (entry == null) {
            return false;
        }
        entry.close();
        return true;
    }

    /**
     * 按配置周期清理长期没有借出且当前没有活动连接的目标池。
     *
     * @return 本次关闭的池数量，例如 {@code 2}
     */
    @Scheduled(fixedDelayString = "${mda.target.pool.cleanup-interval-ms:60000}")
    public int closeIdlePools() {
        long now = System.nanoTime();
        long timeoutNanos = properties.getRegistryIdleTimeoutMs() * 1_000_000L;
        int closedCount = 0;
        for (Map.Entry<MdaConnectionDefinition, PoolEntry> candidate : pools.entrySet()) {
            PoolEntry entry = candidate.getValue();
            if (entry.closeIfIdle(now, timeoutNanos)
                    && pools.remove(candidate.getKey(), entry)) {
                closedCount++;
            }
        }
        return closedCount;
    }

    /**
     * 返回当前仍登记的目标连接池数量，供运行诊断和真实连接复用测试使用。
     *
     * @return 当前池数量，例如同一配置连续借用两次后仍为 {@code 1}
     */
    public int activePoolCount() {
        return pools.size();
    }

    /**
     * 应用停止时关闭全部目标连接池。
     *
     * 实际副作用示例：注册表中有 3 个目标池时，调用后 3 个池全部关闭且数量变为 0。
     */
    @Override
    @PreDestroy
    public void close() {
        pools.values().forEach(PoolEntry::close);
        pools.clear();
    }

    private PoolEntry createPool(MdaConnectionDefinition definition) {
        JdbcDriverRegistry.JdbcTarget target = driverRegistry.resolve(definition);
        try {
            // 创建池前显式验证离线驱动，缺失时返回数据库类型对应的明确错误。
            Class.forName(target.driverClass());
        } catch (ClassNotFoundException exception) {
            throw new IllegalStateException("JDBC 驱动未安装：" + target.driverClass(), exception);
        }
        HikariConfig config = new HikariConfig();
        config.setPoolName("MdaTargetPool-" + poolSequence.incrementAndGet());
        config.setDriverClassName(target.driverClass());
        config.setJdbcUrl(target.jdbcUrl());
        config.setUsername(definition.username());
        config.setPassword(definition.password());
        config.setAutoCommit(definition.defaultAutoCommit());
        config.setMinimumIdle(properties.getMinimumIdle());
        config.setMaximumPoolSize(properties.getMaximumPoolSize());
        config.setConnectionTimeout(properties.getConnectionTimeoutMs());
        config.setIdleTimeout(properties.getIdleTimeoutMs());
        config.setMaxLifetime(properties.getMaxLifetimeMs());
        return new PoolEntry(new HikariDataSource(config));
    }

    /** 保存一个池及其最后借用时间，串行处理借用与关闭的竞争。 */
    private static final class PoolEntry {

        private final HikariDataSource dataSource;
        private long lastBorrowNanos = System.nanoTime();
        private boolean closed;

        private PoolEntry(HikariDataSource dataSource) {
            this.dataSource = dataSource;
        }

        private synchronized Connection borrow() throws SQLException {
            if (closed) {
                throw new PoolClosedException();
            }
            lastBorrowNanos = System.nanoTime();
            return dataSource.getConnection();
        }

        private synchronized boolean closeIfIdle(long now, long timeoutNanos) {
            if (closed || now - lastBorrowNanos < timeoutNanos) {
                return false;
            }
            if (dataSource.getHikariPoolMXBean().getActiveConnections() > 0) {
                return false;
            }
            close();
            return true;
        }

        private synchronized void close() {
            if (!closed) {
                closed = true;
                dataSource.close();
            }
        }
    }

    /** 表示池在借用瞬间已被闲置清理关闭，调用方应重新登记同一配置。 */
    private static final class PoolClosedException extends SQLException {
    }
}
