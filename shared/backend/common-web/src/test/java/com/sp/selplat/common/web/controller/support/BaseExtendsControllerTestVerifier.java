package com.sp.selplat.common.web.controller.support;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonPageResult;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.common.web.controller.BaseExtendsController;
import com.sp.selplat.common.web.controller.ModuleDescription;
import java.util.List;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerMapping;

// 公共控制器验证器集中维护模拟请求上下文和响应断言，并确保每个 Case 结束后清理线程状态。
public final class BaseExtendsControllerTestVerifier {

    // 验证器不保存跨 Case 请求状态。
    private BaseExtendsControllerTestVerifier() {
    }

    // 验证当前 Spring HandlerMethod 被解析成类级和方法级组合路径。
    public static void verifyCurrentHandlerPath() {
        // 创建最小公共控制器子类。
        TestController controller = new TestController();
        try {
            // 绑定 currentEndpoint 对应的真实 HandlerMethod 请求属性。
            bindCurrentEndpoint(controller);
            // 公共路径解析必须返回完整组合路径。
            assertEquals("/api/test/current.htm", controller.readVerifyAvailablePath());
        } finally {
            // 清理线程请求上下文，避免影响后续回归 Case。
            RequestContextHolder.resetRequestAttributes();
        }
    }

    // 验证无请求上下文时公共路径稳定回退根路径。
    public static void verifyNoRequestContext() {
        // 明确清理可能遗留的线程请求属性。
        RequestContextHolder.resetRequestAttributes();
        // 创建没有任何 HTTP 上下文的控制器。
        TestController controller = new TestController();
        // 公共路径不得抛异常并必须返回根路径。
        assertEquals("/", controller.readVerifyAvailablePath());
    }

    // 验证普通和分页响应均自动补齐当前 HandlerMethod 路径。
    public static void verifyResponsePath() {
        // 创建最小公共控制器子类。
        TestController controller = new TestController();
        try {
            // 绑定 currentEndpoint 对应的真实 HandlerMethod 请求属性。
            bindCurrentEndpoint(controller);
            // 创建最小普通服务结果。
            CommonResult result = new CommonResult();
            // 创建最小分页服务结果。
            CommonPageResult pageResult = new CommonPageResult();
            // 空 rows 明确验证分页 JSON 字段仍然存在。
            pageResult.setRecords(List.of());
            // 固定第一页。
            pageResult.setPageNo(1);
            // 固定默认页大小。
            pageResult.setPageSize(20);
            // 普通响应必须自动写入当前完整路径。
            assertTrue(controller.buildResponseJsonForTest(result).contains("\"requestPath\":\"/api/test/current.htm\""));
            // 执行分页响应包装。
            String pageResponseJson = controller.buildPageResponseJsonForTest(new CommonPageParam(), pageResult);
            // 分页响应必须自动写入同一完整路径。
            assertTrue(pageResponseJson.contains("\"requestPath\":\"/api/test/current.htm\""));
            // 分页响应必须保留空 rows 结构。
            assertTrue(pageResponseJson.contains("\"rows\":[]"));
        } finally {
            // 清理线程请求上下文，保证 shared 全量回归可重复执行。
            RequestContextHolder.resetRequestAttributes();
        }
    }

