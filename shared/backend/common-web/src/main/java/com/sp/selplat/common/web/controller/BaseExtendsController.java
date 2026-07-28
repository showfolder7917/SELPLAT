package com.sp.selplat.common.web.controller;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;

/**
 * 公共控制器扩展基类只维护 HTTP 验证接口实际使用的模块说明、模块编码和可访问路径扫描能力。
 */
public abstract class BaseExtendsController {

    /**
     * 返回当前控制器的验证说明。
     *
     * @return 注解中的职责说明，例如 {@code "统一认证用户接口"}；
     *     没有有效注解时返回 {@code "控制器已装配。"}
     */
    protected String getVerifyMessage() {
        // 控制器显式声明模块说明时优先使用注解内容，让验证接口展示真实业务职责。
        ModuleDescription moduleDescription = getClass().getAnnotation(ModuleDescription.class);
        // 注解存在时依次采用详细说明和模块名称，避免业务控制器重复实现验证文案。
        if (moduleDescription != null) {
            // 详细说明非空时直接作为验证接口文案。
            if (!moduleDescription.description().trim().isEmpty()) {
                return moduleDescription.description().trim();
            }
            // 只有模块名称时生成稳定的装配完成说明。
            if (!moduleDescription.name().trim().isEmpty()) {
                return moduleDescription.name().trim() + "控制器已装配。";
            }
        }
        // 没有有效模块说明时返回公共兜底文案，保证验证响应始终可读。
        return "控制器已装配。";
    }

    /**
     * 返回当前控制器的模块编码。
     *
     * @return 注解编码或类名推导编码，例如 {@code "uniauth-user"}
     */
    protected String getVerifyModuleCode() {
        // 显式模块编码优先于类名推导，保证对外编码遵循业务模块契约。
        ModuleDescription moduleDescription = getClass().getAnnotation(ModuleDescription.class);
        // 注解编码非空时去除首尾空格后直接返回。
        if (moduleDescription != null && !moduleDescription.code().trim().isEmpty()) {
            return moduleDescription.code().trim();
        }
        // 未声明编码时读取控制器类名作为唯一推导来源。
        String simpleName = getClass().getSimpleName();
        // 去掉 Controller 后缀后只保留业务名称部分。
        String businessName = simpleName.endsWith("Controller")
            ? simpleName.substring(0, simpleName.length() - "Controller".length())
            : simpleName;
        // 业务名称统一转换成短横线小写编码供验证响应使用。
        return convertCamelCaseToKebabCase(businessName);
    }

    /**
     * 返回当前控制器声明的全部可访问路径。
     *
     * @return 带 HTTP 方法的稳定路径列表，例如
     *     {@code ["GET /users/getStore","POST /users/insert","GET /users/verify/http"]}
     */
    protected List<String> getVerifyAvailablePaths() {
        // 有序集合保证反射扫描结果去重后仍保持稳定输出顺序。
        Set<String> availablePathSet = new LinkedHashSet<>();
        // 类级 RequestMapping 作为所有业务方法的公共路径前缀。
        String classPath = resolvePrimaryPath(getClass().getAnnotation(RequestMapping.class));
        // 扫描当前控制器公开方法，只收集真实声明 RequestMapping 的 HTTP 入口。
        for (Method method : getClass().getMethods()) {
            // 没有请求映射的方法不属于可访问接口。
            RequestMapping methodMapping = method.getAnnotation(RequestMapping.class);
            if (methodMapping == null) {
                continue;
            }
            // 类级和方法级路径统一拼接，避免输出双斜杠或缺少前导斜杠。
            String fullPath = joinPaths(classPath, resolvePrimaryPath(methodMapping));
            // 没有显式 HTTP 方法时按现有验证口径显示为 GET。
            if (methodMapping.method().length == 0) {
                availablePathSet.add("GET " + fullPath);
                continue;
            }
            // 一个入口声明多个 HTTP 方法时逐项输出，供联调方直接识别完整访问方式。
            for (RequestMethod requestMethod : methodMapping.method()) {
                availablePathSet.add(requestMethod.name() + " " + fullPath);
            }
        }
        // 返回独立列表，避免调用方修改内部去重集合。
        return new ArrayList<>(availablePathSet);
    }

    /**
     * 读取 RequestMapping 的主路径片段。
     *
     * @param requestMapping 来自控制器类或方法的 Spring 映射注解，例如 {@code @RequestMapping("/users")}
     * @return 首个主路径片段，例如 {@code "/users"}；注解或路径为空时返回空串
     */
    private String resolvePrimaryPath(RequestMapping requestMapping) {
        // 没有类级或方法级注解时使用空片段，让另一侧路径仍可正常输出。
        if (requestMapping == null) {
            return "";
        }
        // value 是当前工程主要写法，因此优先读取第一个 value。
        if (requestMapping.value().length > 0) {
            return requestMapping.value()[0];
        }
        // value 未提供时兼容 Spring 的 path 属性。
        if (requestMapping.path().length > 0) {
            return requestMapping.path()[0];
        }
        // 空 RequestMapping 表示当前层级不增加路径片段。
        return "";
    }

