package com.sp.selplat.common.exception;

/**
 * 公共系统异常表达数据库、文件、远程服务或运行环境导致的技术失败。
 * 异常向调用方提供稳定错误编码和安全提示，同时必须保留原始原因供服务端日志诊断。
 */
public class CommonSystemException extends RuntimeException {

    // 稳定系统错误编码供全局处理器和监控聚合同类技术故障。
    private final String errorCode;

    /**
     * 创建包含真实底层原因的系统异常。
     *
     * @param errorCode 来自公共基础设施或应用 Service 的稳定错误编码，例如 {@code DATABASE_QUERY_FAILED}
     * @param safeMessage 可安全返回调用方的通用提示，例如 {@code 数据读取失败，请稍后重试。}
     * @param cause 数据库、文件或远程调用产生的原始异常，例如 {@code SQLException("connection closed")}
     * 执行结果示例：响应只使用 {@code DATABASE_QUERY_FAILED/数据读取失败，请稍后重试。}，
     *     服务端日志仍可通过 {@link #getCause()} 读取原始 SQLException。
     */
    public CommonSystemException(String errorCode, String safeMessage, Throwable cause) {
        // 安全提示和原始技术原因 → RuntimeException 标准消息与 cause 链。
        super(safeMessage, cause);
        // 稳定系统编码 → 公共异常响应的 errorCode 和日志聚合键。
        this.errorCode = errorCode;
    }

    /**
     * 返回调用方和监控可稳定识别的系统错误编码。
     *
     * @return 系统错误编码，例如 {@code DATABASE_QUERY_FAILED}
     */
    public String getErrorCode() {
        // 返回构造异常时写入的稳定编码，不把 cause 消息暴露为公开契约。
        return errorCode;
    }
}