    // 验证普通参数、分页参数和 HTTP 动态字段统一进入 CommonParam。
    public static void verifyCommonParamResolution() {
        // 创建最小公共控制器子类。
        TestController controller = new TestController();
        // 创建包含动态业务字段和分页保留字段的模拟请求。
        MockHttpServletRequest request = new MockHttpServletRequest();
        // loginName 应进入动态 Map。
        request.addParameter("loginName", "request-user");
        // pageNo 由分页对象承接，不得重复进入动态 Map。
        request.addParameter("pageNo", "2");
        // pageSize 同样不得重复进入动态 Map。
        request.addParameter("pageSize", "5");
        // 三个入参均为空时公共普通参数入口必须创建默认对象。
        CommonParam resolvedDefault = controller.resolveCommonForTest(null, null, request);
        // 请求业务字段必须进入新建对象。
        assertEquals("request-user", resolvedDefault.getParam("loginName"));
        // JSON body 存在时必须优先保留同一个对象。
        CommonParam body = new CommonParam();
        // body 自带字段用于验证对象优先级。
        body.putParam("source", "body");
        // 普通绑定对象作为次优先输入。
        CommonParam bound = new CommonParam();
        // 普通对象字段不应覆盖 body。
        bound.putParam("source", "bound");
        // 返回对象必须就是原 body。
        assertSame(body, controller.resolveCommonForTest(body, bound, request));
        // body 原字段必须保持不变。
        assertEquals("body", body.getParam("source"));
        // 分页 body 存在时继续作为最终对象。
        CommonPageParam pageBody = new CommonPageParam();
        // 普通分页对象提供最终页码和页大小覆盖值。
        CommonPageParam pageBound = new CommonPageParam();
        // 模拟绑定页码。
        pageBound.setPageNo(2);
        // 模拟绑定页大小。
        pageBound.setPageSize(5);
        // 解析最终分页参数。
        CommonPageParam resolvedPage = controller.resolveStoreForTest(pageBody, pageBound, request);
        // 最终对象必须保持 body 身份。
        assertSame(pageBody, resolvedPage);
        // 页码必须使用绑定对象值。
        assertEquals(2, resolvedPage.getPageNo());
        // 页大小必须使用绑定对象值。
        assertEquals(5, resolvedPage.getPageSize());
        // 动态业务字段必须进入分页 Map。
        assertEquals("request-user", resolvedPage.getParam("loginName"));
        // 分页保留字段不得进入动态 Map。
        assertTrue(!resolvedPage.getParamMap().containsKey("pageNo"));
        // queryIn 或 request 为空时动态填充入口必须安全返回。
        controller.populateForTest(null, request);
        // request 为空时同样不得改变现有参数。
        controller.populateForTest(resolvedPage, null);
        // 分页 body 和绑定对象都为空时必须创建默认分页参数。
        CommonPageParam defaultPage = controller.resolveStoreForTest(null, null, null);
        // 默认页码必须保持第一页。
        assertEquals(1, defaultPage.getPageNo());
        // 默认页大小必须保持二十条。
        assertEquals(20, defaultPage.getPageSize());
    }

    // 验证模块说明、公开路径扫描、指定方法路径和旧响应入口。
    public static void verifyMetadataAndLegacyEntries() {
        // 创建带完整 ModuleDescription 的测试控制器。
        TestController controller = new TestController();
        // 模块说明必须直接来自注解 description。
        assertEquals("公共控制器测试", controller.readVerifyMessage());
        // 模块编码必须直接来自注解 code。
        assertEquals("common-web-test", controller.readVerifyModuleCode());
        // 指定公开方法必须解析完整路径。
        assertEquals("/api/test/current.htm", controller.readVerifyMethodPath("currentEndpoint"));
        // 不存在方法必须回退根路径。
        assertEquals("/", controller.readVerifyMethodPath("missingEndpoint"));
        // 可访问路径扫描必须包含未声明 HTTP 方法时默认生成的 GET。
        assertTrue(controller.readVerifyAvailablePaths().contains("GET /api/test/current.htm"));
        // 显式声明 POST 的方法必须按真实 HTTP 方法输出。
        assertTrue(controller.readVerifyAvailablePaths().contains("POST /api/test/post.htm"));
        // 创建最小普通结果供旧入口兼容验证。
        CommonResult result = new CommonResult();
        // 旧普通响应入口必须仍输出显式 requestPath。
        assertTrue(controller.buildLegacyResponseForTest(result).contains("\"requestPath\":\"/legacy/result\""));
        // 创建最小分页结果供旧 store 入口兼容验证。
        CommonPageResult pageResult = new CommonPageResult();
        // 旧 store 入口需要稳定空 rows。
        pageResult.setRecords(List.of());
        // 固定第一页。
        pageResult.setPageNo(1);
        // 固定十条页大小。
        pageResult.setPageSize(10);
        // 旧 store 响应入口必须仍输出显式 requestPath。
        assertTrue(
            controller.buildLegacyStoreForTest(new CommonPageParam(), pageResult)
                .contains("\"requestPath\":\"/legacy/store\"")
        );
        // 没有模块说明的控制器必须按类名推导 kebab-case 编码。
        assertEquals("plain-sample", new PlainSampleController().readVerifyModuleCode());
        // 没有模块说明时提示必须回退通用文案。
        assertEquals("控制器已装配。", new PlainSampleController().readVerifyMessage());
        // 仅提供 name 的模块说明必须生成可读装配文案。
        assertEquals("仅名称模块控制器已装配。", new NameOnlyController().readVerifyMessage());
    }

