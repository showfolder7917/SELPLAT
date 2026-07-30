package com.sp.selplat.common.web.exception;

/**
 * 公共业务异常表达应用层已经预判、可安全展示给前端的业务失败。
 * 它只携带稳定错误编码和业务提示，不承载数据库堆栈或应用模块专属响应结构。
 */
public class CommonBusinessException extends RuntimeException {

    // errorCode 供公共异常处理器和前端使用同一个稳定业务失败标识。
    private final String errorCode;

    /**
     * 创建可由公共 Web 层统一响应的业务异常。
     *
     * @param errorCode 来源于应用 Service 的稳定业务编码，业务含义是前端处理分支，例如 {@code USER_NOT_FOUND}
     * @param message 来源于应用 Service 的安全展示文案，业务含义是页面错误提示，例如 {@code 用户不存在。}
     */
    public CommonBusinessException(String errorCode, String message) {
        // 安全业务提示 → RuntimeException.message，供日志和 CommonResult.msg 使用。
        super(message);
        // 稳定业务编码 → 公共异常响应的 CommonResult.errorCode。
        this.errorCode = errorCode;
    }

    /**
     * 返回应用提供的稳定业务错误编码。
     *
     * @return 前端可识别的业务编码，例如 {@code USER_NOT_FOUND}
     */
    public String getErrorCode() {
        return errorCode;
    }
}
