package com.sp.selplat.aifactory.agentregistry.service.impl;

import com.sp.selplat.aifactory.agentregistry.service.AiAgentRegistryService;
import com.sp.selplat.aifactory.common.persistence.AiFactoryControlDao;
import com.sp.selplat.aifactory.common.util.AiFactoryResults;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** 实现角色与 Agent 登记解析，不包含任何启动能力。 */
@Service
public class AiAgentRegistryServiceImpl implements AiAgentRegistryService {
    private final AiFactoryControlDao dao;

    /**
     * 注入控制面 DAO。
     * 真实传参示例：Spring 注入 AiFactoryControlDaoImpl。
     * 真实返回示例：构造后的 Service 可解析登记。
     * 异常或副作用示例：缺少 DAO 时启动失败；无运行副作用。
     * @param dao 控制面 DAO
     */
    public AiAgentRegistryServiceImpl(AiFactoryControlDao dao) { this.dao = dao; }

    /** {@inheritDoc} */
    @Override
    public CommonResult getStageRole(CommonParam query) {
        Map<String, Object> role = new LinkedHashMap<>(dao.findApprovedRole(required(query, "stageId")));
        role.put("permissions", jsonArray(role.remove("permissionsJson")));
        return AiFactoryResults.success(role, "阶段角色查询完成。");
    }

    /** {@inheritDoc} */
    @Override
    public CommonResult resolve(CommonParam query) {
        Map<String, Object> agent = new LinkedHashMap<>(dao.resolveAgent(required(query, "roleId"), required(query, "roleVersion")));
        agent.put("capabilities", jsonArray(agent.remove("capabilitiesJson")));
        agent.put("shortLivedGrant", "grant-" + System.currentTimeMillis());
        return AiFactoryResults.success(agent, "Agent 登记解析完成；服务端未启动 Agent。");
    }

    /** {@inheritDoc} */
    @Override
    public CommonResult reportState(CommonParam command) {
        long sequence = Long.parseLong(required(command, "sequence"));
        String digest = sha256(required(command, "runId") + "|" + required(command, "agentId") + "|" + sequence + "|" + required(command, "state"));
        dao.appendAgentState(required(command, "runId"), required(command, "agentId"), sequence, required(command, "state"), digest);
        return AiFactoryResults.success(Map.of("acceptedSequence", sequence), "Agent 状态事实已登记。");
    }

    private String required(CommonParam query, String key) {
        Object value = query == null ? null : query.getParam(key);
        if (value == null || String.valueOf(value).isBlank()) throw new IllegalArgumentException(key + " 不能为空");
        return String.valueOf(value);
    }

    private List<String> jsonArray(Object value) {
        if (value == null) return List.of();
        String text = String.valueOf(value).trim();
        if (text.length() < 2) return List.of();
        String body = text.substring(1, text.length() - 1).trim();
        return body.isEmpty() ? List.of() : Arrays.stream(body.split(",")).map(item -> item.trim().replace("\"", "")).toList();
    }

    private String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("运行环境缺少 SHA-256", exception);
        }
    }
}

