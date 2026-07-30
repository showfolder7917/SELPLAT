package com.sp.selplat.common.web.trace;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * 公共请求追踪拦截器为每次 API 调用建立 requestId、MDC 和请求耗时日志。
 * 它只记录 HTTP 基础事实，不读取请求正文、认证信息或应用业务字段。
 */
@Component
public class CommonRequestTraceInterceptor implements HandlerInterceptor {

    // REQUEST_ID_MDC_KEY 统一异常处理器、操作日志和请求日志读取的 MDC 字段名。
    public static final String REQUEST_ID_MDC_KEY = "requestId";
    // REQUEST_ID_HEADER 统一接收上游关联标识并把最终标识回传给调用方。
    public static final String REQUEST_ID_HEADER = "X-Request-Id";
    // 请求开始时间只保存在当前 HttpServletRequest，避免 Tomcat 线程复用造成跨请求污染。
    private static final String REQUEST_STARTED_AT = CommonRequestTraceInterceptor.class.getName() + ".startedAt";
    // 请求日志集中使用公共拦截器来源，便于按 HTTP 入口维度检索。
    private static final Logger LOGGER = LoggerFactory.getLogger(CommonRequestTraceInterceptor.class);

    /**
     * 在 Controller 参数解析和业务调用前建立请求追踪上下文。
     *
     * @param request 来源于 Spring MVC 的当前 HTTP 请求，业务含义是读取方法、URI 和上游 requestId，例如 {@code GET /api/uniauth/users/getStore.htm}
     * @param response 来源于 Spring MVC 的当前 HTTP 响应，业务含义是回写最终 {@code X-Request-Id}
     * @param handler 来源于 Spring MVC 路由匹配的处理器，例如 {@code UniauthUserController.getStore}
     * @return 固定 {@code true}，例如请求建立 requestId 后继续进入 Controller
     */
    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        // 合法上游标识或新 UUID → 当前请求唯一 requestId。
        String requestId = resolveRequestId(request.getHeader(REQUEST_ID_HEADER));
        // requestId → MDC，使同线程业务日志和异常日志自动关联当前请求。
        MDC.put(REQUEST_ID_MDC_KEY, requestId);
        // requestId → HTTP 响应头，调用方可把页面错误与服务端日志对应。
        response.setHeader(REQUEST_ID_HEADER, requestId);
        // 当前单调时间 → 请求结束阶段计算完整 MVC 调用耗时。
        request.setAttribute(REQUEST_STARTED_AT, System.nanoTime());
        // HTTP 方法与 URI → 无敏感内容的请求入口日志。
        LOGGER.info("requestStart method={} uri={}", request.getMethod(), request.getRequestURI());
        return true;
    }

    /**
     * 在请求完成后记录状态、异常类型和耗时，并清理当前线程 MDC。
     *
     * @param request 来源于 Spring MVC 的已完成请求，例如 {@code GET /api/uniauth/users/getStore.htm}
     * @param response 来源于 Spring MVC 的最终响应，例如状态码 {@code 200}
     * @param handler 来源于 Spring MVC 的已执行处理器，例如 {@code UniauthUserController.getStore}
     * @param exception 来源于 MVC 链的未处理异常，例如 {@code NumberFormatException}；已由全局处理器处理时为 {@code null}
     */
    @Override
    public void afterCompletion(
        HttpServletRequest request,
        HttpServletResponse response,
        Object handler,
        Exception exception
    ) {
        try {
            // 入口保存时间 → 当前请求真实毫秒耗时；入口缺失时使用 -1 标识不可计算。
            Object startedAt = request.getAttribute(REQUEST_STARTED_AT);
            long elapsedMs = startedAt instanceof Long started ? (System.nanoTime() - started) / 1_000_000 : -1;
            // 未处理异常 → 记录真实异常类型；正常或已处理响应保持空字符串。
            String exceptionType = exception == null ? "" : exception.getClass().getName();
            // 最终 HTTP 事实 → 方法、URI、状态、异常类型和耗时统一日志。
            LOGGER.info(
                "requestEnd method={} uri={} status={} exceptionType={} elapsedMs={}",
                request.getMethod(),
                request.getRequestURI(),
                response.getStatus(),
                exceptionType,
                elapsedMs
            );
        } finally {
            // 请求结束 → 清理线程 MDC，防止容器线程复用时携带旧 requestId。
            MDC.remove(REQUEST_ID_MDC_KEY);
        }
    }

    /**
     * 接受安全的上游 requestId，缺失或非法时生成新 UUID。
     *
     * @param incomingRequestId 来源于 {@code X-Request-Id} 请求头，业务含义是跨服务关联标识，例如 {@code gateway-20260730-001}
     * @return 最终请求标识，例如 {@code gateway-20260730-001} 或运行时随机 UUID
     */
    private String resolveRequestId(String incomingRequestId) {
        // 长度受限且无控制字符的上游值 → 保持跨服务追踪关系。
        if (incomingRequestId != null && incomingRequestId.matches("[A-Za-z0-9._-]{1,128}")) {
            return incomingRequestId;
        }
        // 缺失或非法上游值 → 为当前请求生成独立随机 UUID。
        return UUID.randomUUID().toString();
    }
}
