package com.sp.selplat.aifactory.aitask.service.impl;

import com.sp.selplat.aifactory.aitask.dao.AiTaskDao;
import com.sp.selplat.aifactory.common.util.AiFactoryResults;
import com.sp.selplat.aifactory.aitask.service.AiTaskService;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** 实现任务控制面业务校验，执行动作仍由 memory 发起。 */
@Service
public class AiTaskServiceImpl implements AiTaskService {
    private final AiTaskDao dao;

    /**
     * 注入控制面 DAO。
     * 真实传参示例：Spring 注入 AiTaskDaoImpl。
     * 真实返回示例：构造后的 Service 可处理任务 API。
     * 异常或副作用示例：DAO 缺失时应用启动失败；不访问数据库。
     * @param dao AI 工厂控制面 DAO
     */
    public AiTaskServiceImpl(AiTaskDao dao) { this.dao = dao; }

    /** {@inheritDoc} */
    @Override
    public CommonResult createTask(CommonParam command) {
        return AiFactoryResults.success(dao.createTask(command), "任务已创建，等待本地 Python 驱动。");
    }

    /** {@inheritDoc} */
    @Override
    public CommonResult getTask(CommonParam query) {
        return AiFactoryResults.success(dao.findTaskSnapshot(required(query, "taskId")), "任务快照查询完成。");
    }

    /** {@inheritDoc} */
    @Override
    public List<Map<String, Object>> findReadyEvents(long cursor, int limit) {
        return dao.findReadyEvents(cursor, limit);
    }

    /** {@inheritDoc} */
    @Override
    public Map<String, Object> findTaskSnapshot(String taskId) {
        return dao.findTaskSnapshot(taskId);
    }

    /** {@inheritDoc} */
    @Override
    public Map<String, Object> findApprovedRole(String stageId) {
        return dao.findApprovedRole(stageId);
    }

    /** {@inheritDoc} */
    @Override
    public Map<String, Object> resolveAgent(String roleId, String version) {
        return dao.resolveAgent(roleId, version);
    }

    /** {@inheritDoc} */
    @Override
    public int appendAgentState(String runId, String agentId, long sequence, String state, String digest) {
        return dao.appendAgentState(runId, agentId, sequence, state, digest);
    }

    /** {@inheritDoc} */
    @Override
    public Map<String, Object> claimStage(String stageId, String clientId, String leaseToken,
                                          String leaseDigest, Instant expiresAt) {
        return dao.claimStage(stageId, clientId, leaseToken, leaseDigest, expiresAt);
    }

    /** {@inheritDoc} */
    @Override
    public Map<String, Object> completeRun(String runId, int exitCode, List<String> artifactDigests) {
        return dao.completeRun(runId, exitCode, artifactDigests);
    }

    /** {@inheritDoc} */
    @Override
    public Map<String, Object> registerArtifact(CommonParam command) {
        return dao.registerArtifact(command);
    }

    /** {@inheritDoc} */
    @Override
    public Map<String, Object> registerGateEvidence(CommonParam command) {
        return dao.registerGateEvidence(command);
    }

    private String required(CommonParam query, String key) {
        Object value = query == null ? null : query.getParam(key);
        if (value == null || String.valueOf(value).isBlank()) throw new IllegalArgumentException(key + " 不能为空");
        return String.valueOf(value);
    }
}
