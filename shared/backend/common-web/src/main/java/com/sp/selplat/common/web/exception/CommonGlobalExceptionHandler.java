package com.sp.selplat.common.web.exception;

import com.sp.selplat.common.exception.CommonBusinessException;
import com.sp.selplat.common.exception.CommonSystemException;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.common.util.JsonUtils;
import com.sp.selplat.common.web.trace.CommonRequestTraceInterceptor;
import java.io.PrintWriter;
import java.io.StringWriter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/**
 * 公共全局异常处理器把应用业务异常和未处理系统异常转换为统一 CommonResult JSON。
 * 它负责 Web 错误边界和生产信息保护，不判断具体应用业务，也不修改成功响应。
 */
@RestControllerAdvice
public class CommonGlobalExceptionHandler {

    // 异常日志集中使用公共处理器来源，保证一次失败只在 Web 边界输出完整堆栈。
    private static final Logger LOGGER = LoggerFactory.getLogger(CommonGlobalExceptionHandler.class);
    // includeStackTrace 只在明确开启的开发或测试环境向响应附加完整 Java 堆栈。
    @Value("${selplat.error.include-stacktrace:false}")
    private boolean includeStackTrace;

    /**
     * 将应用主动抛出的公共业务异常转换为 HTTP 400 统一响应。
     *
     * @param exception 来源于应用 Service 的可展示业务异常，例如 {@code CommonBusinessException("USER_NOT_FOUND", "用户不存在。")}
     * @return 业务错误响应，例如 {@code {"success":false,"errorType":"BUSINESS","errorCode":"USER_NOT_FOUND","msg":"用户不存在。","requestId":"gateway-20260730-001"}}
     */
    @ExceptionHandler(CommonBusinessException.class)
    public ResponseEntity<String> handleBusinessException(CommonBusinessException exception) {
        // 当前 MDC requestId → 业务失败响应和日志的共同关联标识。
        String requestId = MDC.get(CommonRequestTraceInterceptor.REQUEST_ID_MDC_KEY);
        // 可预期业务失败 → warn 日志，完整异常只在服务端保留。
        LOGGER.warn(
            "businessRequestFailed requestId={} errorCode={} message={}",
            requestId,
            exception.getErrorCode(),
            exception.getMessage(),
            exception
        );
        // 业务异常事实 → HTTP 400 与 BUSINESS CommonResult。
        return failureResponse(
            HttpStatus.BAD_REQUEST,
            "BUSINESS",
            exception.getErrorCode(),
            exception.getMessage(),
            requestId,
            exception
        );
    }

    /**
     * 将应用或公共基础设施主动包装的系统异常转换为 HTTP 500 统一响应。
     *
     * @param exception 来源于 DAO、Service 或基础设施的系统异常，例如
     *     {@code CommonSystemException("DATABASE_QUERY_FAILED", "数据读取失败，请稍后重试。", cause)}
     * @return 系统错误响应，例如
     *     {@code {"success":false,"errorType":"SYSTEM","errorCode":"DATABASE_QUERY_FAILED",}
     *     {@code "msg":"数据读取失败，请稍后重试。","requestId":"gateway-20260807-001"}}
     */
    @ExceptionHandler(CommonSystemException.class)
    public ResponseEntity<String> handleSystemException(CommonSystemException exception) {
        // 当前 MDC requestId → 系统失败响应、完整异常日志和运维排查的共同关联标识。
        String requestId = MDC.get(CommonRequestTraceInterceptor.REQUEST_ID_MDC_KEY);
        // 已包装系统失败 → 服务端 error 日志，cause 链保留数据库或基础设施的真实故障。
        LOGGER.error(
            "systemRequestFailed requestId={} errorCode={}",
            requestId,
            exception.getErrorCode(),
            exception
        );
        // 已知系统失败事实 → HTTP 500 与带稳定编码的 SYSTEM CommonResult。
        return failureResponse(
            HttpStatus.INTERNAL_SERVER_ERROR,
            "SYSTEM",
            exception.getErrorCode(),
            exception.getMessage(),
            requestId,
            exception
        );
    }

    /**
     * 将不存在的接口或静态资源转换为 HTTP 404，避免已删除旧接口被误报成系统故障。
     * 真实传参示例：请求已删除的 {@code /api/reference-data/admin/options/getStore.htm}。
     * 真实返回示例：返回 {@code {"errorType":"BUSINESS","errorCode":"RESOURCE_NOT_FOUND"}} 和 HTTP 404。
     * 异常或副作用示例：仅记录一次警告日志且不修改数据；真实未处理异常仍进入 500 处理器。
     *
     * @param exception Spring MVC 在路由和静态资源均未命中时抛出的异常
     * @return 不泄露服务器路径的统一 404 JSON 响应
     */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<String> handleNoResourceFoundException(NoResourceFoundException exception) {
        // 当前请求标识继续写入统一错误体，便于定位访问了哪个已删除或拼错的地址。
        String requestId = MDC.get(CommonRequestTraceInterceptor.REQUEST_ID_MDC_KEY);
        // 路由未命中属于客户端地址问题，只记录警告而不输出系统故障级别日志。
        LOGGER.warn("resourceNotFound requestId={} resourcePath={}", requestId, exception.getResourcePath());
        // 固定安全文案和稳定错误码，禁止把服务器内部资源解析细节暴露到页面。
        return failureResponse(
            HttpStatus.NOT_FOUND,
            "BUSINESS",
            "RESOURCE_NOT_FOUND",
            "请求的资源不存在。",
            requestId,
            exception
        );
    }

