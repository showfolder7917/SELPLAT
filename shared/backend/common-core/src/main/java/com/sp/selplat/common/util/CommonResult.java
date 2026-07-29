package com.sp.selplat.common.util;

/**
 * 通用返回对象统一承接非分页接口的标准响应结构。
 * 这里把单条查询、新增、更新和删除的结果统一收口成 success、data、affectedRows、msg 这一套稳定字段，
 * 避免各模块继续各自手拼 Map 导致返回结构不统一。
 */
public class CommonResult {

    // success 表示当前接口链路是否按预期完成，供前端统一判断请求结果。
    private boolean success;
    // moduleCode 标记当前返回所属模块，便于联调或统一日志快速定位来源。
    private String moduleCode;
    // requestPath 回传当前命中的接口路径，便于前端和联调人员核对调用入口。
    private String requestPath;
    // data 承接单条详情、保存后回显或删除结果等具体业务数据。
    private Object data;
    // affectedRows 仅在写入接口需要时返回数据库累计影响行数，普通查询保持为空并由 JSON 序列化忽略。
    private Integer affectedRows;
    // msg 统一承接当前接口的结果说明文案，便于前端直接显示操作结果。
    private String msg;
    // errorType 区分 BUSINESS 与 SYSTEM，成功响应保持 null 并由 JsonUtils 忽略。
    private String errorType;
    // errorCode 提供前端可稳定识别的异常编码，成功响应保持 null。
    private String errorCode;
    // requestId 关联前端错误提示与本地完整异常日志，成功响应保持 null。
    private String requestId;
    // stackTrace 仅在 dev/test 异常响应中承接完整 Java 堆栈，prod 与成功响应保持 null。
    private String stackTrace;

    /**
     * 返回当前请求是否成功。
     *
     * @return 是否成功，例如新增完成时返回 {@code true}
     */
    public boolean isSuccess() {
        // 直接返回统一成功标记，保证所有非分页接口都按同一字段名对外表达执行结果。
        return success;
    }

    /**
     * 设置当前请求是否成功。
     *
     * @param success 来自业务执行结果的成功标记，例如 {@code true}
     * 执行结果示例：序列化后顶层字段为 {@code "success":true}。
     */
    public void setSuccess(boolean success) {
        // 把调用方传入的执行结果写入共通返回对象，避免业务模块继续散落自定义状态字段。
        this.success = success;
    }

    /**
     * 返回模块编码。
     *
     * @return 模块编码，例如 {@code "uniauth"}
     */
    public String getModuleCode() {
        // 返回当前结果绑定的模块编码，便于前端或联调时区分来源模块。
        return moduleCode;
    }

    /**
     * 设置模块编码。
     *
     * @param moduleCode 来自 Controller 的模块编码，例如 {@code "uniauth"}
     * 执行结果示例：序列化后顶层字段为 {@code "moduleCode":"uniauth"}。
     */
    public void setModuleCode(String moduleCode) {
        // 写入当前模块编码，统一沉淀到共通返回对象而不是由每个接口单独约定字段名。
        this.moduleCode = moduleCode;
    }

    /**
     * 返回请求路径。
     *
     * @return 请求路径，例如 {@code "/users/getById"}
     */
    public String getRequestPath() {
        // 返回当前响应命中的接口路径，便于联调阶段核对请求入口是否正确。
        return requestPath;
    }

    /**
     * 设置请求路径。
     *
     * @param requestPath 来自当前 Controller 路由的请求路径，例如 {@code "/users/getById"}
     * 执行结果示例：序列化后顶层字段为 {@code "requestPath":"/users/getById"}。
     */
    public void setRequestPath(String requestPath) {
        // 写入当前请求路径，保证不同模块非分页接口的联调字段口径一致。
        this.requestPath = requestPath;
    }

    /**
     * 返回业务数据。
     *
     * @return 业务数据，例如 {@code {"id":1,"loginName":"admin"}}
     */
    public Object getData() {
        // 返回当前接口承载的业务数据，让前端统一按 data 字段读取单条详情或保存结果。
        return data;
    }

    /**
     * 设置业务数据。
     *
     * @param data 来自 Service 的详情、写入回显或批量结果，例如 {@code {"id":1,"loginName":"admin"}}
     * 执行结果示例：固定返回结构包含
     *     {@code "data":{"id":1,"loginName":"admin"}}。
     */
    public void setData(Object data) {
        // 写入当前接口的业务数据，避免模块继续各自散落 result、row、item 等不同返回字段命名。
        this.data = data;
    }

