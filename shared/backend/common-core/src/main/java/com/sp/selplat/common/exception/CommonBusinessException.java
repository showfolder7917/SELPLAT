package com.sp.selplat.common.exception;

/**
 * 公共业务异常表达 Service 或领域校验已经预判、可安全展示给调用方的业务失败。
 * 异常只携带稳定错误编码、安全业务提示和可选原始原因，不负责决定 HTTP 状态或响应结构。
 */
public class CommonBusinessException extends RuntimeException {

    // 稳定业务错误编码供全局处理器写入 CommonResult.errorCode，并供前端选择精确交互分支。
    private final String errorCode;

    /**
     * 创建没有底层原因的可预期业务异常。
     *
     * @param errorCode 来自业务 Service 的稳定错误编码，例如 {@code RECORD_NOT_FOUND}
     * @param message 可安全展示给调用方的业务提示，例如 {@code 未找到对应的数据。}
     * 执行结果示例：异常保存 {@code errorCode=RECORD_NOT_FOUND} 和
     *     {@code message=未找到对应的数据。}，由 Web 层转换为 BUSINESS 失败响应。
     */
    public CommonBusinessException(String errorCode, String message) {
        // 无底层异常的业务失败 → 只保存安全提示和稳定编码。
        this(errorCode, message, null);
    }

    /**
     * 创建包含底层原因、但仍可安全展示业务提示的业务异常。
     *
     * @param errorCode 来自业务 Service 的稳定错误编码，例如 {@code USER_SAVE_CONFLICT}
     * @param message 可安全展示给调用方的业务提示，例如 {@code 登录账号已经存在。}
     * @param cause 触发业务失败的原始原因，例如数据库唯一约束异常；只进入服务端日志
     * 执行结果示例：异常对外保留 {@code USER_SAVE_CONFLICT/登录账号已经存在。}，
     *     同时通过 {@link #getCause()} 保留数据库原始异常供日志追踪。
     */
    public CommonBusinessException(String errorCode, String message, Throwable cause) {
        // 安全业务提示和原始原因 → RuntimeException 标准消息与 cause 链。
        super(message, cause);
        // 稳定业务编码 → 公共异常响应的 errorCode。
        this.errorCode = errorCode;
    }

    /**
     * 返回调用方可稳定识别的业务错误编码。
     *
     * @return 业务错误编码，例如 {@code RECORD_NOT_FOUND}
     */
    public String getErrorCode() {
        // 返回构造异常时写入的稳定编码，不根据异常消息临时推导。
        return errorCode;
    }
}
