package com.sp.selplat.mda.targetdatabase.common.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 接收运行时目标数据库连接池和元数据短缓存配置。
 * 每个有效连接定义使用一份独立小池，避免不同目标库共享账号或事务状态。
 */
@ConfigurationProperties(prefix = "mda.target.pool")
public class MdaTargetPoolProperties {

    private int minimumIdle = 0;
    private int maximumPoolSize = 3;
    private long connectionTimeoutMs = 10000L;
    private long idleTimeoutMs = 300000L;
    private long maxLifetimeMs = 1800000L;
    private long registryIdleTimeoutMs = 900000L;
    private long cleanupIntervalMs = 60000L;
    private long metadataCacheTimeoutMs = 60000L;

    public int getMinimumIdle() {
        return minimumIdle;
    }

    public void setMinimumIdle(int minimumIdle) {
        this.minimumIdle = minimumIdle;
    }

    public int getMaximumPoolSize() {
        return maximumPoolSize;
    }

    public void setMaximumPoolSize(int maximumPoolSize) {
        this.maximumPoolSize = maximumPoolSize;
    }

    public long getConnectionTimeoutMs() {
        return connectionTimeoutMs;
    }

    public void setConnectionTimeoutMs(long connectionTimeoutMs) {
        this.connectionTimeoutMs = connectionTimeoutMs;
    }

    public long getIdleTimeoutMs() {
        return idleTimeoutMs;
    }

    public void setIdleTimeoutMs(long idleTimeoutMs) {
        this.idleTimeoutMs = idleTimeoutMs;
    }

    public long getMaxLifetimeMs() {
        return maxLifetimeMs;
    }

    public void setMaxLifetimeMs(long maxLifetimeMs) {
        this.maxLifetimeMs = maxLifetimeMs;
    }

    public long getRegistryIdleTimeoutMs() {
        return registryIdleTimeoutMs;
    }

    public void setRegistryIdleTimeoutMs(long registryIdleTimeoutMs) {
        this.registryIdleTimeoutMs = registryIdleTimeoutMs;
    }

    public long getCleanupIntervalMs() {
        return cleanupIntervalMs;
    }

    public void setCleanupIntervalMs(long cleanupIntervalMs) {
        this.cleanupIntervalMs = cleanupIntervalMs;
    }

    public long getMetadataCacheTimeoutMs() {
        return metadataCacheTimeoutMs;
    }

    public void setMetadataCacheTimeoutMs(long metadataCacheTimeoutMs) {
        this.metadataCacheTimeoutMs = metadataCacheTimeoutMs;
    }
}