    /**
     * 将未被应用处理的异常转换为 HTTP 500 通用响应。
     *
     * @param exception 来源于 Controller、参数解析器或 Service 的未处理异常，例如 {@code NumberFormatException("For input string: not-a-number")}
     * @return 系统错误响应，例如 {@code {"success":false,"errorType":"SYSTEM","errorCode":"INTERNAL_ERROR","msg":"系统异常，请稍后重试。","requestId":"运行时UUID"}}
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<String> handleUnexpectedException(Exception exception) {
        // 当前 MDC requestId → 页面反馈与服务端完整异常堆栈的关联入口。
        String requestId = MDC.get(CommonRequestTraceInterceptor.REQUEST_ID_MDC_KEY);
        // 未处理异常 → 服务端 error 日志，生产响应不泄露原始异常消息。
        LOGGER.error("requestFailed requestId={} exceptionType={}", requestId, exception.getClass().getName(), exception);
        // 未知失败事实 → HTTP 500 与固定 SYSTEM CommonResult。
        return failureResponse(
            HttpStatus.INTERNAL_SERVER_ERROR,
            "SYSTEM",
            "INTERNAL_ERROR",
            "系统异常，请稍后重试。",
            requestId,
            exception
        );
    }

    /**
     * 构建公共错误对象并按忽略空字段规则序列化。
     *
     * @param status 公共异常映射后的 HTTP 状态，例如 {@code 400 BAD_REQUEST}
     * @param errorType 前端错误分类，例如 {@code BUSINESS}
     * @param errorCode 前端稳定处理编码，例如 {@code USER_NOT_FOUND}
     * @param message 页面可安全展示的提示，例如 {@code 用户不存在。}
     * @param requestId 当前 HTTP 请求关联标识，例如 {@code gateway-20260730-001}
     * @param exception 当前原始异常，例如 {@code CommonBusinessException("USER_NOT_FOUND", "用户不存在。")}
     * @return HTTP JSON 响应；生产示例为 {@code {"success":false,"errorType":"BUSINESS","errorCode":"USER_NOT_FOUND","requestId":"gateway-20260730-001","msg":"用户不存在。"}}
     */
    private ResponseEntity<String> failureResponse(
        HttpStatus status,
        String errorType,
        String errorCode,
        String message,
        String requestId,
        Exception exception
    ) {
        // 新建失败结果 → success=false 的统一前端判断入口。
        CommonResult result = new CommonResult();
        result.setSuccess(false);
        // 异常分类与稳定编码 → 前端精确业务处理分支。
        result.setErrorType(errorType);
        result.setErrorCode(errorCode);
        // 当前请求标识 → 页面问题反馈可反查同一次服务端日志。
        result.setRequestId(requestId);
        // 安全文案 → CommonResult.msg，系统异常不回传原始技术信息。
        result.setMsg(message);
        // 开发或测试显式开关 → 响应包含完整堆栈；生产保持 null 并在序列化时省略。
        if (includeStackTrace) {
            result.setStackTrace(stackTraceText(exception));
        }
        // CommonResult → 固定 HTTP 状态和 application/json 响应，不创建模块专属包装层。
        return ResponseEntity
            .status(status)
            .contentType(MediaType.APPLICATION_JSON)
            .body(JsonUtils.toJsonIgnoreNull(result));
    }

    /**
     * 把原始 Java 异常转换为仅供诊断环境使用的完整文本堆栈。
     *
     * @param exception 当前异常，例如 {@code NumberFormatException("For input string: not-a-number")}
     * @return 包含异常类型、消息、调用位置和 cause 链的多行文本，例如首行为 {@code java.lang.NumberFormatException: For input string: "not-a-number"}
     */
    private String stackTraceText(Exception exception) {
        // 内存字符缓冲区 → 接收标准 Java 异常打印结果，不创建业务文件。
        StringWriter stackTraceWriter = new StringWriter();
        // 原始异常 → 保留异常类型、调用栈和 cause 链的标准文本。
        exception.printStackTrace(new PrintWriter(stackTraceWriter));
        // 完整堆栈文本 → 仅由诊断开关控制写入 CommonResult.stackTrace。
        return stackTraceWriter.toString();
    }
}
