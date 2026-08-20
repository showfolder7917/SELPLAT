package com.sp.selplat.aifactory.capability.management.service;

import com.sp.selplat.common.util.CommonResult;

/** 定义管理页跨表只读聚合能力。 */
public interface AiManagementService {

    /**
     * 返回五张管理表的页面快照。
     * 真实传参示例：本方法无参数，由 {@code GET /management/dashboard} 调用。
     * 真实返回示例：data 含 roles、gates、rules、projects、stages。
     * 异常或副作用示例：任一表查询失败时沿用统一异常；不写数据库。
     * @return 管理页聚合结果
     */
    CommonResult getDashboard();
}
