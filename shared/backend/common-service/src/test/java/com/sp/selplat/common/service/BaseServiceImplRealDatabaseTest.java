package com.sp.selplat.common.service;

import com.sp.selplat.common.service.support.BaseServiceImplTestVerifier;
import org.junit.jupiter.api.Test;

/**
 * 基础 Service 真实数据库测试通过生产继承链验证泛型 DAO 注入和全部默认 CRUD。
 */
class BaseServiceImplRealDatabaseTest {

    /**
     * defaultCrud Case 使用独立 fixture 验证 BaseServiceImpl 默认 CRUD 与 BaseExtendsServiceImpl 发号能力的真实数据库调用。
     *
     * <p>执行结果示例：当前真实数据库或边界 Case 的全部验证通过。</p>
     */
    @Test
    void defaultCrud() {
        // 当前测试方法只调用一次验证器，真实容器、业务参数和数据库断言集中在验证器中。
        BaseServiceImplTestVerifier.verifyRealDefaultCrud(
            "fixtures/BaseServiceImplRealDatabaseTest/defaultCrud.sql"
        );
    }
}
