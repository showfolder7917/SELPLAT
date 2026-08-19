package com.sp.selplat.aifactory.gate.service;

import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;

/** 定义由 Python 产生的 Gate 证据登记合同。 */
public interface AiGateService {
    /**
     * 校验并登记本地 Gate 证据摘要。
     * 真实传参示例：{@code {gateId:"GATE_TASK_ROOT",result:"PASS",evidenceDigest:"abc"}}。
     * 真实返回示例：返回 gateResultId 和 aggregateStatus。
     * 异常或副作用示例：缺摘要时拒绝；Java 不运行 Gate。
     * @param command Gate 证据
     * @return Gate 登记结果
     */
    CommonResult submitEvidence(CommonParam command);
}

