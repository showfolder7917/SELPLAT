package com.sp.selplat.common.web.controller.support;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sp.selplat.common.web.controller.BaseExtendsController;
import com.sp.selplat.common.web.controller.ModuleDescription;
import java.util.List;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;

/**
 * 公共控制器验证器只覆盖生产验证接口实际使用的模块元数据和公开路径扫描能力。
 */
public final class BaseExtendsControllerTestVerifier {

    /**
     * 验证器不保存运行状态，仅通过静态 Case 入口组织断言。
     *
     * <p>执行结果示例：当前控制器结构与路由 Case 的全部验证通过。</p>
     */
    private BaseExtendsControllerTestVerifier() {
    }

    /**
     * 验证显式模块注解、名称回退、通用回退和类名编码推导。
     *
     * <p>执行结果示例：当前控制器结构与路由 Case 的全部验证通过。</p>
     */
    public static void verifyModuleMetadata() {
        // 完整注解控制器必须优先返回业务显式编码。
        assertEquals("common-web-test", new TestController().readVerifyModuleCode());
        // 完整注解控制器必须优先返回业务详细说明。
        assertEquals("公共控制器测试", new TestController().readVerifyMessage());
        // 只有模块名称时必须生成稳定的装配说明。
        assertEquals("仅名称模块控制器已装配。", new NameOnlyController().readVerifyMessage());
        // 空注解内容不能产生空响应，应回退公共说明。
        assertEquals("控制器已装配。", new EmptyDescriptionController().readVerifyMessage());
        // 没有注解时从类名推导短横线模块编码。
        assertEquals("plain-sample", new PlainSampleController().readVerifyModuleCode());
        // 没有注解时验证说明使用公共兜底文案。
        assertEquals("控制器已装配。", new PlainSampleController().readVerifyMessage());
        // 类名仅包含 Controller 后缀时业务名称为空，对应空模块编码。
        assertEquals("", new Controller().readVerifyModuleCode());
    }

    /**
     * 验证 value、path、空映射、根路径和多 HTTP 方法的统一路径扫描。
     *
     * <p>执行结果示例：当前控制器结构与路由 Case 的全部验证通过。</p>
     */
    public static void verifyAvailablePaths() {
        // 读取完整注解控制器的公开路径列表。
        List<String> testPaths = new TestController().readVerifyAvailablePaths();
        // 未声明 HTTP 方法的入口按现有验证口径输出 GET。
        assertTrue(testPaths.contains("GET /api/test/current.htm"));
        // 显式 POST 入口必须保留真实 HTTP 方法。
        assertTrue(testPaths.contains("POST /api/test/post.htm"));
        // 多方法入口必须逐项输出 GET。
        assertTrue(testPaths.contains("GET /api/test/multi.htm"));
        // 多方法入口必须逐项输出 POST。
        assertTrue(testPaths.contains("POST /api/test/multi.htm"));
        // 没有 RequestMapping 的公开方法不得进入验证结果。
        assertFalse(testPaths.stream().anyMatch(path -> path.contains("notMapped")));
        // 没有类级路径时方法相对路径必须自动补前导斜杠。
        assertTrue(new NoClassMappingController().readVerifyAvailablePaths().contains("GET /method.htm"));
        // 类和方法路径都为空时必须稳定输出根路径。
        assertTrue(new NoClassMappingController().readVerifyAvailablePaths().contains("GET /"));
        // path 属性和多余尾斜杠必须规范化成单斜杠完整路径。
        assertTrue(new PathOnlyController().readVerifyAvailablePaths().contains("GET /path-api/path.htm"));
        // 方法路径为空时必须直接使用类级路径。
        assertTrue(new PathOnlyController().readVerifyAvailablePaths().contains("GET /path-api"));
        // 方法路径带前导斜杠时必须避免拼成双斜杠。
        assertTrue(new PathOnlyController().readVerifyAvailablePaths().contains("GET /path-api/leading.htm"));
        // 类级根路径与普通方法路径拼接时必须保持一个前导斜杠。
        assertTrue(new RootPathController().readVerifyAvailablePaths().contains("GET /root.htm"));
    }

