package com.sp.selplat.aifactory.audit.config;

import com.sp.selplat.aifactory.audit.service.AiAuditService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** 记录服务端亲自观察到的 API 方法、路径和结果，不记录正文与令牌。 */
@Component
public class AiApiAuditFilter extends OncePerRequestFilter {
    private final AiAuditService service;

    /**
     * 注入审计 Service。
     * 真实传参示例：Spring 注入 AiAuditServiceImpl。
     * 真实返回示例：过滤器可审计 /api/v1/ai-factory/**。
     * 异常或副作用示例：Service 缺失时启动失败；构造过程不读取请求。
     * @param service 服务端审计服务
     */
    public AiApiAuditFilter(AiAuditService service) { this.service = service; }

    /**
     * 执行请求并在响应形成后登记脱敏尝试事实。
     * 真实传参示例：POST /api/v1/ai-factory/tasks，X-Client-Id=CLIENT-MAC-1。
     * 真实返回示例：方法无业务返回，响应仍由原 Controller 产生。
     * 异常或副作用示例：原调用异常继续抛出；finally 中登记状态，且不读取 Authorization/正文。
     * @param request 当前 HTTP 请求
     * @param response 当前 HTTP 响应
     * @param filterChain 后续过滤器链
     * @throws ServletException 下游 Servlet 失败
     * @throws IOException 响应写入失败
     */
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String requestId = safeRequestId(request.getHeader("X-Request-Id"));
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setHeader("X-Request-Id", requestId);
        try {
            filterChain.doFilter(request, response);
        } finally {
            if (request.getRequestURI().startsWith("/api/v1/ai-factory/")) {
                service.recordHttpAttempt(value(request.getHeader("X-Client-Id"), "UNKNOWN_CLIENT"),
                        request.getMethod(), request.getRequestURI(), response.getStatus(), requestId);
            }
        }
    }

    private String safeRequestId(String candidate) {
        return candidate != null && candidate.matches("[A-Za-z0-9._-]{1,100}")
                ? candidate : UUID.randomUUID().toString();
    }

    private String value(String candidate, String fallback) {
        return candidate == null || candidate.isBlank() ? fallback : candidate.substring(0, Math.min(candidate.length(), 100));
    }
}
