package com.sp.selplat.common.controller;

import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonPageResult;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.common.util.CommonStoreResult;
import com.sp.selplat.common.util.JsonUtils;
import jakarta.servlet.http.HttpServletRequest;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestMapping;

/**
 * 公共控制器扩展基类用于承接验证接口相关的细节实现，避免主基类堆积过多辅助逻辑。
 * 当前统一沉淀模块验证文案、路径扫描、store 参数整理和 store 响应组装能力，供 BaseController 直接复用。
 */
public abstract class BaseExtendsController {

    /**
     * 把 JSON body、普通参数和请求参数统一合并成最终共通入参对象。
     *
     * @param requestBody JSON 请求体参数
     * @param paramIn Spring 绑定的普通请求参数
     * @param request HTTP 请求
     * @return 合并后的共通入参对象
     */
    protected CommonParam resolveCommonParam(
        CommonParam requestBody,
        CommonParam paramIn,
        HttpServletRequest request
    ) {
        // JSON 请求体存在时优先以 JSON 对象为主，保证 application/json 提交的业务字段可以直接生效。
        CommonParam finalParam = requestBody != null ? requestBody : paramIn;
        // GET 或表单提交在没有任何对象可用时，这里补一个默认共通入参，保证后续服务链路稳定。
        if (finalParam == null) {
            finalParam = new CommonParam();
        }
        // 再把请求参数补充进动态 Map，让 JSON、GET 和表单参数最终都汇总到同一份业务字段映射里。
        populateDynamicQueryParams(finalParam, request);
        // 返回已经完成多来源合并的共通入参对象，供控制层统一透传给服务层。
        return finalParam;
    }

    /**
     * 把 JSON body、分页参数和普通请求参数统一合并成最终查询对象。
     *
     * @param requestBody JSON 请求体参数
     * @param queryIn Spring 绑定的普通请求参数
     * @param request HTTP 请求
     * @return 合并后的查询对象
     */
    protected CommonPageParam resolveStoreQueryIn(
        CommonPageParam requestBody,
        CommonPageParam queryIn,
        HttpServletRequest request
    ) {
        // JSON 请求体存在时优先以 JSON 对象为主，保证前端 POST application/json 提交的分页与业务字段都能直接生效。
        CommonPageParam finalQueryIn = requestBody != null ? requestBody : queryIn;
        // GET 或表单提交在没有任何对象可用时，这里补一个默认共通参数，确保后续透传链路稳定。
        if (finalQueryIn == null) {
            finalQueryIn = new CommonPageParam();
        }
        // 普通请求参数若额外带了分页值，这里继续回填到最终对象，保证 query string 和 form 参数也能覆盖默认分页口径。
        if (queryIn != null) {
            finalQueryIn.setPageNo(queryIn.getPageNo());
            finalQueryIn.setPageSize(queryIn.getPageSize());
        }
        // 再把除分页字段外的请求参数补充进动态 Map，让 JSON、GET 和表单参数最终都汇总到同一份业务字段映射里。
        populateDynamicQueryParams(finalQueryIn, request);
        // 返回已经完成多来源合并的共通参数对象，供控制层统一透传给服务层。
        return finalQueryIn;
    }

    /**
     * 把 HTTP 请求中的动态业务字段提取到共通参数对象里。
     *
     * @param queryIn 通用分页参数
     * @param request HTTP 请求
     */
    protected void populateDynamicQueryParams(CommonParam queryIn, HttpServletRequest request) {
        // 请求对象为空时直接跳过，避免极端测试场景下控制层回填动态字段时触发空指针。
        if (queryIn == null || request == null) {
            return;
        }
        // 逐个遍历请求参数名，把分页字段之外的业务字段统一写入动态 Map，供 service 和 common-db 继续透传。
        Enumeration<String> parameterNames = request.getParameterNames();
        while (parameterNames.hasMoreElements()) {
            // 读取当前请求字段名，供后续识别分页保留字段和业务筛选字段。
            String parameterName = parameterNames.nextElement();
            // pageNo 和 pageSize 已由 Spring 直接绑定到分页基类，这里不重复写入动态 Map，避免同一语义出现双份来源。
            if ("pageNo".equals(parameterName) || "pageSize".equals(parameterName)) {
                continue;
            }
            // 读取当前字段值并写入动态 Map，让旧式 store 接口也能以通用对象承接任意筛选字段。
            queryIn.putParam(parameterName, request.getParameter(parameterName));
        }
    }

