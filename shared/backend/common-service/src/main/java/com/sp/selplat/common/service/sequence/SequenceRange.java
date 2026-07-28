package com.sp.selplat.common.service.sequence;

/**
 * JVM 本地号段对象用于缓存数据库一次申请到的一段主键区间。
 * 服务层只需反复从这个对象拿下一个主键，不再逐条访问数据库。
 */
public class SequenceRange {

    // NO_AVAILABLE_ID 作为当前号段已耗尽的标记值，供外层统一触发续段逻辑。
    public static final long NO_AVAILABLE_ID = -1L;

    // currentValue 表示当前号段下一次将要发出的主键值。
    private long currentValue;
    // maxValue 表示当前号段最后一个可发出的主键值。
    private final long maxValue;

    /**
     * 创建 JVM 本地号段对象。
     *
     * @param startId 数据库分配的号段起始主键，例如 {@code 100001L}
     * @param endId 数据库分配的号段结束主键，例如 {@code 101000L}
     * @throws IllegalArgumentException 当起始值大于结束值时抛出，例如
     *     {@code IllegalArgumentException("startId must be less than or equal to endId")}
     */
    public SequenceRange(long startId, long endId) {
        // 起止值非法时立即失败，避免把损坏的号段配置放进 JVM 缓存后持续扩散错误主键。
        if (startId > endId) {
            throw new IllegalArgumentException("startId must be less than or equal to endId");
        }
        // 初始化当前游标为当前段起始值，保证第一次发号直接命中本段第一个主键。
        this.currentValue = startId;
        // 固定当前段最大值，让后续 nextId 能快速判断当前号段是否已经发完。
        this.maxValue = endId;
    }

    /**
     * 获取当前号段里的下一个主键。
     *
     * @return 当前号段里的下一个主键，例如首次返回 {@code 100001L}；
     *     当前段耗尽时返回 {@link #NO_AVAILABLE_ID}，即 {@code -1L}
     */
    public synchronized long nextId() {
        // 当前游标超过本段最大值时，说明当前号段已耗尽，交由外层统一续段。
        if (currentValue > maxValue) {
            return NO_AVAILABLE_ID;
        }
        // 先返回当前值，再把游标推进到下一个主键，保证同一段内发号连续递增。
        return currentValue++;
    }

    /**
     * 判断当前号段是否还有剩余主键。
     *
     * @return 当前游标未超过最大值时返回 {@code true}；例如发完 {@code 101000L} 后返回 {@code false}
     */
    public synchronized boolean hasAvailable() {
        // 只要当前游标仍未超过本段最大值，就表示当前段还可以继续发号。
        return currentValue <= maxValue;
    }
}
