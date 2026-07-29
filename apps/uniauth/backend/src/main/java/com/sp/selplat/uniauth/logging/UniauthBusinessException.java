package com.sp.selplat.uniauth.logging;

/**
 * Uniauth 业务异常表达可预期、可直接展示给前端的业务失败。
 * 它携带稳定错误编码和业务提示，不承载 Java 技术细节或数据库异常堆栈。
 */
public class UniauthBusinessException extends RuntimeException {

    // errorCode 是前端和日志共同使用的稳定业务异常标识。
    private final String errorCode;

    /**
     * 创建一个业务异常。
     *
     * @param errorCode 前端可识别的业务编码，例如 {@code USER_NOT_FOUND}
     * @param message 可直接显示的业务提示，例如 {@code 用户不存在。}
     */
    public UniauthBusinessException(String errorCode, String message) {
        // 父类保存可展示业务提示，异常处理器会将它写入 CommonResult.msg。
        super(message);
        // 保存机器可读错误编码，使前端可按业务类型选择交互。
        this.errorCode = errorCode;
    }

    /**
     * 返回业务异常编码。
     *
     * @return 业务编码，例如 {@code USER_NOT_FOUND}
     */
    public String getErrorCode() {
        // 返回当前业务失败的稳定编码，避免前端依赖中文文案判断分支。
        return errorCode;
    }
}