    // 完整测试控制器覆盖 value 路径、默认 GET、显式 POST 和多 HTTP 方法。
    @ModuleDescription(code = "common-web-test", name = "公共 Web 测试", description = "公共控制器测试")
    @RequestMapping("/api/test")
    private static class TestController extends BaseExtendsController {

        /**
         * 默认方法入口用于验证未声明 HTTP Method 时的 GET 展示口径。
         *
         * <p>执行结果示例：当前控制器结构与路由 Case 的全部验证通过。</p>
         */
        @RequestMapping("current.htm")
        public void currentEndpoint() {
            // 当前方法只提供路由元数据。
        }

        /**
         * POST 方法入口用于验证显式请求方式。
         *
         * <p>执行结果示例：当前控制器结构与路由 Case 的全部验证通过。</p>
         */
        @RequestMapping(value = "post.htm", method = RequestMethod.POST)
        public void postEndpoint() {
            // 当前方法只提供路由元数据。
        }

        /**
         * 多方法入口用于验证同一路径逐项输出全部请求方式。
         *
         * <p>执行结果示例：当前控制器结构与路由 Case 的全部验证通过。</p>
         */
        @RequestMapping(value = "multi.htm", method = {RequestMethod.GET, RequestMethod.POST})
        public void multiEndpoint() {
            // 当前方法只提供路由元数据。
        }

        /**
         * 无映射公开方法用于验证路径扫描会忽略非 HTTP 入口。
         *
         * <p>执行结果示例：当前控制器结构与路由 Case 的全部验证通过。</p>
         */
        public void notMapped() {
            // 当前方法故意不声明路由。
        }

        /**
         * 暴露生产模块编码供当前验证器读取。
         *
         * @return 生产模块编码，例如 {@code "sample-module"}；纯 Controller 类名返回空串
         */
        private String readVerifyModuleCode() {
            // 直接调用生产受保护入口。
            return getVerifyModuleCode();
        }

        /**
         * 暴露生产验证说明供当前验证器读取。
         *
         * @return 生产验证说明，例如 {@code "样例模块控制器已装配。"}
         */
        private String readVerifyMessage() {
            // 直接调用生产受保护入口。
            return getVerifyMessage();
        }

        /**
         * 暴露生产路径扫描结果供当前验证器读取。
         *
         * @return 生产路径扫描结果，例如 {@code ["GET /api/current.htm","POST /api/post.htm"]}
         */
        private List<String> readVerifyAvailablePaths() {
            // 直接调用生产受保护入口。
            return getVerifyAvailablePaths();
        }
    }

    // 只有 name 的注解控制器用于验证模块名称回退说明。
    @ModuleDescription(code = "", name = "仅名称模块", description = "")
    private static class NameOnlyController extends BaseExtendsController {

        /**
         * 暴露生产验证说明。
         *
         * @return 生产验证说明，例如 {@code "样例模块控制器已装配。"}
         */
        private String readVerifyMessage() {
            // 直接调用生产受保护入口。
            return getVerifyMessage();
        }
    }

    // 注解字段全部为空时用于验证公共说明回退。
    @ModuleDescription(code = "", name = "", description = "")
    private static class EmptyDescriptionController extends BaseExtendsController {

        /**
         * 暴露生产验证说明。
         *
         * @return 生产验证说明，例如 {@code "样例模块控制器已装配。"}
         */
        private String readVerifyMessage() {
            // 直接调用生产受保护入口。
            return getVerifyMessage();
        }
    }

    /**
     * 无注解控制器用于验证类名编码推导和公共说明。
     */
    private static class PlainSampleController extends BaseExtendsController {

        /**
         * 暴露生产模块编码。
         *
         * @return 生产模块编码，例如 {@code "sample-module"}；纯 Controller 类名返回空串
         */
        private String readVerifyModuleCode() {
            // 直接调用生产受保护入口。
            return getVerifyModuleCode();
        }

        /**
         * 暴露生产验证说明。
         *
         * @return 生产验证说明，例如 {@code "样例模块控制器已装配。"}
         */
        private String readVerifyMessage() {
            // 直接调用生产受保护入口。
            return getVerifyMessage();
        }
    }

