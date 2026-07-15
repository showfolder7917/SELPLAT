package com.sp.selplat.common.controller;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestMapping;

/**
 * 公共控制器扩展基类用于承接验证接口相关的细节实现，避免主基类堆积过多辅助逻辑。
 * 当前统一沉淀模块验证文案、路径扫描和路由拼接能力，供 BaseController 直接复用。
 */
public abstract class BaseExtendsController {

    /**
     * 返回当前控制器的模块编码。
     *
     * @return 当前控制器模块编码
     */
    protected String getVerifyModuleCode() {
        // 控制器如果显式声明了模块说明注解，则优先使用注解里的稳定编码，避免模块编码推导结果和业务约定偏离。
        ModuleDescription moduleDescription = getClass().getAnnotation(ModuleDescription.class);
        if (moduleDescription != null && !moduleDescription.code().trim().isEmpty()) {
            return moduleDescription.code().trim();
        }
        // 先读取当前控制器的简单类名，作为模块编码推导的唯一来源，避免子类继续重复手写同样的模块标识。
        String simpleName = getClass().getSimpleName();
        // 控制器类名通常以 Controller 结尾，这里统一去掉后缀，让模块编码只保留真实业务名部分。
        String businessName = simpleName.endsWith("Controller") ? simpleName.substring(0, simpleName.length() - "Controller".length()) : simpleName;
        // 把驼峰业务名转换成短横线小写编码，例如 UniauthUser 转成 uniauth-user，保持接口返回的模块标识稳定可读。
        return convertCamelCaseToKebabCase(businessName);
    }

    /**
     * 返回当前控制器的验证说明。
     *
     * @return 当前控制器验证说明
     */
    protected String getVerifyMessage() {
        // 控制器如果显式声明了模块说明注解，则优先使用注解里的说明文案，避免子类继续重复实现同样的验证提示。
        ModuleDescription moduleDescription = getClass().getAnnotation(ModuleDescription.class);
        if (moduleDescription != null) {
            // description 只要有值就直接返回，保证调用方看到的就是控制器显式声明的职责说明。
            if (!moduleDescription.description().trim().isEmpty()) {
                return moduleDescription.description().trim();
            }
            // description 未声明时回退到模块名称，至少保证验证接口能返回一条可读提示，而不是空字符串。
            if (!moduleDescription.name().trim().isEmpty()) {
                return moduleDescription.name().trim() + "控制器已装配。";
            }
        }
        // 未声明模块说明注解时，统一回落到通用提示文案，保证所有控制器最少都有稳定的验证说明。
        return "控制器已装配。";
    }

    /**
     * 返回当前控制器的关键可访问路径列表。
     * 返回示例：
     * ["GET /api/uniauth/users/verify/http", "GET /api/uniauth/users/store.htm", "POST /api/uniauth/users/store.htm"]
     *
     * @return 当前控制器关键可访问路径列表
     */
    protected List<String> getVerifyAvailablePaths() {
        // 使用有序集合承接扫描出的访问路径，保证返回顺序稳定且自动去重。
        Set<String> availablePathSet = new LinkedHashSet<>();
        // 先读取当前控制器类上的 RequestMapping 前缀，供后续和每个方法路径自动拼接成完整 URL。
        String classPath = resolvePrimaryPath(getClass().getAnnotation(RequestMapping.class));
        // 扫描当前控制器对外公开的方法，把每个 RequestMapping 都收口成可直接联调的访问路径说明。
        for (Method method : getClass().getMethods()) {
            // 只处理显式声明了 RequestMapping 的方法，避免把 Object 或无路由方法误加入联调结果。
            RequestMapping methodMapping = method.getAnnotation(RequestMapping.class);
            if (methodMapping == null) {
                continue;
            }
            // 读取当前方法的主路径片段，供后续和类级别前缀拼成完整访问路径。
            String methodPath = resolvePrimaryPath(methodMapping);
            // 把类级别前缀和方法级别路径标准化拼接成最终 URL，避免出现双斜杠或缺少斜杠。
            String fullPath = joinPaths(classPath, methodPath);
            // 方法未显式声明请求方式时，联调输出默认按 GET 展示，保持当前验证接口文案口径稳定。
            if (methodMapping.method().length == 0) {
                availablePathSet.add("GET " + fullPath);
                continue;
            }
            // 当前方法如果声明了多个 HTTP Method，则逐个输出，方便联调方明确当前接口支持的访问方式。
            for (RequestMethod requestMethod : methodMapping.method()) {
                availablePathSet.add(requestMethod.name() + " " + fullPath);
            }
        }
        // 返回扫描完成后的关键访问路径列表，供公共验证接口统一回传给调用方。
        return new ArrayList<>(availablePathSet);
    }