    // 验证不同 RequestMapping 写法和异常请求处理器的路径边界。
    public static void verifyPathEdgeShapes() {
        // 无类级路径时方法路径必须自动补前导斜杠。
        assertEquals("/method.htm", new NoClassMappingController().readVerifyMethodPath("mapped"));
        // 方法存在但没有 RequestMapping 时必须继续扫描并最终回退根路径。
        assertEquals("/", new NoClassMappingController().readVerifyMethodPath("noMapping"));
        // 类和方法都没有路径片段时必须稳定返回根路径。
        assertEquals("/", new NoClassMappingController().readVerifyMethodPath("emptyMapping"));
        // path 属性必须与 value 属性采用同一路径解析口径。
        assertEquals("/path-api/path.htm", new PathOnlyController().readVerifyMethodPath("pathEndpoint"));
        // 方法路径为空时必须直接返回规范化后的类级路径。
        assertEquals("/path-api", new PathOnlyController().readVerifyMethodPath("classRoot"));
        // 根类路径和普通方法路径拼接时必须保持单斜杠。
        assertEquals("/root.htm", new RootPathController().readVerifyMethodPath("rootEndpoint"));
        // 无类注解控制器扫描路径时必须安全处理 null RequestMapping。
        assertTrue(new NoClassMappingController().readVerifyAvailablePaths().contains("GET /method.htm"));
        // 类名只有 Controller 后缀时模块编码允许回落为空串。
        assertEquals("", new Controller().readVerifyModuleCode());
        // 创建带请求上下文但不是 HandlerMethod 的边界。
        MockHttpServletRequest request = new MockHttpServletRequest();
        // 非标准处理器对象无法解析生产方法。
        request.setAttribute(HandlerMapping.BEST_MATCHING_HANDLER_ATTRIBUTE, "not-a-handler-method");
        // 把非标准处理器请求绑定到当前线程。
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
        try {
            // 非 HandlerMethod 必须回退根路径。
            assertEquals("/", new TestController().readVerifyAvailablePath());
        } finally {
            // 清理当前边界 Case 请求上下文。
            RequestContextHolder.resetRequestAttributes();
        }
    }

    // 把测试控制器 currentEndpoint 绑定成当前 Spring MVC 处理方法。
    private static void bindCurrentEndpoint(TestController controller) {
        try {
            // 构造真实方法对应的 HandlerMethod。
            HandlerMethod handlerMethod = new HandlerMethod(
                controller,
                TestController.class.getMethod("currentEndpoint")
            );
            // 创建请求范围容器。
            MockHttpServletRequest request = new MockHttpServletRequest();
            // 使用生产环境相同属性键保存当前 HandlerMethod。
            request.setAttribute(HandlerMapping.BEST_MATCHING_HANDLER_ATTRIBUTE, handlerMethod);
            // 把请求绑定到当前线程供公共控制器读取。
            RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
        } catch (NoSuchMethodException exception) {
            // 测试控制器方法缺失时转换成明确结构失败。
            throw new AssertionError("测试控制器缺少 currentEndpoint", exception);
        }
    }

    // TestController 用最小映射公开 BaseExtendsController 的受保护响应能力。
    @ModuleDescription(code = "common-web-test", name = "公共 Web 测试", description = "公共控制器测试")
    @RequestMapping("/api/test")
    private static class TestController extends BaseExtendsController {

        // currentEndpoint 模拟当前 Spring MVC 实际命中的业务方法。
        @RequestMapping("current.htm")
        public void currentEndpoint() {
            // 当前方法只提供真实路由元数据，不执行业务动作。
        }

        // postEndpoint 提供显式 POST 路由供可访问路径扫描验证。
        @RequestMapping(value = "post.htm", method = RequestMethod.POST)
        public void postEndpoint() {
            // 当前方法只提供显式 HTTP 方法元数据。
        }

        // 读取公共控制器解析出的当前完整路径。
        private String readVerifyAvailablePath() {
            // 直接调用生产受保护方法。
            return getVerifyAvailablePath();
        }

        // 使用生产普通响应入口包装当前结果。
        private String buildResponseJsonForTest(CommonResult result) {
            // 固定测试消息，让当前 Case 聚焦自动路径。
            return buildResponseJson(result, "测试普通响应完成。");
        }

        // 使用生产分页响应入口包装当前结果。
        private String buildPageResponseJsonForTest(CommonPageParam queryIn, CommonPageResult pageResult) {
            // 直接调用生产受保护方法验证完整输出。
            return buildPageResponseJson(queryIn, pageResult);
        }

        // 暴露普通 CommonParam 合并入口。
        private CommonParam resolveCommonForTest(CommonParam body, CommonParam bound, MockHttpServletRequest request) {
            // 直接调用生产参数合并方法。
            return resolveCommonParam(body, bound, request);
        }

        // 暴露分页 CommonParam 合并入口。
        private CommonPageParam resolveStoreForTest(CommonPageParam body, CommonPageParam bound, MockHttpServletRequest request) {
            // 直接调用生产分页参数合并方法。
            return resolveStoreQueryIn(body, bound, request);
        }

        // 暴露动态请求字段填充入口。
        private void populateForTest(CommonParam input, MockHttpServletRequest request) {
            // 直接调用生产动态参数方法。
            populateDynamicQueryParams(input, request);
        }

