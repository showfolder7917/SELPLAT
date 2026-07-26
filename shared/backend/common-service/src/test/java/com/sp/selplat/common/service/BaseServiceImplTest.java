package com.sp.selplat.common.service;

import com.sp.selplat.common.service.support.BaseServiceImplTestVerifier;
import org.junit.jupiter.api.Test;

// 基础 Service 测试只声明 DAO 泛型注入 Case，容器装配和断言统一交给独立验证器。
class BaseServiceImplTest {

    // generic-dao-injection Case 验证多个业务 Service 都只能取得各自泛型绑定的 DAO。
    @Test
    void genericDaoInjection() {
        // 当前测试方法只调用一次验证器，具体 Spring 装配和类型断言在验证器中完成。
        BaseServiceImplTestVerifier.verifyGenericDaoInjection();
    }
}