    /**
     * 返回数据库累计影响行数。
     *
     * @return 当前写入动作的累计影响行数，例如批量更新两条记录返回 {@code 2}；非写入结果为空
     */
    public Integer getAffectedRows() {
        // 返回 DAO 实际累计的写入行数，让批量接口无需把统计值嵌套进 data。
        return affectedRows;
    }

    /**
     * 设置数据库累计影响行数。
     *
     * @param affectedRows 来自 DAO 写入结果的累计影响行数，例如 {@code 2}
     * 执行结果示例：固定返回结构在顶层包含 {@code "affectedRows":2}，不嵌入 data。
     */
    public void setAffectedRows(Integer affectedRows) {
        // 把写入统计放在 CommonResult 固定顶层字段，避免业务模块创造专用返回结构。
        this.affectedRows = affectedRows;
    }

    /**
     * 返回结果说明。
     *
     * @return 结果说明，例如 {@code "查询完成。"}
     */
    public String getMsg() {
        // 返回当前接口说明文案，供前端直接展示保存、查询或删除结果。
        return msg;
    }

    /**
     * 设置结果说明。
     *
     * @param msg 来自 Service 业务动作的结果说明，例如 {@code "查询完成。"}
     * 执行结果示例：固定返回结构在顶层包含 {@code "msg":"查询完成。"}。
     */
    public void setMsg(String msg) {
        // 写入统一结果说明文案字段，保证不同非分页接口对提示信息的出口保持一致。
        this.msg = msg;
    }

    /**
     * 返回错误类型。
     *
     * @return 业务异常返回 {@code BUSINESS}，系统异常返回 {@code SYSTEM}，成功结果返回 {@code null}
     */
    public String getErrorType() {
        // 返回前端错误框的分类依据，成功结果不输出该字段。
        return errorType;
    }

    /**
     * 设置错误类型。
     *
     * @param errorType 异常分类，例如 {@code BUSINESS} 或 {@code SYSTEM}
     */
    public void setErrorType(String errorType) {
        // 写入异常分类，使前端在 success=false 时区分业务提示和系统提示。
        this.errorType = errorType;
    }

    /**
     * 返回错误编码。
     *
     * @return 业务异常返回 {@code USER_NOT_FOUND}，系统异常返回 {@code INTERNAL_ERROR}，成功结果返回 {@code null}
     */
    public String getErrorCode() {
        // 返回稳定错误编码，前端可在不依赖中文文案的情况下执行专用提示处理。
        return errorCode;
    }

    /**
     * 设置错误编码。
     *
     * @param errorCode 异常编码，例如 {@code USER_NOT_FOUND} 或 {@code INTERNAL_ERROR}
     */
    public void setErrorCode(String errorCode) {
        // 写入当前错误编码，成功结果不会调用该方法。
        this.errorCode = errorCode;
    }

    /**
     * 返回请求关联标识。
     *
     * @return 异常请求返回 UUID，例如 {@code 8f3c2a1b-1234-4567-8901-abcdef012345}；成功结果返回 {@code null}
     */
    public String getRequestId() {
        // 返回与 HTTP 响应头和本地日志一致的 requestId，供前端问题反馈定位。
        return requestId;
    }

    /**
     * 设置请求关联标识。
     *
     * @param requestId 当前 HTTP 请求的关联标识，例如 {@code gateway-20260729-001}
     */
    public void setRequestId(String requestId) {
        // 保存请求关联标识，使错误 JSON 与后端完整堆栈可以一对一关联。
        this.requestId = requestId;
    }

    /**
     * 返回开发或测试环境的完整异常堆栈。
     *
     * @return dev/test 异常返回完整 Java 堆栈文本，prod 与成功结果返回 {@code null}
     */
    public String getStackTrace() {
        // 返回仅在诊断环境允许公开的堆栈文本，生产响应不会输出该字段。
        return stackTrace;
    }

    /**
     * 设置开发或测试环境的完整异常堆栈。
     *
     * @param stackTrace 完整 Java 堆栈文本，例如以 {@code java.lang.IllegalArgumentException} 开头的多行内容
     */
    public void setStackTrace(String stackTrace) {
        // 保存诊断堆栈，调用方只在明确开启异常详情时写入该字段。
        this.stackTrace = stackTrace;
    }
}
