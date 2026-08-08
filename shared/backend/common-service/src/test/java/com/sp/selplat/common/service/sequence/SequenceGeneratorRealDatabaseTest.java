package com.sp.selplat.common.service.sequence;

import com.sp.selplat.common.service.sequence.support.SequenceGeneratorTestVerifier;
import org.junit.jupiter.api.Test;

/**
 * 公共发号真实数据库测试只声明生产方法和 fixture Case，业务调用与数据库断言集中到验证器。
 */
class SequenceGeneratorRealDatabaseTest {

    /**
     * getSequenceComposite Case 验证复合主键分别从真实数据库号段取号并推进游标。
     *
     * <p>执行结果示例：当前真实数据库或边界 Case 的全部验证通过。</p>
     */
    @Test
    void getSequenceComposite() {
        SequenceGeneratorTestVerifier.verifyRealCompositeSequence("fixtures/SequenceGeneratorRealDatabaseTest/getSequenceComposite.sql");
    }

    /**
     * routeProjectDataSources Case 验证不同项目号段只推进各自数据库游标。
     *
     * <p>执行结果示例：MDA 返回 {@code 100000}、Uniauth 返回 {@code 200000}，两个游标分别推进。</p>
     */
    @Test
    void routeProjectDataSources() {
        SequenceGeneratorTestVerifier.verifyProjectDataSourceRouting(
            "fixtures/SequenceGeneratorRealDatabaseTest/routeProjectDataSources.sql"
        );
    }
}
