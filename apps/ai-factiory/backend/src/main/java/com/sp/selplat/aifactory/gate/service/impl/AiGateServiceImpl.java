package com.sp.selplat.aifactory.gate.service.impl;

import com.sp.selplat.aifactory.common.persistence.AiFactoryControlDao;
import com.sp.selplat.aifactory.common.util.AiFactoryResults;
import com.sp.selplat.aifactory.gate.service.AiGateService;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import org.springframework.stereotype.Service;

/** 登记本地 Gate 事实，明确不含 Runner。 */
@Service
public class AiGateServiceImpl implements AiGateService {
    private final AiFactoryControlDao dao;

    /**
     * 注入控制面 DAO。
     * 真实传参示例：Spring 注入 AiFactoryControlDaoImpl。
     * 真实返回示例：Service 可以登记 Gate 证据。
     * 异常或副作用示例：DAO 缺失时启动失败；不执行门禁。
     * @param dao 控制面 DAO
     */
    public AiGateServiceImpl(AiFactoryControlDao dao) { this.dao = dao; }

    /** {@inheritDoc} */
    @Override
    public CommonResult submitEvidence(CommonParam command) {
        for (String key : new String[]{"taskId", "gateId", "definitionVersion", "runnerDigest", "artifactDigest", "result", "evidenceDigest"}) {
            Object value = command == null ? null : command.getParam(key);
            if (value == null || String.valueOf(value).isBlank()) throw new IllegalArgumentException(key + " 不能为空");
        }
        return AiFactoryResults.success(dao.registerGateEvidence(command), "本地 Gate 证据已登记。");
    }
}

