package com.sp.selplat.common.db.sequence.model;

/**
 * 号段分配结果对象用于把数据库一次抢到的主键区间交给服务层缓存。
 * 这里显式沉淀开始值、结束值和步长，避免服务层继续自己推导区间边界。
 */
public class CommonSequenceSegmentRange {

    // startId 表示本次抢号成功后当前实例可用的起始主键值。
    private long startId;
    // endId 表示本次抢号成功后当前实例可用的结束主键值。
    private long endId;
    // stepSize 表示当前这段号段一共分配了多少个主键，便于日志和诊断输出。
    private int stepSize;

    /**
     * 获取当前号段起始主键。
     *
     * @return 当前号段起始主键，例如 {@code 100001L}
     */
    public long getStartId() {
        return startId;
    }

    /**
     * 设置当前号段起始主键。
     *
     * @param startId 当前号段起始主键
     */
    public void setStartId(long startId) {
        this.startId = startId;
    }

    /**
     * 获取当前号段结束主键。
     *
     * @return 当前号段结束主键，例如 {@code 101000L}
     */
    public long getEndId() {
        return endId;
    }

    /**
     * 设置当前号段结束主键。
     *
     * @param endId 当前号段结束主键
     */
    public void setEndId(long endId) {
        this.endId = endId;
    }

    /**
     * 获取当前号段步长。
     *
     * @return 当前号段步长，例如 {@code 1000}
     */
    public int getStepSize() {
        return stepSize;
    }

    /**
     * 设置当前号段步长。
     *
     * @param stepSize 当前号段步长
     */
    public void setStepSize(int stepSize) {
        this.stepSize = stepSize;
    }
}
