package com.sp.selplat.common.service.sequence;

import com.sp.selplat.common.service.sequence.support.SequenceGeneratorTestVerifier;
import org.junit.jupiter.api.Test;

// 公共发号边界测试用可控号段替身稳定制造缓存、重试、并发和非法输入分支。
class SequenceGeneratorBoundaryTest {

    // local-cache Case 验证同一数据库号段在本地连续发号时只申请一次。
    @Test
    void localCache() {
        SequenceGeneratorTestVerifier.verifyLocalCache();
    }

    // retry-then-success Case 验证一次乐观锁冲突后能够重试成功。
    @Test
    void retryThenSuccess() {
        SequenceGeneratorTestVerifier.verifyRetryThenSuccess();
    }

    // retry-exhausted Case 验证连续三次冲突后返回明确异常。
    @Test
    void retryExhausted() {
        SequenceGeneratorTestVerifier.verifyRetryExhausted();
    }

    // concurrent-refill Case 验证等待线程进入锁后复用其他线程已经补好的本地号段。
    @Test
    void concurrentRefill() {
        SequenceGeneratorTestVerifier.verifyConcurrentRefill();
    }

    // invalid-input Case 验证空号段编码和空定义在数据库访问前被拒绝。
    @Test
    void invalidInput() {
        SequenceGeneratorTestVerifier.verifyInvalidInput();
    }
}
