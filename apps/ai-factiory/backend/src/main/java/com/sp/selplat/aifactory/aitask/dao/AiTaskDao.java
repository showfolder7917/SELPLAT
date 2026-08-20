package com.sp.selplat.aifactory.aitask.dao;

import com.sp.selplat.common.db.dao.BaseDao;
import com.sp.selplat.common.util.CommonParam;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/** 声明 AI 工厂跨表控制面持久化能力，Controller 不得拼接 SQL。 */
public interface AiTaskDao extends BaseDao {

    /**
     * 创建任务和第一个阶段。
     * 真实传参示例：{@code {title:"用户导入",project:"SELPLAT",owner:"XUNAN"}}。
     * 真实返回示例：{@code {taskId:"TASK-...",rootThreadId:"...",stateVersion:1}}。
     * 异常或副作用示例：写入任务、阶段与首个进度事件，事务失败整体回滚。
     *
     * @param command 任务创建参数
     * @param taskId AiTaskId 号段生成的任务主键，例如 {@code 100000}
     * @param stageId AiTaskStageId 号段生成的首阶段主键，例如 {@code 100000}
     * @param progressSequence AiProgressEventSequence 号段生成的首事件游标，例如 {@code 100000}
     * @return 新任务摘要
     */
    Map<String, Object> createTask(CommonParam command, long taskId, long stageId, long progressSequence);

    /**
     * 查询任务快照。
     * 真实传参示例：{@code TASK-10001}。
     * 真实返回示例：返回 task、stages、gates、artifacts 和 events。
     * 异常或副作用示例：不存在时返回空 Map；只读数据库。
     *
     * @param taskCode 任务稳定编码
     * @return 任务聚合快照或空 Map
     */
    Map<String, Object> findTaskSnapshot(String taskCode);

    /**
     * 返回游标后的就绪阶段事件。
     * 真实传参示例：{@code cursor=18,limit=100}。
     * 真实返回示例：{@code [{sequence:19,eventType:"stage.ready",taskId:"TASK-1"}]}。
     * 异常或副作用示例：只读数据库，结果按序号升序。
     *
     * @param cursor 上次确认的事件序号
     * @param limit 最大返回条数
     * @return 就绪事件列表
     */
    List<Map<String, Object>> findReadyEvents(long cursor, int limit);

    /**
     * 查询阶段冻结角色。
     * 真实传参示例：{@code STAGE-TASK-10001-1}。
     * 真实返回示例：{@code {roleId:"IMPLEMENTATION_ROLE",version:"1.0.0"}}。
     * 异常或副作用示例：未找到批准角色时返回空 Map；只读数据库。
     *
     * @param stageCode 阶段稳定编码
     * @return 角色快照或空 Map
     */
    Map<String, Object> findApprovedRole(String stageCode);

    /**
     * 解析角色的活动 Agent。
     * 真实传参示例：{@code IMPLEMENTATION_ROLE@1.0.0}。
     * 真实返回示例：{@code {agentId:"IMPLEMENTATION_AGENT",endpoint:"codex://agents/implementation"}}。
     * 异常或副作用示例：无唯一活动绑定时返回空 Map；不连接该地址。
     *
     * @param roleId 角色稳定编码
     * @param version 角色版本
     * @return Agent 登记快照或空 Map
     */
    Map<String, Object> resolveAgent(String roleId, String version);

    /**
     * 原子领取阶段。
     * 真实传参示例：{@code stageCode="STAGE-1",clientId="CLIENT-MAC-1"}。
     * 真实返回示例：{@code {runId:"RUN-1",leaseToken:"...",stateVersion:2}}。
     * 异常或副作用示例：阶段非 READY 时返回空 Map；成功后写运行与进度事件。
     *
     * @param stageCode 阶段编码
     * @param clientId 本地 Python 客户端编码
     * @param leaseToken 返回给本次领取的随机令牌
     * @param leaseDigest 只在服务端保存的令牌摘要
     * @param expiresAt 租约到期时间
     * @param runId AiStageRunId 号段生成的运行主键，例如 {@code 100000}
     * @param progressSequence AiProgressEventSequence 号段生成的领取事件游标，例如 {@code 100001}
     * @return 领取结果或空 Map
     */
    Map<String, Object> claimStage(String stageCode, String clientId, String leaseToken,
                                  String leaseDigest, Instant expiresAt, long runId, long progressSequence);

    /**
     * 登记 Python 观察到的 Agent 状态。
     * 真实传参示例：{@code RUN-1,IMPLEMENTATION_AGENT,1,STARTED}。
     * 真实返回示例：影响一行并返回 {@code 1}。
     * 异常或副作用示例：重复序号由唯一约束拒绝；只登记事实，不启动 Agent。
     *
     * @param runCode 运行编码
     * @param agentId Agent 编码
     * @param sequence 本运行内严格递增序号
     * @param state STARTED、HEARTBEAT 或 STOPPED
     * @param digest 上报事实摘要
     * @param eventId AiAgentStateEventId 号段生成的状态事件主键，例如 {@code 100000}
     * @return 影响行数
     */
    int appendAgentState(String runCode, String agentId, long sequence, String state,
                         String digest, long eventId);

    /**
     * 请求把运行转入等待文件门禁。
     * 真实传参示例：{@code RUN-1,exitCode=0,artifactDigests=["abc"]}。
     * 真实返回示例：{@code {status:"WAITING_FILE_GATE"}}。
     * 异常或副作用示例：退出码非零时状态为 FAILED；不会直接把阶段标为完成。
     *
     * @param runCode 运行编码
     * @param exitCode 本地 Agent 进程退出码
     * @param artifactDigests 本地已登记产物摘要
     * @param progressSequence AiProgressEventSequence 号段生成的完成事件游标，例如 {@code 100002}
     * @return 新状态摘要或空 Map
     */
    Map<String, Object> completeRun(String runCode, int exitCode, List<String> artifactDigests,
                                    long progressSequence);

    /**
     * 登记本地产物摘要。
     * 真实传参示例：taskId=TASK-1、logicalPath=当前任务/详细设计/A_V001.md。
     * 真实返回示例：{@code {artifactId:"ART-...",version:1,gateStatus:"PENDING"}}。
     * 异常或副作用示例：绝对路径由 Service 拒绝；成功后写 artifact 与进度事件。
     *
     * @param command 产物登记参数
     * @param artifactId AiArtifactId 号段生成的产物主键，例如 {@code 100000}
     * @param progressSequence AiProgressEventSequence 号段生成的登记事件游标，例如 {@code 100003}
     * @return 产物登记结果
     */
    Map<String, Object> registerArtifact(CommonParam command, long artifactId, long progressSequence);

    /**
     * 登记本地 Gate 证据。
     * 真实传参示例：gateId=GATE_TASK_ROOT、result=PASS、evidenceDigest=abc。
     * 真实返回示例：{@code {gateResultId:"GR-...",aggregateStatus:"PASS"}}。
     * 异常或副作用示例：只保存结果和摘要，不在 Java 执行 Gate。
     *
     * @param command Gate 证据参数
     * @param gateResultId AiGateResultId 号段生成的门禁结果主键，例如 {@code 100000}
     * @param progressSequence AiProgressEventSequence 号段生成的门禁事件游标，例如 {@code 100004}
     * @return Gate 结果登记摘要
     */
    Map<String, Object> registerGateEvidence(CommonParam command, long gateResultId, long progressSequence);
}
