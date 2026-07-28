package com.sp.selplat.common.web.resolver;

import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.JsonUtils;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Enumeration;
import org.springframework.core.MethodParameter;
import org.springframework.util.StreamUtils;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

/**
 * 共通参数解析器抽象基类统一承接 JSON body、query string 和表单参数的合并逻辑。
 * 这里把控制器里重复出现的参数归并动作前移到 Spring MVC 参数解析阶段，
 * 让业务控制器只声明一个共通参数对象即可拿到最终生效的入参。
 *
 * @param <T> 当前解析器负责创建的 CommonParam 子类型，例如 {@code CommonPageParam}
 */
public abstract class AbstractCommonParamArgumentResolver<T extends CommonParam> implements HandlerMethodArgumentResolver {

    /**
     * 返回当前解析器支持的参数类型。
     *
     * @return 当前解析器唯一支持的参数类型，例如 {@code CommonPageParam.class}
     */
    protected abstract Class<T> getSupportedType();

    /**
     * 创建一个空的参数对象，供没有 JSON body 时承接请求参数。
     *
     * @return 可继续写入请求字段的空参数对象，例如 {@code {"paramMap":{}}}
     */
    protected abstract T createEmptyParam();

    /**
     * 把固定请求参数写回参数对象，例如分页页码和每页条数。
     *
     * @param targetParam 从 JSON body 创建或新建的目标参数，例如 {@code {"loginName":"admin"}}
     * @param request 当前 Servlet 请求，例如 query string 为 {@code pageNo=1&pageSize=10}
     * 执行结果示例：分页解析器把固定字段写为 {@code pageNo=1,pageSize=10}。
     */
    protected abstract void mergeFixedRequestParams(T targetParam, HttpServletRequest request);

    /**
     * 判断当前方法参数是否由当前解析器处理。
     *
     * @param parameter Spring 正在解析的控制器方法参数，例如类型为 {@code CommonPageParam}
     * @return 参数类型与当前支持类型完全一致时返回 {@code true}，否则返回 {@code false}
     */
    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        // 只有参数类型与当前解析器支持类型完全一致时才接管解析，避免 CommonParam 解析器误吞掉 CommonPageParam。
        return getSupportedType().equals(parameter.getParameterType());
    }

    /**
     * 解析最终共通参数对象。
     *
     * @param parameter Spring 正在解析的控制器方法参数，例如类型为 {@code CommonPageParam}
     * @param mavContainer 当前 Spring MVC 视图模型容器；REST 接口中可以为空
     * @param webRequest 当前 HTTP 请求包装，包含 JSON body、query string 或表单字段
     * @param binderFactory Spring 提供的数据绑定工厂；当前解析流程不直接使用
     * @return 合并后的参数，例如
     *     {@code {"pageNo":1,"pageSize":10,"paramMap":{"loginName":"admin","status":"1"}}}
     */
    @Override
    public Object resolveArgument(
        MethodParameter parameter,
        ModelAndViewContainer mavContainer,
        NativeWebRequest webRequest,
        WebDataBinderFactory binderFactory
    ) {
        // 当前解析器必须依赖原生 Servlet 请求对象，才能同时读取 body 和普通请求参数。
        HttpServletRequest request = webRequest.getNativeRequest(HttpServletRequest.class);
        // 非 Servlet 场景下直接回落到一个空参数对象，避免参数解析阶段抛出空指针。
        if (request == null) {
            return createEmptyParam();
        }
        // 先尝试从 JSON body 解析参数对象，保证 application/json 提交的业务字段能优先生效。
        T targetParam = resolveBodyParam(request);
        // body 为空时补一个空参数对象，供 query string 或表单参数继续写入。
        if (targetParam == null) {
            targetParam = createEmptyParam();
        }
        // 再把页码等固定请求参数写回目标对象，保证 JSON 和普通请求参数能在同一对象里汇总。
        mergeFixedRequestParams(targetParam, request);
        // 最后补充动态业务字段映射，让控制层和服务层继续沿用同一套 paramMap 读取口径。
        populateDynamicParams(targetParam, request);
        return targetParam;
    }

    /**
     * 在 JSON 请求中读取 body 并转换为当前解析器支持的参数类型。
     *
     * @param request 当前 Servlet 请求，例如 body 为 {@code {"loginName":"admin"}}
     * @return 参数对象，例如 {@code {"paramMap":{"loginName":"admin"}}}；
     *     非 JSON 或空 body 返回 null
     * @throws IllegalStateException 当请求体读取失败时抛出，例如
     *     {@code IllegalStateException("读取请求体失败: /users/getById")}
     */
    private T resolveBodyParam(HttpServletRequest request) {
        // 只有显式 JSON 请求才尝试读取 body，避免表单或普通 GET 请求无意义消费输入流。
        if (!isJsonRequest(request)) {
            return null;
        }
        try {
            // 统一按 UTF-8 读取请求体内容，避免 Windows 环境下因为默认编码导致 JSON 解析乱码。
            String requestBody = StreamUtils.copyToString(request.getInputStream(), StandardCharsets.UTF_8);
            // 请求体为空时直接回落为 null，让后续逻辑走空参数对象 + 请求参数补齐路线。
            if (!StringUtils.hasText(requestBody)) {
                return null;
            }
            // 统一按当前解析器声明的目标类型解析 JSON body，避免业务控制器再重复写一套反序列化代码。
            return JsonUtils.fromJson(requestBody, getSupportedType());
        } catch (IOException exception) {
            // 请求体读取失败说明当前请求本身已不完整，直接按非法状态抛出，避免后续业务收到半残参数。
            throw new IllegalStateException("读取请求体失败: " + request.getRequestURI(), exception);
        }
    }

    /**
     * 判断当前请求是否声明 JSON 内容类型。
     *
     * @param request 当前 Servlet 请求，例如 Content-Type 为 {@code application/json;charset=UTF-8}
     * @return Content-Type 包含 {@code application/json} 时返回 {@code true}，未声明时返回 {@code false}
     */
    private boolean isJsonRequest(HttpServletRequest request) {
        String contentType = request.getContentType();
        return contentType != null && contentType.toLowerCase().contains("application/json");
    }

    /**
     * 把 query string 或表单中的动态业务字段写入参数映射。
     *
     * @param targetParam 当前解析出的参数对象，例如 {@code {"paramMap":{}}}
     * @param request 当前 Servlet 请求，例如参数为 {@code loginName=admin&pageNo=1}
     * 执行结果示例：动态映射写入 {@code {"loginName":"admin"}}，固定分页字段不会重复写入。
     */
    private void populateDynamicParams(T targetParam, HttpServletRequest request) {
        // 逐个遍历请求参数，把分页固定字段之外的业务字段全部沉淀到共通参数对象中。
        Enumeration<String> parameterNames = request.getParameterNames();
        while (parameterNames.hasMoreElements()) {
            String parameterName = parameterNames.nextElement();
            // pageNo 和 pageSize 由分页参数对象单独承接，不再重复写入动态字段映射。
            if ("pageNo".equals(parameterName) || "pageSize".equals(parameterName)) {
                continue;
            }
            // 普通请求参数统一覆盖写回 paramMap，让 query string 和表单提交都能稳定进入服务层。
            targetParam.putParam(parameterName, request.getParameter(parameterName));
        }
    }
}
