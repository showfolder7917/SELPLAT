package com.sp.selplat.aifactory.aitask.service.impl;

import com.sp.selplat.aifactory.aitask.dao.AiTaskDao;
import com.sp.selplat.aifactory.common.util.AiFactoryResults;
import com.sp.selplat.aifactory.aitask.service.AiTaskService;
import com.sp.selplat.common.service.sequence.SequenceGenerator;
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
    private final SequenceGenerator sequenceGenerator;

    /**
     * 注入控制面 DAO。
     * 真实传参示例：Spring 注入 AiTaskDaoImpl 与平台公共 SequenceGenerator。
     * 真实返回示例：构造后的 Service 可处理任务 API。
     * 异常或副作用示例：DAO 缺失时应用启动失败；不访问数据库。
     * @param dao AI 工厂控制面 DAO
     * @param sequenceGenerator 平台聚合公共发号器；单模块运行时使用同实现后备 Bean
     */
    public AiTaskServiceImpl(AiTaskDao dao, SequenceGenerator sequenceGenerator) {
        this.dao = dao;
        this.sequenceGenerator = sequenceGenerator;
    }

    /** {@inheritDoc} */
    @Override
    public CommonResult createTask(CommonParam command) {
        // 创建任务一次写入任务、首阶段和首进度事件 → 三张表分别领取独立主键。
        return AiFactoryResults.success(dao.createTask(
                command,
                nextId("AiTaskId"),
                nextId("AiTaskStageId"),
                nextId("AiProgressEventSequence")), "任务已创建，等待本地 Python 驱动。");
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
        // Agent 状态事实属于独立追加表 → 使用该表自己的主键号段。
        return dao.appendAgentState(
                runId, agentId, sequence, state, digest, nextId("AiAgentStateEventId"));
    }

    /** {@inheritDoc} */
    @Override
    public Map<String, Object> claimStage(String stageId, String clientId, String leaseToken,
                                          String leaseDigest, Instant expiresAt) {
        // 领取阶段写入运行记录和进度事件 → 分别领取运行主键与事件游标。
        return dao.claimStage(stageId, clientId, leaseToken, leaseDigest, expiresAt,
                nextId("AiStageRunId"), nextId("AiProgressEventSequence"));
    }

    /** {@inheritDoc} */
    @Override
    public Map<String, Object> completeRun(String runId, int exitCode, List<String> artifactDigests) {
        return dao.completeRun(
                runId, exitCode, artifactDigests, nextId("AiProgressEventSequence"));
    }

    /** {@inheritDoc} */
    @Override
    public Map<String, Object> registerArtifact(CommonParam command) {
        // 产物登记同时追加进度事件 → 两张表分别使用自身号段。
        return dao.registerArtifact(
                command, nextId("AiArtifactId"), nextId("AiProgressEventSequence"));
    }

    /** {@inheritDoc} */
    @Override
    public Map<String, Object> registerGateEvidence(CommonParam command) {
        // 门禁结果登记同时追加进度事件 → 两张表分别使用自身号段。
        return dao.registerGateEvidence(
                command, nextId("AiGateResultId"), nextId("AiProgressEventSequence"));
    }

    /**
     * 从公共发号器领取 AI 工厂某张表的下一个主键。
     * 真实传参示例：{@code "AiTaskId"}。
     * 真实返回示例：{@code 100000L}，且游标只在 AI 工厂私有库推进。
     * 异常或副作用示例：号段缺失或重复登记时抛出非法状态异常；领取后允许产生未使用号码空洞。
     *
     * @param sequenceCode 数据库登记的独立号段编码
     * @return 下一个可用主键
     */
    private Long nextId(String sequenceCode) {
        return sequenceGenerator.nextId(sequenceCode);
    }

    private String required(CommonParam query, String key) {
        Object value = query == null ? null : query.getParam(key);
        if (value == null || String.valueOf(value).isBlank()) throw new IllegalArgumentException(key + " 不能为空");
        return String.valueOf(value);
    }
}