        // 读取指定生产方法完整路径。
        private String readVerifyMethodPath(String methodName) {
            // 直接调用生产方法路径解析。
            return getVerifyMethodPath(methodName);
        }

        // 读取模块验证说明。
        private String readVerifyMessage() {
            // 直接调用生产模块说明解析。
            return getVerifyMessage();
        }

        // 读取模块编码。
        private String readVerifyModuleCode() {
            // 直接调用生产模块编码解析。
            return getVerifyModuleCode();
        }

        // 读取全部公开路径。
        private List<String> readVerifyAvailablePaths() {
            // 直接调用生产路径扫描。
            return getVerifyAvailablePaths();
        }

        // 暴露旧普通响应兼容入口。
        private String buildLegacyResponseForTest(CommonResult result) {
            // 固定显式元数据验证旧入口仍然有效。
            return buildCommonResultJson("legacy", "/legacy/result", result, "legacy");
        }

        // 暴露旧 store 响应兼容入口。
        private String buildLegacyStoreForTest(CommonPageParam queryIn, CommonPageResult pageResult) {
            // 固定显式元数据验证旧入口仍然有效。
            return buildStoreResultJson("legacy", "/legacy/store", queryIn, pageResult, "legacy");
        }
    }

    // PlainSampleController 不声明模块注解，用于验证类名推导与通用提示。
    private static class PlainSampleController extends BaseExtendsController {

        // 读取生产模块编码推导结果。
        private String readVerifyModuleCode() {
            // 直接调用生产模块编码解析。
            return getVerifyModuleCode();
        }

        // 读取生产通用验证说明。
        private String readVerifyMessage() {
            // 直接调用生产模块说明解析。
            return getVerifyMessage();
        }
    }

    // NameOnlyController 只声明模块名称，用于验证 description 为空时的回退分支。
    @ModuleDescription(code = "", name = "仅名称模块", description = "")
    private static class NameOnlyController extends BaseExtendsController {

        // 读取生产模块说明回退结果。
        private String readVerifyMessage() {
            // 直接调用生产模块说明解析。
            return getVerifyMessage();
        }
    }

    // NoClassMappingController 不声明类路径，用于验证纯方法路径和空方法映射。
    private static class NoClassMappingController extends BaseExtendsController {

        // mapped 使用没有前导斜杠的方法路径。
        @RequestMapping("method.htm")
        public void mapped() {
            // 当前方法只提供路径元数据。
        }

        // emptyMapping 显式声明空请求映射。
        @RequestMapping
        public void emptyMapping() {
            // 当前方法只提供空路径元数据。
        }

        // noMapping 故意不声明请求映射。
        public void noMapping() {
            // 当前方法用于验证同名无映射分支。
        }

        // 读取指定方法路径。
        private String readVerifyMethodPath(String methodName) {
            // 直接调用生产方法路径解析。
            return getVerifyMethodPath(methodName);
        }

        // 扫描当前控制器公开路径。
        private List<String> readVerifyAvailablePaths() {
            // 直接调用生产路径扫描。
            return getVerifyAvailablePaths();
        }
    }

    // PathOnlyController 使用 path 属性和多余尾斜杠验证规范化逻辑。
    @RequestMapping(path = "path-api//")
    private static class PathOnlyController extends BaseExtendsController {

        // pathEndpoint 方法同样使用 path 属性。
        @RequestMapping(path = "path.htm")
        public void pathEndpoint() {
            // 当前方法只提供 path 属性元数据。
        }

        // classRoot 不声明方法路径，只返回类级路径。
        @RequestMapping
        public void classRoot() {
            // 当前方法只提供空方法路径元数据。
        }

        // 读取指定方法路径。
        private String readVerifyMethodPath(String methodName) {
            // 直接调用生产方法路径解析。
            return getVerifyMethodPath(methodName);
        }
    }

    // RootPathController 验证根路径不会被尾斜杠裁成空串。
    @RequestMapping("/")
    private static class RootPathController extends BaseExtendsController {

        // rootEndpoint 提供根类路径下的方法片段。
        @RequestMapping("root.htm")
        public void rootEndpoint() {
            // 当前方法只提供根路径拼接元数据。
        }

        // 读取指定方法路径。
        private String readVerifyMethodPath(String methodName) {
            // 直接调用生产方法路径解析。
            return getVerifyMethodPath(methodName);
        }
    }

    // Controller 类名去掉后缀后为空，用于验证模块编码空输入分支。
    private static class Controller extends BaseExtendsController {

        // 读取生产模块编码。
        private String readVerifyModuleCode() {
            // 直接调用生产模块编码解析。
            return getVerifyModuleCode();
        }
    }
}