    /**
     * 读取 RequestMapping 的主路径片段。
     *
     * @param requestMapping RequestMapping 注解
     * @return 主路径片段
     */
    private String resolvePrimaryPath(RequestMapping requestMapping) {
        // 当前注解不存在时返回空路径，便于后续拼接逻辑直接回落到另一侧路径。
        if (requestMapping == null) {
            return "";
        }
        // value 优先级高于 path，这里统一先读取 value，保持和当前项目注解书写习惯一致。
        if (requestMapping.value().length > 0) {
            return requestMapping.value()[0];
        }
        // value 未声明时回退到 path，兼容后续可能改用 path 属性的控制器写法。
        if (requestMapping.path().length > 0) {
            return requestMapping.path()[0];
        }
        // 当前注解既没有 value 也没有 path 时返回空字符串，表示当前层级不提供额外路径片段。
        return "";
    }

    /**
     * 拼接类级别和方法级别路径。
     *
     * @param classPath 类级别路径
     * @param methodPath 方法级别路径
     * @return 完整路径
     */
    private String joinPaths(String classPath, String methodPath) {
        // 统一把路径空值转成空串，避免后续 trim 或 startsWith 判断触发空指针。
        String normalizedClassPath = classPath == null ? "" : classPath.trim();
        // 方法路径同样先做空值保护，保证不同控制器写法都能安全进入统一拼接逻辑。
        String normalizedMethodPath = methodPath == null ? "" : methodPath.trim();
        // 类级别路径为空时，直接返回带斜杠的方法路径，兼容未声明类级别前缀的简单控制器。
        if (normalizedClassPath.isEmpty()) {
            return ensureLeadingSlash(normalizedMethodPath);
        }
        // 方法级别路径为空时，直接返回带斜杠的类级别前缀，兼容后续可能存在的根路由方法。
        if (normalizedMethodPath.isEmpty()) {
            return ensureLeadingSlash(normalizedClassPath);
        }
        // 两段路径都存在时，统一去掉多余边界斜杠后再拼接，避免生成双斜杠路径。
        return ensureLeadingSlash(trimTrailingSlash(normalizedClassPath)) + "/" + trimLeadingSlash(normalizedMethodPath);
    }

    /**
     * 确保路径以斜杠开头。
     *
     * @param path 原始路径
     * @return 带前导斜杠的路径
     */
    private String ensureLeadingSlash(String path) {
        // 空路径统一回落为根路径斜杠，避免联调输出出现空字符串。
        if (path == null || path.trim().isEmpty()) {
            return "/";
        }
        // 已有前导斜杠时直接返回，避免重复补斜杠。
        if (path.startsWith("/")) {
            return path;
        }
        // 当前路径缺少前导斜杠时自动补齐，保证所有输出 URL 形态一致。
        return "/" + path;
    }

    /**
     * 去掉路径前导斜杠。
     *
     * @param path 原始路径
     * @return 去掉前导斜杠后的路径
     */
    private String trimLeadingSlash(String path) {
        // 路径为空时直接返回空串，避免子串操作出现越界。
        if (path == null || path.isEmpty()) {
            return "";
        }
        // 当前路径以前导斜杠开头时去掉一层，便于和类路径统一拼接。
        return path.startsWith("/") ? path.substring(1) : path;
    }

    /**
     * 去掉路径尾部斜杠。
     *
     * @param path 原始路径
     * @return 去掉尾部斜杠后的路径
     */
    private String trimTrailingSlash(String path) {
        // 根路径斜杠不做裁剪，避免把合法根路径裁成空字符串。
        if ("/".equals(path)) {
            return path;
        }
        // 只要尾部还有斜杠就持续裁掉，兼容少数历史代码可能带多个尾部斜杠的情况。
        while (path.endsWith("/")) {
            path = path.substring(0, path.length() - 1);
        }
        // 返回已去尾斜杠的路径，供统一拼接逻辑继续使用。
        return path;
    }

    /**
     * 把驼峰命名转换成短横线小写编码。
     *
     * @param camelCaseValue 驼峰命名值
     * @return 短横线小写编码
     */
    private String convertCamelCaseToKebabCase(String camelCaseValue) {
        // 调用方未传类名时直接回落为空串，避免后续字符遍历触发空指针。
        if (camelCaseValue == null || camelCaseValue.isEmpty()) {
            return "";
        }
        // 使用字符串构建器逐字符转换模块编码，避免依赖额外工具类或正则增加阅读成本。
        StringBuilder kebabCaseBuilder = new StringBuilder();
        for (int index = 0; index < camelCaseValue.length(); index++) {
            // 读取当前字符，供后续判断是否需要在大写字母前插入短横线。
            char currentChar = camelCaseValue.charAt(index);
            // 非首字符遇到大写字母时先补短横线，再转成小写，形成稳定的 kebab-case 结构。
            if (Character.isUpperCase(currentChar) && index > 0) {
                kebabCaseBuilder.append('-');
            }
            // 把当前字符统一转成小写后写入结果，保证最终模块编码对外口径一致。
            kebabCaseBuilder.append(Character.toLowerCase(currentChar));
        }
        // 返回转换完成的模块编码，供验证接口直接写入 moduleCode 字段。
        return kebabCaseBuilder.toString();
    }
}