    /**
     * 无类级映射控制器覆盖纯方法路径、空方法映射和无映射方法。
     */
    private static class NoClassMappingController extends BaseExtendsController {

        /**
         * 普通相对方法路径用于验证前导斜杠补齐。
         *
         * <p>执行结果示例：当前控制器结构与路由 Case 的全部验证通过。</p>
         */
        @RequestMapping("method.htm")
        public void mapped() {
            // 当前方法只提供路由元数据。
        }

        /**
         * 空方法映射和空类路径共同形成根路径。
         *
         * <p>执行结果示例：当前控制器结构与路由 Case 的全部验证通过。</p>
         */
        @RequestMapping
        public void emptyMapping() {
            // 当前方法只提供路由元数据。
        }

        /**
         * 暴露生产路径扫描结果。
         *
         * @return 生产路径扫描结果，例如 {@code ["GET /api/current.htm","POST /api/post.htm"]}
         */
        private List<String> readVerifyAvailablePaths() {
            // 直接调用生产受保护入口。
            return getVerifyAvailablePaths();
        }
    }

    /**
     * path 属性控制器覆盖路径属性兼容、尾斜杠清理和空方法路径。
     *
     * <p>执行结果示例：当前控制器结构与路由 Case 的全部验证通过。</p>
     */
    @RequestMapping(path = "path-api//")
    private static class PathOnlyController extends BaseExtendsController {

        /**
         * path 方法属性用于验证 value 为空时的兼容读取。
         *
         * <p>执行结果示例：当前控制器结构与路由 Case 的全部验证通过。</p>
         */
        @RequestMapping(path = "path.htm")
        public void pathEndpoint() {
            // 当前方法只提供路由元数据。
        }

        /**
         * 空方法路径必须直接返回类级路径。
         *
         * <p>执行结果示例：当前控制器结构与路由 Case 的全部验证通过。</p>
         */
        @RequestMapping
        public void classRoot() {
            // 当前方法只提供路由元数据。
        }

        /**
         * 带前导斜杠的方法路径用于验证边界斜杠清理。
         *
         * <p>执行结果示例：当前控制器结构与路由 Case 的全部验证通过。</p>
         */
        @RequestMapping(path = "/leading.htm")
        public void leadingEndpoint() {
            // 当前方法只提供路由元数据。
        }

        /**
         * 暴露生产路径扫描结果。
         *
         * @return 生产路径扫描结果，例如 {@code ["GET /api/current.htm","POST /api/post.htm"]}
         */
        private List<String> readVerifyAvailablePaths() {
            // 直接调用生产受保护入口。
            return getVerifyAvailablePaths();
        }
    }

    /**
     * 根类路径控制器用于验证根斜杠不会与方法路径重复。
     *
     * <p>执行结果示例：当前控制器结构与路由 Case 的全部验证通过。</p>
     */
    @RequestMapping("/")
    private static class RootPathController extends BaseExtendsController {

        /**
         * 普通方法路径与根类路径组合成唯一根级入口。
         *
         * <p>执行结果示例：当前控制器结构与路由 Case 的全部验证通过。</p>
         */
        @RequestMapping("root.htm")
        public void rootEndpoint() {
            // 当前方法只提供路由元数据。
        }

        /**
         * 暴露生产路径扫描结果。
         *
         * @return 生产路径扫描结果，例如 {@code ["GET /api/current.htm","POST /api/post.htm"]}
         */
        private List<String> readVerifyAvailablePaths() {
            // 直接调用生产受保护入口。
            return getVerifyAvailablePaths();
        }
    }

    /**
     * 类名仅为 Controller 时覆盖空业务名称的模块编码边界。
     */
    private static class Controller extends BaseExtendsController {

        /**
         * 暴露生产模块编码。
         *
         * @return 生产模块编码，例如 {@code "sample-module"}；纯 Controller 类名返回空串
         */
        private String readVerifyModuleCode() {
            // 直接调用生产受保护入口。
            return getVerifyModuleCode();
        }
    }
}
