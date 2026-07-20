package com.sp.selplat.common.web.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonPageResult;
import com.sp.selplat.common.util.CommonResult;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerMapping;

/**
 * 验证公共控制器能够按当前 Spring MVC 实际命中的方法自动回传接口路径。
 */
class BaseExtendsControllerTest {

    /**
     * 每个测试结束后清除线程绑定请求，避免当前测试上下文泄漏到后续测试用例。
     */
    @AfterEach
    void clearRequestContext() {
        // 清除本测试线程中的 Spring 请求属性，保证后续用例从无上下文的真实边界状态开始。
        RequestContextHolder.resetRequestAttributes();
    }

    /**
     * 当前请求命中公开控制器方法时，应自动返回该方法的完整映射路径。
     *
     * @throws NoSuchMethodException 测试控制器方法缺失时抛出，表示测试映射定义本身不完整
     */
    @Test
    void getVerifyAvailablePathResolvesCurrentHandlerMethod() throws NoSuchMethodException {
        // 创建最小控制器实例，模拟业务控制器继承公共路径解析能力的实际使用方式。
        TestController controller = new TestController();
        // 构造 Spring 已匹配到 currentEndpoint 方法的处理器元数据，模拟 DispatcherServlet 路由完成后的请求状态。
        HandlerMethod handlerMethod = new HandlerMethod(
            controller,
            TestController.class.getMethod("currentEndpoint")
        );
        // 创建本次 HTTP 请求容器，用于保存 Spring MVC 在请求范围内写入的匹配处理器属性。
        MockHttpServletRequest request = new MockHttpServletRequest();
        // 写入当前命中的 HandlerMethod，使公共控制器可按生产环境相同的属性键读取实际方法。
        request.setAttribute(HandlerMapping.BEST_MATCHING_HANDLER_ATTRIBUTE, handlerMethod);
        // 把模拟请求绑定到当前线程，模拟 Controller 方法执行期间 RequestContextHolder 可访问的请求上下文。
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));

        // 断言无需传入或写死方法名时，仍能返回当前 currentEndpoint 对应的完整接口路径。
        assertEquals("/api/test/current.htm", controller.readVerifyAvailablePath());
    }

    /**
     * 没有 HTTP 请求上下文时，应按旧式返回契约稳定回退为根路径。
     */
    @Test
    void getVerifyAvailablePathFallsBackToRootWithoutRequestContext() {
        // 创建没有绑定 RequestContextHolder 的控制器调用场景，覆盖后台任务或独立单元测试的边界路径。
        TestController controller = new TestController();

        // 断言缺少 Spring MVC 请求上下文时不会抛异常，且 requestPath 仍保持非空根路径。
        assertEquals("/", controller.readVerifyAvailablePath());
    }

    /**
     * 新的两参数分页和普通响应入口应自动补齐当前请求路径。
     *
     * @throws NoSuchMethodException 测试控制器方法缺失时抛出，表示测试映射定义本身不完整
     */
    @Test
    void responseBuildersFillCurrentRequestPathAutomatically() throws NoSuchMethodException {
        // 创建最小控制器和当前命中方法元数据，模拟 Controller 正在处理 currentEndpoint 请求的生产场景。
        TestController controller = new TestController();
        HandlerMethod handlerMethod = new HandlerMethod(
            controller,
            TestController.class.getMethod("currentEndpoint")
        );
        // 绑定携带 HandlerMethod 的请求上下文，让两个新响应入口按正式流程读取当前接口路径。
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setAttribute(HandlerMapping.BEST_MATCHING_HANDLER_ATTRIBUTE, handlerMethod);
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
        // 准备最小普通业务结果，验证详情或操作响应无需调用方显式传入模块编码和路径。
        CommonResult result = new CommonResult();
        // 准备最小分页结果，验证列表响应同样无需调用方显式传入模块编码、路径和说明。
        CommonPageResult pageResult = new CommonPageResult();
        pageResult.setRecords(List.of());
        pageResult.setPageNo(1);
        pageResult.setPageSize(20);

        // 普通响应必须自动写入当前 HandlerMethod 对应的完整接口路径。
        assertTrue(controller.buildResponseJsonForTest(result).contains("\"requestPath\":\"/api/test/current.htm\""));
        // 分页响应必须自动写入同一路径，并保留列表响应特有的 rows 字段。
        String pageResponseJson = controller.buildPageResponseJsonForTest(new CommonPageParam(), pageResult);
        assertTrue(pageResponseJson.contains("\"requestPath\":\"/api/test/current.htm\""));
        assertTrue(pageResponseJson.contains("\"rows\":[]"));
    }

    /**
     * 用最小映射控制器承接公共基类测试，避免把实际业务控制器和数据库依赖引入本次路径解析测试。
     */
    @RequestMapping("/api/test")
    private static class TestController extends BaseExtendsController {

        /**
         * 模拟业务控制器当前实际命中的公开接口方法。
         */
        @RequestMapping("current.htm")
        public void currentEndpoint() {
            // 当前测试只验证 Spring 路由元数据和路径回传，因此方法体无需执行业务动作。
        }

        /**
         * 暴露受保护路径解析方法，供测试断言公共基类的实际返回值。
         *
         * @return 当前请求命中的完整路径或根路径回退值
         */
        private String readVerifyAvailablePath() {
            // 直接转调父类实现，确保测试覆盖的是正式公共控制器逻辑而不是复制的替代实现。
            return getVerifyAvailablePath();
        }

        /**
         * 暴露两参数普通响应入口，供测试验证当前请求路径由公共基类自动填充。
         *
         * @param result 待包装的普通业务结果
         * @return 自动补齐元数据后的普通响应 JSON
         */
        private String buildResponseJsonForTest(CommonResult result) {
            // 测试固定传入说明文案，使断言聚焦公共基类自动填充的模块和路径元数据。
            return buildResponseJson(result, "测试普通响应完成。");
        }

        /**
         * 暴露两参数分页响应入口，供测试验证当前请求路径和分页字段由公共基类统一填充。
         *
         * @param queryIn 当前分页查询参数
         * @param pageResult 当前分页业务结果
         * @return 自动补齐元数据后的分页响应 JSON
         */
        private String buildPageResponseJsonForTest(
            CommonPageParam queryIn,
            CommonPageResult pageResult
        ) {
            // 直接转调两参数分页响应入口，确保测试覆盖 Controller 未来实际使用的精简调用方式。
            return buildPageResponseJson(queryIn, pageResult);
        }
    }
}
