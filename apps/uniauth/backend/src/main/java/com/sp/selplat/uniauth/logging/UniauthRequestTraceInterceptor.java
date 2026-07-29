package com.sp.selplat.uniauth.logging;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * HTTP 请求日志拦截器为一次请求分配 requestId，并记录 URI、状态和总耗时。
 * requestId 同时写入响应头和 MDC，使业务切面、异常日志与页面响应可以关联同一次调用。
 */
@Component
public class UniauthRequestTraceInterceptor implements HandlerInterceptor {

    // requestId 作为日志 MDC 键和 HTTP 响应头语义使用同一个稳定名称。
    public static final String REQUEST_ID = "requestId";
    // 请求开始时间只保存在当前 request attribute，避免跨请求共享可变状态。
    private static final String REQUEST_STARTED_AT = UniauthRequestTraceInterceptor.class.getName() + ".startedAt";
    // 访问日志独立使用本类名称，便于按 HTTP 请求维度检索。
    private static final Logger LOGGER = LoggerFactory.getLogger(UniauthRequestTraceInterceptor.class);

    /**
     * 在 Controller 执行前建立请求关联上下文。
     *
     * @param request 当前 HTTP 请求，例如 {@code POST /api/uniauth/users/create.htm}
     * @param response 当前 HTTP 响应；会写入 {@code X-Request-Id}
     * @param handler Spring 已匹配的 Controller 处理器
     * @return 固定 {@code true}，表示请求继续进入 Controller
     */
    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        // 优先继承上游传入的非空 requestId，缺失时由 Uniauth 生成随机 UUID。
        String requestId = resolveRequestId(request.getHeader("X-Request-Id"));
        // requestId 进入 MDC 后，同线程中的业务日志和异常日志都会自动带上该值。
        MDC.put(REQUEST_ID, requestId);
        // 响应头回传 requestId，前端可据此向后端反馈一次具体失败。
        response.setHeader("X-Request-Id", requestId);
        // 保存单调开始时间，供请求结束时计算完整 Controller 调用耗时。
        request.setAttribute(REQUEST_STARTED_AT, System.nanoTime());
        // 入口日志不打印请求体、Authorization 或 Cookie，避免泄露敏感信息。
        LOGGER.info("requestStart method={} uri={}", request.getMethod(), request.getRequestURI());
        return true;
    }

    /**
     * 在请求完成后记录最终 HTTP 状态、异常类型和耗时，并清理线程 MDC。
     *
     * @param request 当前 HTTP 请求，例如 {@code GET /api/uniauth/users/getStore.htm}
     * @param response 已写入状态码的 HTTP 响应，例如 {@code 200}
     * @param handler 已执行的 Controller 处理器
     * @param exception 未被处理的异常；全局异常处理后通常为 {@code null}
     */
    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception exception) {
        try {
            // 从当前请求读取入口保存的开始时间，保证耗时只属于当前请求。
            Object startedAt = request.getAttribute(REQUEST_STARTED_AT);
            // 入口时间存在时计算毫秒耗时，异常请求也保持相同日志字段。
            long elapsedMs = startedAt instanceof Long started ? (System.nanoTime() - started) / 1_000_000 : -1;
            // 未处理异常时输出其类型，具体堆栈仍由异常处理器负责记录。
            String exceptionType = exception == null ? "" : exception.getClass().getName();
            // 结束日志记录可检索的请求事实，不记录请求正文或业务敏感字段。
            LOGGER.info("requestEnd method={} uri={} status={} exceptionType={} elapsedMs={}", request.getMethod(), request.getRequestURI(), response.getStatus(), exceptionType, elapsedMs);
        } finally {
            // 请求结束必须清理 MDC，避免 Tomcat 线程复用后把旧 requestId 带入下一请求。
            MDC.remove(REQUEST_ID);
        }
    }

    /**
     * 从上游请求头取得安全 requestId，或生成当前服务可追踪的新值。
     *
     * @param incomingRequestId 上游网关传入的 {@code X-Request-Id}，例如 {@code gateway-20260729-001}
     * @return 最终 requestId，例如 {@code gateway-20260729-001} 或运行时 UUID
     */
    private String resolveRequestId(String incomingRequestId) {
        // 仅接受长度受限且不含控制字符的上游值，避免日志伪造和超长日志字段。
        if (incomingRequestId != null && incomingRequestId.matches("[A-Za-z0-9._-]{1,128}")) {
            return incomingRequestId;
        }
        // 没有合法上游值时生成 UUID，保证每个请求仍可独立关联。
        return UUID.randomUUID().toString();
    }
}
