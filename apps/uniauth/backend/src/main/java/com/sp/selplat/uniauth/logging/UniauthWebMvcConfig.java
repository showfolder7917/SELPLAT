package com.sp.selplat.uniauth.logging;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Uniauth MVC 配置把请求追踪拦截器注册到全部 API 路径。
 * 公共模块仍只负责参数解析；应用级日志策略由本应用自行决定，避免其他应用被强制采用。
 */
@Configuration
public class UniauthWebMvcConfig implements WebMvcConfigurer {

    // 注入请求追踪拦截器，保证每个 Uniauth API 进入 Controller 前已拥有 requestId。
    private final UniauthRequestTraceInterceptor requestTraceInterceptor;

    /**
     * 创建 Uniauth Web 日志配置。
     *
     * @param requestTraceInterceptor 当前应用的 requestId 与访问日志拦截器，例如 {@code UniauthRequestTraceInterceptor}
     */
    @Autowired
    public UniauthWebMvcConfig(UniauthRequestTraceInterceptor requestTraceInterceptor) {
        // 保存应用级拦截器，后续注册到 Spring MVC 请求链。
        this.requestTraceInterceptor = requestTraceInterceptor;
    }

    /**
     * 注册 Uniauth 全部 HTTP API 的请求追踪能力。
     *
     * @param registry Spring MVC 拦截器注册表
     */
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // 只匹配 Uniauth API，避免静态资源和未来管理端页面产生无业务意义的访问日志。
        registry.addInterceptor(requestTraceInterceptor).addPathPatterns("/api/uniauth/**");
    }
}
