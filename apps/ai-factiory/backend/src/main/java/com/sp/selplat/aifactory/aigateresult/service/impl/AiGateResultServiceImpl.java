package com.sp.selplat.aifactory.aigateresult.service.impl;

import com.sp.selplat.aifactory.aitask.service.AiTaskService;
import com.sp.selplat.aifactory.common.util.AiFactoryResults;
import com.sp.selplat.aifactory.aigateresult.service.AiGateResultService;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import org.springframework.stereotype.Service;

/** 登记本地 Gate 事实，明确不含 Runner。 */
@Service
public class AiGateResultServiceImpl implements AiGateResultService {
    private final AiTaskService taskService;

    /**
     * 注入控制面 DAO。
     * 真实传参示例：Spring 注入 AiTaskServiceImpl。
     * 真实返回示例：Service 可以登记 Gate 证据。
     * 异常或副作用示例：DAO 缺失时启动失败；不执行门禁。
     * @param dao 控制面 DAO
     */
    public AiGateResultServiceImpl(AiTaskService taskService) { this.taskService = taskService; }

    /** {@inheritDoc} */
    @Override
    public CommonResult submitEvidence(CommonParam command) {
        for (String key : new String[]{"taskId", "gateId", "definitionVersion", "runnerDigest", "artifactDigest", "result", "evidenceDigest"}) {
            Object value = command == null ? null : command.getParam(key);
            if (value == null || String.valueOf(value).isBlank()) throw new IllegalArgumentException(key + " 不能为空");
        }
        return AiFactoryResults.success(taskService.registerGateEvidence(command), "本地 Gate 证据已登记。");
    }
}
