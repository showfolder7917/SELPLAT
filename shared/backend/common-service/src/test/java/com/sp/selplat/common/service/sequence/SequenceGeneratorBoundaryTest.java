package com.sp.selplat.common.service.sequence;

import com.sp.selplat.common.service.sequence.support.SequenceGeneratorTestVerifier;
import org.junit.jupiter.api.Test;

/**
 * 公共发号边界测试只使用真实 H2、生产号段 DAO 和生产发号器，不再手写固定号段替身。
 */
class SequenceGeneratorBoundaryTest {

    /**
     * localCache Case 验证同一真实数据库号段在本地连续发号时只推进一次数据库游标。
     *
     * <p>执行结果示例：当前真实数据库或边界 Case 的全部验证通过。</p>
     */
    @Test
    void localCache() {
        // 当前方法只调用一次真实数据库验证器。
        SequenceGeneratorTestVerifier.verifyRealLocalCache("fixtures/SequenceGeneratorBoundaryTest/localCache.sql");
    }

    /**
     * invalidInput Case 验证非法输入不会推进真实数据库号段。
     *
     * <p>执行结果示例：当前真实数据库或边界 Case 的全部验证通过。</p>
     */
    @Test
    void invalidInput() {
        // 当前方法只调用一次真实数据库验证器。
        SequenceGeneratorTestVerifier.verifyRealInvalidInput("fixtures/SequenceGeneratorBoundaryTest/invalidInput.sql");
    }

    /**
     * concurrentContention Case 使用多个生产发号器争抢同一真实数据库号段，覆盖缓存续段锁和乐观锁重试。
     *
     * <p>执行结果示例：当前真实数据库或边界 Case 的全部验证通过。</p>
     */
    @Test
    void concurrentContention() {
        // 当前方法只调用一次真实并发数据库验证器。
        SequenceGeneratorTestVerifier.verifyRealConcurrentContention(
            "fixtures/SequenceGeneratorBoundaryTest/concurrentContention.sql"
        );
    }
}
