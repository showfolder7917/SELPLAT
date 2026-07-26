package com.sp.selplat.common.web.controller;

import com.sp.selplat.common.web.controller.support.BaseExtendsControllerTestVerifier;
import org.junit.jupiter.api.Test;

// 公共控制器扩展测试只声明路径与响应 Case，请求上下文和断言集中到独立验证器。
class BaseExtendsControllerTest {

    // current-handler-path Case 验证当前 HandlerMethod 自动解析完整路径。
    @Test
    void currentHandlerPath() {
        BaseExtendsControllerTestVerifier.verifyCurrentHandlerPath();
    }

    // no-request-context Case 验证无 HTTP 上下文时稳定回退根路径。
    @Test
    void noRequestContext() {
        BaseExtendsControllerTestVerifier.verifyNoRequestContext();
    }

    // response-path Case 验证普通响应和分页响应自动补齐当前路径。
    @Test
    void responsePath() {
        BaseExtendsControllerTestVerifier.verifyResponsePath();
    }

    // common-param-resolution Case 验证 JSON、普通对象和请求参数统一合并。
    @Test
    void commonParamResolution() {
        BaseExtendsControllerTestVerifier.verifyCommonParamResolution();
    }

    // metadata-and-legacy Case 验证模块元数据、路径扫描和旧响应入口兼容。
    @Test
    void metadataAndLegacy() {
        BaseExtendsControllerTestVerifier.verifyMetadataAndLegacyEntries();
    }

    // path-edge-shapes Case 验证无类路径、仅类路径、path 属性、空映射和非 HandlerMethod 边界。
    @Test
    void pathEdgeShapes() {
        BaseExtendsControllerTestVerifier.verifyPathEdgeShapes();
    }
}
