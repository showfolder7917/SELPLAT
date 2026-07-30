package com.sp.selplat.common.web.config;

import com.sp.selplat.common.web.resolver.CommonPageParamArgumentResolver;
import com.sp.selplat.common.web.resolver.CommonParamArgumentResolver;
import com.sp.selplat.common.web.trace.CommonRequestTraceInterceptor;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 公共 MVC 配置统一注册参数解析和 API 请求追踪两类 Web 基础能力。
 * 它只负责 Spring MVC 装配，不包含异常响应内容、追踪算法或应用专属路径。
 */
@Configuration
public class CommonWebMvcConfig implements WebMvcConfigurer {

    // 分页参数解析器把分页 Controller 入参统一转换为 CommonPageParam。
    private final CommonPageParamArgumentResolver commonPageParamArgumentResolver;
    // 普通参数解析器把剩余 Controller 入参统一转换为 CommonParam。
    private final CommonParamArgumentResolver commonParamArgumentResolver;
    // 请求追踪拦截器为所有平台 API 提供 requestId、MDC 和耗时日志。
    private final CommonRequestTraceInterceptor commonRequestTraceInterceptor;

    /**
     * 创建公共 MVC 自动注册配置。
     *
     * @param commonPageParamArgumentResolver 来源于 common-web 容器的分页解析器，例如 {@code CommonPageParamArgumentResolver}
     * @param commonParamArgumentResolver 来源于 common-web 容器的普通参数解析器，例如 {@code CommonParamArgumentResolver}
     * @param commonRequestTraceInterceptor 来源于 common-web 容器的请求追踪器，例如 {@code CommonRequestTraceInterceptor}
     */
    @Autowired
    public CommonWebMvcConfig(
        CommonPageParamArgumentResolver commonPageParamArgumentResolver,
        CommonParamArgumentResolver commonParamArgumentResolver,
        CommonRequestTraceInterceptor commonRequestTraceInterceptor
    ) {
        // Spring 注入的分页解析器 → 公共 MVC 参数解析链。
        this.commonPageParamArgumentResolver = commonPageParamArgumentResolver;
        // Spring 注入的普通解析器 → 公共 MVC 参数解析链。
        this.commonParamArgumentResolver = commonParamArgumentResolver;
        // Spring 注入的追踪拦截器 → 公共 API 请求处理链。
        this.commonRequestTraceInterceptor = commonRequestTraceInterceptor;
    }

    /**
     * 按具体类型优先顺序注册公共 Controller 参数解析器。
     *
     * @param argumentResolvers 来源于 Spring MVC 的解析器列表，业务含义是追加分页和普通参数解析能力，例如初始空列表
     */
    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> argumentResolvers) {
        // 分页解析器先加入 → CommonPageParam 不会被普通 CommonParam 规则提前接管。
        argumentResolvers.add(commonPageParamArgumentResolver);
        // 普通解析器后加入 → 非分页公共参数仍获得 body 与请求参数合并能力。
        argumentResolvers.add(commonParamArgumentResolver);
    }

    /**
     * 为平台统一 API 路径注册公共请求追踪。
     *
     * @param registry 来源于 Spring MVC 的拦截器注册表，业务含义是把追踪器挂到 {@code /api/**}
     */
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // 公共追踪器 + /api/** → 覆盖当前和未来应用 API，同时排除静态页面与普通资源请求。
        registry.addInterceptor(commonRequestTraceInterceptor).addPathPatterns("/api/**");
    }
}
