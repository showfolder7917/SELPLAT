package com.sp.selplat.uniauth.user.controller;

import com.sp.selplat.uniauth.user.controller.support.UniauthUserControllerTestVerifier;
import org.junit.jupiter.api.Test;

/**
 * 用户控制器契约测试只验证不包含业务数据的路由结构，业务响应统一由真实数据库测试覆盖。
 */
class UniauthUserControllerRouteTest {

    /**
     * routes Case 验证九个生产方法的 HTTP 路径和请求方式。
     */
    @Test
    void routes() {
        UniauthUserControllerTestVerifier.verifyRoutes();
    }
}
