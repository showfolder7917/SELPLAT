package com.sp.selplat.aifactory.audit.service;

/** 定义服务端 API 尝试事实记录合同。 */
public interface AiAuditService {
    /**
     * 记录服务端观察到的一次 HTTP 尝试。
     * 真实传参示例：clientId=CLIENT-MAC-1、method=POST、path=/tasks、status=201。
     * 真实返回示例：方法无返回，数据库新增一条不含正文的审计事件。
     * 异常或副作用示例：审计失败沿调用链抛出；不读取 Authorization 值。
     * @param clientId 客户端标识
     * @param method HTTP 方法
     * @param path 请求路径
     * @param status HTTP 状态码
     * @param requestId 请求关联标识
     */
    void recordHttpAttempt(String clientId, String method, String path, int status, String requestId);
}

