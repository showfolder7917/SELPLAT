package com.sp.selplat.uniauth.user.controller;

import com.sp.selplat.uniauth.user.controller.support.UniauthUserControllerTestVerifier;
import org.junit.jupiter.api.Test;

// 用户控制器契约测试只声明待验证契约，路由读取和直接序列化断言统一收口到独立验证器。
class UniauthUserControllerRouteTest {

    // routes Case 验证五个生产方法的 HTTP 路径和请求方式。
    @Test
    void routes() {
        UniauthUserControllerTestVerifier.verifyRoutes();
    }

    // direct-service-result-serialization Case 验证控制器不再二次包装服务返回结构。
    @Test
    void directServiceResultSerialization() {
        UniauthUserControllerTestVerifier.verifyDirectServiceResultSerialization();
    }

    // public-method-responses Case 验证其余四个公开方法调用对应服务并直接序列化结构。
    @Test
    void publicMethodResponses() {
        UniauthUserControllerTestVerifier.verifyPublicMethodResponses();
    }
}
