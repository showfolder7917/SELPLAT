package com.sp.selplat.common.service.sequence;

import com.sp.selplat.common.service.sequence.support.SequenceGeneratorTestVerifier;
import org.junit.jupiter.api.Test;

// 公共发号真实数据库测试只声明生产方法和 fixture Case，业务调用与数据库断言集中到验证器。
class SequenceGeneratorRealDatabaseTest {

    // getSequenceComposite Case 验证复合主键分别从真实数据库号段取号并推进游标。
    @Test
    void getSequenceComposite() {
        SequenceGeneratorTestVerifier.verifyRealCompositeSequence("fixtures/SequenceGeneratorRealDatabaseTest/getSequenceComposite.sql");
    }
}
