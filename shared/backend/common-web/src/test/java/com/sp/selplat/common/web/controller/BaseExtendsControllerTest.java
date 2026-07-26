package com.sp.selplat.common.web.controller;

import com.sp.selplat.common.web.controller.support.BaseExtendsControllerTestVerifier;
import org.junit.jupiter.api.Test;

// 公共控制器扩展测试只声明生产仍使用的模块元数据和公开路径扫描 Case。
class BaseExtendsControllerTest {

    // module-metadata Case 验证显式注解和类名推导的模块信息。
    @Test
    void moduleMetadata() {
        // 当前测试方法只调用一次验证器，具体模块信息断言集中在同域验证器。
        BaseExtendsControllerTestVerifier.verifyModuleMetadata();
    }

    // available-paths Case 验证全部受支持的 RequestMapping 路径形态。
    @Test
    void availablePaths() {
        // 当前测试方法只调用一次验证器，路径形态和 HTTP 方法断言集中在同域验证器。
        BaseExtendsControllerTestVerifier.verifyAvailablePaths();
    }
}
