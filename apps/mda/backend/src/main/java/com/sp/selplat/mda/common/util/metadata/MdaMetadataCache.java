package com.sp.selplat.mda.common.util.metadata;

import com.sp.selplat.mda.common.config.MdaTargetPoolProperties;
import com.sp.selplat.mda.common.util.jdbc.MdaConnectionDefinition;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/**
 * 为目标库结构树保存短时内存结果，减少同一页面重复读取完整 JDBC 元数据。
 * 缓存只保存结构数据，不保存 JDBC 连接；SQL 执行成功后由 SQL 服务主动失效。
 */
@Component
public class MdaMetadataCache {

    private final long timeoutNanos;
    private final Map<MdaConnectionDefinition, CacheEntry> entries = new ConcurrentHashMap<>();

    /**
     * 创建按 MDA 目标池配置控制有效期的元数据缓存。
     *
     * @param properties 目标池配置，例如 {@code {"metadataCacheTimeoutMs":60000}}
     */
    public MdaMetadataCache(MdaTargetPoolProperties properties) {
        this.timeoutNanos = properties.getMetadataCacheTimeoutMs() * 1_000_000L;
    }

    /**
     * 读取尚未过期的目标库结构数据。
     *
     * @param definition 当前目标连接定义，例如 H2 的 {@code mem:mda_dynamic_target}
     * @return 命中时返回包含 {@code nodes} 和 {@code tableCount} 的数据，过期或未缓存时返回空
     */
    public Optional<Object> get(MdaConnectionDefinition definition) {
        CacheEntry entry = entries.get(definition);
        if (entry == null) {
            return Optional.empty();
        }
        if (System.nanoTime() >= entry.expiresAtNanos()) {
            entries.remove(definition, entry);
            return Optional.empty();
        }
        return Optional.of(entry.data());
    }

    /**
     * 保存一次真实 JDBC 元数据读取结果。
     *
     * @param definition 产生该结构结果的目标连接定义
     * @param data 元数据服务构造的数据，例如 {@code {"tableCount":3,"nodes":[...]}}
     * 实际副作用示例：一分钟内再次读取相同定义时直接返回本次数据。
     */
    public void put(MdaConnectionDefinition definition, Object data) {
        entries.put(definition, new CacheEntry(data, System.nanoTime() + timeoutNanos));
    }

    /**
     * 使一个目标连接的结构缓存失效。
     *
     * @param definition SQL 刚执行成功的目标连接定义
     * @return 缓存存在并已删除时返回 {@code true}
     */
    public boolean invalidate(MdaConnectionDefinition definition) {
        return entries.remove(definition) != null;
    }

    /** 保存不可变的缓存内容和单调时钟到期点。 */
    private record CacheEntry(Object data, long expiresAtNanos) {
    }
}
