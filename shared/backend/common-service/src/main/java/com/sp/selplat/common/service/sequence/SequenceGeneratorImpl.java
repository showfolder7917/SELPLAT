package com.sp.selplat.common.service.sequence;

import com.sp.selplat.common.db.sequence.CommonSequenceSegmentDao;
import com.sp.selplat.common.db.sequence.model.CommonSequenceSegmentRange;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import org.springframework.stereotype.Service;

/**
 * 公共发号服务实现通过“数据库抢号段 + JVM 本地缓存发号”组合实现高性能主键分配。
 */
@Service
public class SequenceGeneratorImpl implements SequenceGenerator {

    // MAX_ALLOCATE_RETRY_COUNT 统一限制单次续段最多重试次数，避免并发冲突时无限循环占用线程。
    private static final int MAX_ALLOCATE_RETRY_COUNT = 3;

    // commonSequenceSegmentDao 负责真正向数据库申请下一段可用主键区间。
    private final CommonSequenceSegmentDao commonSequenceSegmentDao;
    // sequenceRangeMap 按号段编码缓存当前 JVM 已领取但尚未发完的主键区间。
    private final ConcurrentMap<String, SequenceRange> sequenceRangeMap = new ConcurrentHashMap<>();
    // sequenceLockMap 按号段编码维护独立锁对象，避免不同模块续段时互相阻塞。
    private final ConcurrentMap<String, Object> sequenceLockMap = new ConcurrentHashMap<>();

    /**
     * 构造公共发号服务实现。
     *
     * @param commonSequenceSegmentDao 公共号段 DAO
     */
    public SequenceGeneratorImpl(CommonSequenceSegmentDao commonSequenceSegmentDao) {
        // 保存公共号段 DAO，供当前发号服务在本地号段耗尽时继续向数据库续段。
        this.commonSequenceSegmentDao = commonSequenceSegmentDao;
    }

    /**
     * 按模块编码获取下一个主键。
     *
     * @param seqCode 模块号段编码
     * @return 下一个可用主键
     */
    @Override
    public Long nextId(String seqCode) {
        // 号段编码为空时立即失败，避免缓存键值和数据库查询条件失去边界。
        if (seqCode == null || seqCode.trim().isEmpty()) {
            throw new IllegalArgumentException("seqCode must not be blank");
        }
        // 统一把外部号段编码收口成去空格后的稳定键，避免同一编码因前后空格产生多份缓存。
        String normalizedSeqCode = seqCode.trim();
        while (true) {
            // 先读取当前 JVM 已缓存的号段，尽量让绝大多数发号请求都只走内存路径。
            SequenceRange currentRange = sequenceRangeMap.get(normalizedSeqCode);
            if (currentRange != null) {
                // 当前段存在时优先直接从内存取号，避免无必要地进入续段锁和数据库访问路径。
                long nextId = currentRange.nextId();
                if (nextId != SequenceRange.NO_AVAILABLE_ID) {
                    return nextId;
                }
            }
            // 当前段不存在或已耗尽时，再进入续段流程向数据库申请新的号段。
            refillSequenceRange(normalizedSeqCode);
        }
    }

    // 当当前号段不存在或已耗尽时，按模块编码申请并缓存一段新的可用主键区间。
    private void refillSequenceRange(String seqCode) {
        // 每个号段编码都维护独立锁对象，确保同一模块续段串行、不同模块续段并行。
        Object sequenceLock = sequenceLockMap.computeIfAbsent(seqCode, key -> new Object());
        synchronized (sequenceLock) {
            // 进入锁后先二次检查当前缓存段是否已被其他线程抢先续好，避免重复访问数据库。
            SequenceRange cachedRange = sequenceRangeMap.get(seqCode);
            if (cachedRange != null && cachedRange.hasAvailable()) {
                return;
            }
            // 按统一重试次数申请下一段号段，兼容多实例并发更新时的乐观锁冲突。
            for (int retryIndex = 0; retryIndex < MAX_ALLOCATE_RETRY_COUNT; retryIndex++) {
                // 向数据库申请下一段号段；若返回空说明本次乐观锁冲突，被其他实例抢先推进了游标。
                CommonSequenceSegmentRange allocatedRange = commonSequenceSegmentDao.allocateNextRange(seqCode);
                if (allocatedRange == null) {
                    continue;
                }
                // 抢号成功后，把当前实例新拿到的号段放进 JVM 缓存，后续请求即可直接走内存发号。
                sequenceRangeMap.put(seqCode, new SequenceRange(allocatedRange.getStartId(), allocatedRange.getEndId()));
                return;
            }
            // 连续多次都申请失败时统一抛错，避免线程无休止重试掩盖数据库或并发配置问题。
            throw new IllegalStateException("allocate sequence range retry exhausted for seqCode: " + seqCode);
        }
    }
}
