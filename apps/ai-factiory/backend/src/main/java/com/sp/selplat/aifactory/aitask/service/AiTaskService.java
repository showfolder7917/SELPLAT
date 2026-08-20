package com.sp.selplat.aifactory.aitask.service;

import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/** 定义任务创建与快照查询合同。 */
public interface AiTaskService {
    /**
     * 创建由本地 Python 驱动的新任务。
     * 真实传参示例：{@code {title:"用户导入",project:"SELPLAT",clientId:"CLIENT-MAC-1"}}。
     * 真实返回示例：{@code {success:true,data:{taskId:"TASK-1",stateVersion:1}}}。
     * 异常或副作用示例：缺标题或工程时拒绝；成功时写任务、首阶段和进度事件。
     * @param command 任务创建参数
     * @return 统一任务创建结果
     */
    CommonResult createTask(CommonParam command);

    /**
     * 查询一个任务的权威控制面快照。
     * 真实传参示例：{@code {taskId:"TASK-1"}}。
     * 真实返回示例：返回 task、stages、runs、artifacts、gates 和 events。
     * 异常或副作用示例：不存在时返回空数据；只读数据库。
     * @param query 任务编码参数
     * @return 统一任务快照结果
     */
    CommonResult getTask(CommonParam query);

    /**
     * 查询 Python 尚未消费的阶段就绪事件。
     * 真实传参示例：{@code cursor=3,limit=100}。
     * 真实返回示例：{@code [{sequence:4,eventType:"stage.ready"}]}。
     * 异常或副作用示例：只读数据库；limit 会被 DAO 限制到安全范围。
     * @param cursor 已消费游标
     * @param limit 最大返回数
     * @return 就绪事件
     */
    List<Map<String, Object>> findReadyEvents(long cursor, int limit);

    /**
     * 读取任务及其阶段、运行、产物、门禁和事件快照。
     * 真实传参示例：{@code TASK-ABC}。
     * 真实返回示例：{@code {task:{task_code:"TASK-ABC"},stages:[]}}。
     * 异常或副作用示例：任务不存在时返回空映射；只读数据库。
     * @param taskId 任务编码
     * @return 任务快照
     */
    Map<String, Object> findTaskSnapshot(String taskId);

    /**
     * 查询阶段冻结的已批准角色版本。
     * 真实传参示例：{@code STAGE-TASK-ABC-1}。
     * 真实返回示例：{@code {roleId:"IMPLEMENTATION_ROLE",version:"1.0.0"}}。
     * 异常或副作用示例：未命中时返回空映射；只读数据库。
     * @param stageId 阶段编码
     * @return 角色版本
     */
    Map<String, Object> findApprovedRole(String stageId);

    /**
     * 按角色版本解析唯一活动 Agent 登记。
     * 真实传参示例：{@code IMPLEMENTATION_ROLE,1.0.0}。
     * 真实返回示例：{@code {agentId:"IMPLEMENTATION_AGENT",endpoint:"codex://agents/implementation"}}。
     * 异常或副作用示例：不是唯一绑定时返回空映射；不会启动 Agent。
     * @param roleId 角色编码
     * @param version 角色版本
     * @return Agent 登记
     */
    Map<String, Object> resolveAgent(String roleId, String version);

    /**
     * 追加 Python 上报的 Agent 状态事实。
     * 真实传参示例：{@code RUN-ABC,IMPLEMENTATION_AGENT,1,STARTED,sha256}。
     * 真实返回示例：成功写入返回 {@code 1}。
     * 异常或副作用示例：重复序号触发唯一约束异常；会更新运行最后序号。
     * @return 影响行数
     */
    int appendAgentState(String runId, String agentId, long sequence, String state, String digest);

    /**
     * 原子领取 READY 阶段并创建运行租约。
     * 真实传参示例：{@code STAGE-ABC,CLIENT-MAC,token,digest,2026-08-20T12:00:00Z}。
     * 真实返回示例：{@code {runId:"RUN-ABC",stateVersion:2}}。
     * 异常或副作用示例：阶段已领取时返回空映射；成功时写运行和进度事实。
     * @return 新租约
     */
    Map<String, Object> claimStage(String stageId, String clientId, String leaseToken,
                                   String leaseDigest, Instant expiresAt);

    /**
     * 登记运行退出事实并派生下一状态。
     * 真实传参示例：{@code RUN-ABC,0,["sha256"]}。
     * 真实返回示例：{@code {status:"WAITING_FILE_GATE"}}。
     * 异常或副作用示例：非零退出码转 FAILED；会更新阶段和进度事实。
     * @return 派生状态
     */
    Map<String, Object> completeRun(String runId, int exitCode, List<String> artifactDigests);

    /**
     * 登记本地 Python 已计算的产物摘要。
     * 真实传参示例：{@code {taskId:"TASK-ABC",standardName:"详细设计",sha256:"abc"}}。
     * 真实返回示例：{@code {artifactId:"ART-ABC",version:1}}。
     * 异常或副作用示例：任务不存在时数据库查询失败；不读取本地文件。
     * @param command 产物事实
     * @return 产物登记结果
     */
    Map<String, Object> registerArtifact(CommonParam command);

    /**
     * 登记本地门禁执行证据。
     * 真实传参示例：{@code {taskId:"TASK-ABC",gateId:"CODE_GATE",result:"PASS"}}。
     * 真实返回示例：{@code {gateResultId:"GR-ABC",aggregateStatus:"PASS"}}。
     * 异常或副作用示例：必填摘要缺失时拒绝；Java 不执行门禁程序。
     * @param command 门禁事实
     * @return 门禁登记结果
     */
    Map<String, Object> registerGateEvidence(CommonParam command);
}