    /**
     * 按统一口径组装非分页接口返回对象。
     *
     * @param moduleCode 当前业务模块编码
     * @param requestPath 当前接口路径
     * @param result 服务层返回的业务结果
     * @param defaultMessage 当前接口默认说明文案
     * @return 统一非分页返回对象
     */
    protected CommonResult buildCommonResult(
        String moduleCode,
        String requestPath,
        CommonResult result,
        String defaultMessage
    ) {
        // 服务层未显式返回结果对象时，这里补一个空的共通结果，保证控制层对外口径稳定。
        CommonResult finalResult = result == null ? new CommonResult() : result;
        // 统一补成功标记，当前 helper 只服务正常执行完成的非分页控制器链路。
        finalResult.setSuccess(true);
        // 控制层统一写入模块编码，避免服务层感知 HTTP 返回包装语义。
        finalResult.setModuleCode(moduleCode);
        // 控制层统一写入当前命中的接口路径，保证所有非分页接口都带上可回看的路由信息。
        finalResult.setRequestPath(requestPath);
        // 服务层未单独给出提示文案时回退到控制层默认说明，避免接口返回 msg 为空。
        if (finalResult.getMsg() == null || finalResult.getMsg().trim().isEmpty()) {
            finalResult.setMsg(defaultMessage);
        }
        // 返回已经补齐模块和路由元数据的共通结果对象，供控制层直接序列化输出。
        return finalResult;
    }

    /**
     * 按统一口径组装非分页接口返回 JSON。
     *
     * @param moduleCode 当前业务模块编码
     * @param requestPath 当前接口路径
     * @param result 服务层返回的业务结果
     * @param defaultMessage 当前接口默认说明文案
     * @return 统一非分页 JSON 字符串
     */
    protected String buildCommonResultJson(
        String moduleCode,
        String requestPath,
        CommonResult result,
        String defaultMessage
    ) {
        // 控制层统一把共通返回对象序列化成 JSON，保证所有非分页接口对外字段口径一致。
        return JsonUtils.toJsonIgnoreNull(buildCommonResult(moduleCode, requestPath, result, defaultMessage));
    }

    /**
     * 按统一口径组装旧式 store 接口返回对象。
     *
     * @param moduleCode 当前业务模块编码
     * @param requestPath 当前 store 接口路径
     * @param queryIn 当前生效的查询参数对象
     * @param pageResult 公共分页查询结果
     * @param message 当前返回说明文案
     * @return 统一 store 返回对象
     */
    protected CommonStoreResult buildStoreResult(
        String moduleCode,
        String requestPath,
        CommonPageParam queryIn,
        CommonPageResult pageResult,
        String message
    ) {
        // 新建统一 store 返回对象，把旧式页面依赖的顶层字段集中到公共控制器层维护，避免服务层承担 HTTP 响应包装职责。
        CommonStoreResult storeResult = new CommonStoreResult();
        // success 固定标记当前 store 查询链路已成功执行，供前端或浏览器快速判断请求状态。
        storeResult.setSuccess(true);
        // moduleCode 标记具体业务来源，便于多模块都走 store 接口时仍能区分响应归属。
        storeResult.setModuleCode(moduleCode);
        // requestPath 回传命中的后端路由，方便联调时直接核对当前接口入口。
        storeResult.setRequestPath(requestPath);
        // query 回传最终生效的共通参数对象，供前端确认筛选条件和分页参数已经进入控制器透传链路。
        storeResult.setQuery(queryIn);
        // rows 统一承接当前页结果列表，保持旧式 store 页面仍能按 rows 字段直接渲染表格。
        storeResult.setRows(pageResult.getRecords());
        // total 统一回传总记录数，避免不同控制器对总数字段各自命名。
        storeResult.setTotal(pageResult.getTotalCount());
        // pageNo 统一回传当前页码，保证前后端分页状态字段口径一致。
        storeResult.setPageNo(pageResult.getPageNo());
        // pageSize 统一回传每页条数，方便联调确认分页设置是否正确透传。
        storeResult.setPageSize(pageResult.getPageSize());
        // msg 统一回传当前接口说明文案，让浏览器页面可直接显示当前 store 链路状态。
        storeResult.setMsg(message);
        // 返回已完成统一字段填充的 store 结果对象，供控制层直接序列化输出。
        return storeResult;
    }

