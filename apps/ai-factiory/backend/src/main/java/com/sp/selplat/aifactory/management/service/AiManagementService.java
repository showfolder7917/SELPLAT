package com.sp.selplat.aifactory.management.service;

import com.sp.selplat.common.util.CommonResult;

/** 定义 AI 工厂管理页只读聚合服务。 */
public interface AiManagementService {

    /**
     * 返回角色、门禁、规则、项目和执行进度树表快照。
     * 真实传参示例：本方法无参数，由 {@code GET /management/dashboard} 调用。
     * 真实返回示例：成功结果 data 中包含 roles、gates、rules、projects、stages。
     * 异常或副作用示例：查询失败时沿用统一异常处理；不修改管理数据。
     *
     * @return 管理页聚合结果
     */
    CommonResult getDashboard();
}
