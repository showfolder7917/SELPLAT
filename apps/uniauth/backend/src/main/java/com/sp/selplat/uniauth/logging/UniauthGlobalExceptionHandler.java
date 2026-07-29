package com.sp.selplat.uniauth.logging;

import java.io.PrintWriter;
import java.io.StringWriter;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.common.util.JsonUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * 全局异常处理器把业务和系统异常统一写入本地日志，并返回 CommonResult JSON。
 * 前端只需判断 success=false 并显示 msg；dev/test 才额外输出完整 stackTrace。
 */
@RestControllerAdvice
public class UniauthGlobalExceptionHandler {

    // 异常日志独立使用本类名称，保证完整堆栈只在此处输出一次。
    private static final Logger LOGGER = LoggerFactory.getLogger(UniauthGlobalExceptionHandler.class);
    // dev/test 覆盖为 true 时，响应才包含完整堆栈；默认 false 保护生产响应。
    @Value("${selplat.error.include-stacktrace:false}")
    private boolean includeStackTrace;

    /**
     * 将可预期业务异常转换为统一 CommonResult 错误响应。
     *
     * @param exception 当前业务异常，例如 {@code UniauthBusinessException("USER_NOT_FOUND", "用户不存在。")}
     * @return 业务错误 JSON，例如 {@code {"success":false,"errorType":"BUSINESS","errorCode":"USER_NOT_FOUND","msg":"用户不存在。"}}
     */
    @ExceptionHandler(UniauthBusinessException.class)
    public ResponseEntity<String> handleBusinessException(UniauthBusinessException exception) {
        // 读取请求拦截器建立的关联标识，使业务错误也能定位同一次请求日志。
        String requestId = MDC.get(UniauthRequestTraceInterceptor.REQUEST_ID);
        // 业务异常以 warn 级别记录编码和提示，完整堆栈仍在开发诊断场景可用。
        LOGGER.warn("businessRequestFailed requestId={} errorCode={} message={}", requestId, exception.getErrorCode(), exception.getMessage(), exception);
        // 业务错误使用 400 表示调用参数或业务状态不满足当前操作条件。
        return failureResponse(HttpStatus.BAD_REQUEST, "BUSINESS", exception.getErrorCode(), exception.getMessage(), requestId, exception);
    }

    /**
     * 将未被业务层处理的异常转换为统一 CommonResult 系统错误响应。
     *
     * @param exception 当前请求抛出的异常，例如 {@code IllegalArgumentException("pageNo 必须是数字")}
     * @return 系统错误 JSON，例如 {@code {"success":false,"errorType":"SYSTEM","errorCode":"INTERNAL_ERROR","msg":"系统异常，请稍后重试。"}}
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<String> handleUnexpectedException(Exception exception) {
        // 拦截器已建立 requestId；非 MVC 调用缺失时仍返回空字符串而不伪造关联关系。
        String requestId = MDC.get(UniauthRequestTraceInterceptor.REQUEST_ID);
        // 服务端记录完整堆栈，生产排查始终使用日志而不是前端回传的堆栈。
        LOGGER.error("requestFailed requestId={} exceptionType={}", requestId, exception.getClass().getName(), exception);
        // 未处理系统异常固定返回 500，前端只显示通用提示并用 requestId 关联本地堆栈。
        return failureResponse(HttpStatus.INTERNAL_SERVER_ERROR, "SYSTEM", "INTERNAL_ERROR", "系统异常，请稍后重试。", requestId, exception);
    }

    /**
     * 构建并按忽略空字段规则序列化统一失败响应。
     *
     * @param status 对外 HTTP 状态，例如 {@code 400} 或 {@code 500}
     * @param errorType 异常分类，例如 {@code BUSINESS} 或 {@code SYSTEM}
     * @param errorCode 稳定错误编码，例如 {@code USER_NOT_FOUND}
     * @param message 前端错误框显示文案，例如 {@code 用户不存在。}
     * @param requestId 当前请求关联标识，例如 {@code gateway-20260729-001}
     * @param exception 当前 Java 异常，用于 dev/test 完整堆栈
     * @return CommonResult JSON；prod 省略 stackTrace，dev/test 包含它
     */
    private ResponseEntity<String> failureResponse(HttpStatus status, String errorType, String errorCode, String message, String requestId, Exception exception) {
        // 失败结果固定 success=false，使前端无需区分 HTTP 400 与 500 就能统一弹框。
        CommonResult result = new CommonResult();
        result.setSuccess(false);
        // 错误分类和编码提供前端精确处理分支。
        result.setErrorType(errorType);
        result.setErrorCode(errorCode);
        // 请求关联标识让页面错误能对应到服务端同一次日志。
        result.setRequestId(requestId);
        // msg 是前端唯一需要直接显示的业务或系统提示。
        result.setMsg(message);
        // 只有诊断环境才携带完整堆栈；生产保持 null 并由 JsonUtils 自动忽略。
        if (includeStackTrace) {
            result.setStackTrace(stackTraceText(exception));
        }
        // 与 Controller 保持相同的忽略 null 序列化口径，成功字段不会被无意义输出。
        return ResponseEntity.status(status).contentType(MediaType.APPLICATION_JSON).body(JsonUtils.toJsonIgnoreNull(result));
    }

    /**
     * 把 Java 异常转换为完整文本堆栈，仅供已明确开启的 dev/test 响应使用。
     *
     * @param exception 当前异常，例如 {@code NumberFormatException}
     * @return 完整堆栈文本，例如以异常类型和首个调用位置开头的多行字符串
     */
    private String stackTraceText(Exception exception) {
        // StringWriter 在内存中接收 PrintWriter 输出，不创建临时文件或污染应用目录。
        StringWriter stackTraceWriter = new StringWriter();
        // PrintWriter 复用 Java 标准异常格式，保留 cause 链和每个调用位置。
        exception.printStackTrace(new PrintWriter(stackTraceWriter));
        // 返回完整堆栈，由 JSON 序列化器按字符串字段写给 dev/test 页面。
        return stackTraceWriter.toString();
    }
}