    /**
     * 按统一口径组装旧式 store 接口返回 JSON。
     *
     * @param moduleCode 当前业务模块编码
     * @param requestPath 当前 store 接口路径
     * @param queryIn 当前生效的查询参数对象
     * @param pageResult 公共分页查询结果
     * @param message 当前返回说明文案
     * @return 统一 store JSON 字符串
     */
    protected String buildStoreResultJson(
        String moduleCode,
        String requestPath,
        CommonPageParam queryIn,
        CommonPageResult pageResult,
        String message
    ) {
        // 控制器层统一把标准 store 结果对象序列化成 JSON，保证所有 store 接口对外返回口径一致。
        return JsonUtils.toJsonIgnoreNull(buildStoreResult(moduleCode, requestPath, queryIn, pageResult, message));
    }

    /**
     * 返回当前控制器指定方法对应的单一路径。
     *
     * @param methodName 方法名
     * @return 当前方法路径
     */
    protected String getVerifyMethodPath(String methodName) {
        // 当前 helper 直接复用公共反射路径解析逻辑，让 CRUD 等单条接口也能稳定回填自己的 requestPath。
        String requestPath = resolveMethodRequestPath(methodName);
        // 成功解析到指定方法路由时直接返回，保证控制层回传的是当前真实命中的接口入口。
        if (!requestPath.isEmpty()) {
            return requestPath;
        }
        // 极端情况下未找到目标方法映射时回退根路径，避免 requestPath 出现 null。
        return "/";
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
     * 返回当前控制器 store 接口对应的单一路径。
     *
     * @return 当前 store 接口路径
     */
    protected String getVerifyAvailablePath() {
        // 旧式 store 返回里的 requestPath 只需要回传当前 store 接口入口，不应该误用整组 availablePaths 列表。
        String storeRequestPath = resolveMethodRequestPath("getStore");
        // 成功解析到当前控制器的 getStore 路由时直接返回，保证所有同结构控制器都能复用这一套反射推导逻辑。
        if (!storeRequestPath.isEmpty()) {
            return storeRequestPath;
        }
        // 极端情况下未找到 getStore 映射时回退根路径，避免旧式返回结构中的 requestPath 变成 null。
        return "/";
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
     * 按方法名解析当前控制器的完整请求路径。
     *
     * @param methodName 目标方法名
     * @return 完整请求路径
     */
    private String resolveMethodRequestPath(String methodName) {
        // 先读取当前控制器类级别前缀，保证最终返回路径和验证接口的全量路径拼接口径一致。
        String classPath = resolvePrimaryPath(getClass().getAnnotation(RequestMapping.class));
        // 扫描当前控制器对外方法，定位指定方法名上声明的 RequestMapping。
        for (Method method : getClass().getMethods()) {
            // 只处理名称命中的目标方法，避免把其他接口路径误当成当前 store 路由返回。
            if (!method.getName().equals(methodName)) {
                continue;
            }
            // 读取目标方法上的 RequestMapping，只有显式对外暴露的接口才参与路径拼接。
            RequestMapping methodMapping = method.getAnnotation(RequestMapping.class);
            if (methodMapping == null) {
                continue;
            }
            // 把类级别和方法级别路径按既有规则拼成完整 URL，保证 requestPath 与 verify 返回中的路径口径一致。
            return joinPaths(classPath, resolvePrimaryPath(methodMapping));
        }
        // 当前控制器未声明指定方法名的路由时返回空串，交由调用方决定最终回退策略。
        return "";
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