    /**
     * 拼接类级别和方法级别路径。
     *
     * @param classPath 控制器类级路径，例如 {@code "/users"}
     * @param methodPath 控制器方法级路径，例如 {@code "/getById"}
     * @return 规范化完整路径，例如 {@code "/users/getById"}
     */
    private String joinPaths(String classPath, String methodPath) {
        // 路径空值统一转换为空串，保证后续规范化逻辑稳定。
        String normalizedClassPath = classPath == null ? "" : classPath.trim();
        // 方法路径采用同一空值和首尾空格处理口径。
        String normalizedMethodPath = methodPath == null ? "" : methodPath.trim();
        // 没有类级前缀时直接规范化方法路径。
        if (normalizedClassPath.isEmpty()) {
            return ensureLeadingSlash(normalizedMethodPath);
        }
        // 没有方法片段时直接返回规范化类级路径。
        if (normalizedMethodPath.isEmpty()) {
            return ensureLeadingSlash(trimTrailingSlash(normalizedClassPath));
        }
        // 类级根路径不参与字符串拼接，避免产生双斜杠。
        if ("/".equals(normalizedClassPath)) {
            return ensureLeadingSlash(normalizedMethodPath);
        }
        // 两段路径都存在时清理边界斜杠后形成唯一完整路径。
        return ensureLeadingSlash(trimTrailingSlash(normalizedClassPath))
            + "/"
            + trimLeadingSlash(normalizedMethodPath);
    }

    /**
     * 确保路径以斜杠开头。
     *
     * @param path 来自 RequestMapping 的原始路径，例如 {@code "users/getById"}
     * @return 带前导斜杠的路径，例如 {@code "/users/getById"}；空路径返回 {@code "/"}
     */
    private String ensureLeadingSlash(String path) {
        // 空路径统一表示根路径。
        if (path == null || path.trim().isEmpty()) {
            return "/";
        }
        // 已有前导斜杠时保持原路径。
        if (path.startsWith("/")) {
            return path;
        }
        // 普通相对路径补充前导斜杠后对外展示。
        return "/" + path;
    }

    /**
     * 去掉路径前导斜杠。
     *
     * @param path 来自方法映射的原始路径，例如 {@code "/getById"}
     * @return 去掉一层前导斜杠的路径，例如 {@code "getById"}
     */
    private String trimLeadingSlash(String path) {
        // 拼接前只移除一层方法路径前导斜杠，避免影响路径正文。
        return path.startsWith("/") ? path.substring(1) : path;
    }

    /**
     * 去掉路径尾部斜杠。
     *
     * @param path 来自类级映射的原始路径，例如 {@code "/users///"}
     * @return 去掉全部尾部斜杠的路径，例如 {@code "/users"}
     */
    private String trimTrailingSlash(String path) {
        // 持续移除多余尾斜杠，让类级路径只保留有效部分。
        while (path.endsWith("/")) {
            path = path.substring(0, path.length() - 1);
        }
        // 返回可与方法路径安全拼接的类级路径。
        return path;
    }

    /**
     * 把驼峰命名转换成短横线小写编码。
     *
     * @param camelCaseValue 来自控制器类名的业务部分，例如 {@code "UniauthUser"}
     * @return 短横线小写编码，例如 {@code "uniauth-user"}；空文本返回空串
     */
    private String convertCamelCaseToKebabCase(String camelCaseValue) {
        // 空业务名称对应空模块编码，保持纯 Controller 类名的边界行为稳定。
        if (camelCaseValue == null || camelCaseValue.isEmpty()) {
            return "";
        }
        // 字符串构建器按字符形成稳定的 kebab-case 编码。
        StringBuilder kebabCaseBuilder = new StringBuilder();
        // 逐字符识别驼峰边界并生成小写模块编码。
        for (int index = 0; index < camelCaseValue.length(); index++) {
            // 当前字符用于判断是否需要插入单个短横线。
            char currentChar = camelCaseValue.charAt(index);
            // 非首位大写字符表示新的业务单词开始。
            if (Character.isUpperCase(currentChar) && index > 0) {
                kebabCaseBuilder.append('-');
            }
            // 所有字符统一转为小写写入最终编码。
            kebabCaseBuilder.append(Character.toLowerCase(currentChar));
        }
        // 返回可直接写入验证接口 moduleCode 的稳定编码。
        return kebabCaseBuilder.toString();
    }
}
