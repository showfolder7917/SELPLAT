# 分包 07：ai-factory 工作流与审批详细设计

> 2026-08-21 实施修订：本节以下“任务/阶段状态机”保留为远期模型；当前快速开发控制面以本修订为准，不再使用 `AiStageExecution`。

## 0. 当前快速流程

- 默认流程固定为 `需求分析师 → 软件工程师 → 测试工程师`，只展示这三类可拖拽角色。
- 画布允许重复加入同一角色；同类节点数量表示该角色可同时工作的实例数。
- 流程定义使用 `AiWorkflowDefinition / Version / Node / Edge`，运行事实使用 `AiWorkflowRun / NodeRun`。
- 门禁类型只有引用数据 `AI_GATE`；职责只保留需求检测员、代码检测员、项目经理总控。
- “代码检测员”是 AI 门禁职责名称；代码质量执行仍属于测试范围，不建立 `CODE_GATE` 类型。
- Java 只保存流程、节点位置、连线和 Python 上报事实；不得主动启动 Agent 或推进节点。
- 当前接口为 `GET /api/v1/ai-factory/workflows/snapshot`、`POST /nodes/create.htm`、`POST /nodes/move.htm`、`POST /edges/create.htm`。

## 1. 计划文件

- `.../task/service/AiTaskService.java`、`impl/AiTaskServiceImpl.java`
- `.../stagerun/service/AiStageRunService.java`、`impl/AiStageRunServiceImpl.java`
- `.../workflow/AiWorkflowStateMachine.java`
- `.../approval/service/AiApprovalService.java`、`impl/AiApprovalServiceImpl.java`
- `.../agentregistry/service/AiAgentRegistryService.java`、`impl/AiAgentRegistryServiceImpl.java`
- `.../common/persistence/AiFactoryControlDao.java`

## 2. Service 方法合同

| DES ID | 文件 / 方法 | 方法作用与真实传参 | 真实返回 | 异常或副作用 |
| --- | --- | --- | --- | --- |
| DES-WFL-001 | `AiTaskService#create(CommonParam)` | 创建任务；示例 title=用户导入、project=SELPLAT。 | `CommonResult data={taskId:TASK-10001,rootThreadId:10001,stateVersion:1}`。 | 同事务写 task、需求 stage、attempted/audit；任一失败回滚。 |
| DES-WFL-002 | `AiTaskService#getSnapshot(CommonParam)` | 输入 taskId。 | 返回 task、stages、currentRun、artifacts、gates、approvals。 | 无权访问抛业务异常，不更新读取时间以外业务状态。 |
| DES-WFL-003 | `AiStageRunService#claim(CommonParam)` | 输入 stageId/clientId/expectedStateVersion。 | 返回 runId、leaseToken、expiresAt。 | 原子条件更新失败返回已领取或版本冲突。 |
| DES-WFL-004 | `AiStageRunService#heartbeat(CommonParam)` | 输入 runId、token、sequence、progress。 | 返回 acceptedSequence 和续租时间。 | 序号重复幂等；倒退序号忽略并返回原结果。 |
| DES-WFL-005 | `AiStageRunService#submitCompletion(CommonParam)` | 输入 exitCode、factsDigest、artifactIds。 | 状态转 `FILE_GATING` 或 `FAILED`。 | 仅 exitCode=0 不足以完成阶段；副作用写进度事件。 |
| DES-WFL-006 | `AiWorkflowStateMachine#transition(taskId,event,expectedVersion)` | Python API 请求携带 `FILE_GATES_PASSED`，服务端从 FILE_GATING 校验到 STAGE_GATING。 | `TransitionResult(from='FILE_GATING',to='STAGE_GATING',version=8)`。 | 非法跳转抛 `INVALID_STATE_TRANSITION`；Java不主动发起事件。 |
| DES-WFL-007 | `AiWorkflowStateMachine#invalidate(taskId,artifactId,reason)` | 产物摘要变更。 | 返回失效的 test/gate/package 对象 ID。 | 副作用是里程碑回退，不删除历史结果。 |
| DES-WFL-008 | `AiWorkflowStateMachine#block(taskId,code,evidence)` | 修复超限或歧义。 | 状态 `WAITING_FOR_HUMAN`。 | 写阻断原因和审批请求，停止新租约。 |
| DES-WFL-009 | `AiApprovalService#request(CommonParam)` | 输入 approvalType、targetId、targetDigest、requiredRole。 | 返回 approvalId 和 `PENDING`。 | 同一对象同类型未决请求幂等。 |
| DES-WFL-010 | `AiApprovalService#decide(CommonParam)` | Python 转交人工决定后调用 API，输入 approvalId、decision、expectedVersion。 | 返回 `APPROVED` 或 `REJECTED` 记录。 | 页面只读；申请者与批准者冲突、权限不足或摘要过期拒绝。 |
| DES-WFL-011 | `AiWorkflowStateMachine#resume(taskId,approvalId,recoveryPoint)` | 人工批准继续。 | 返回恢复目标状态与新版本。 | 副作用不确定时仍保持 BLOCKED。 |
| DES-WFL-012 | `AiStageRunService#markStale(CommonParam)` | Python 看门狗提交 now、runIds 和租约事实，服务端重新校验数据库租约。 | 返回确认标记数量和 runIds。 | Java无主动扫描器；写 STALE 后不自动重放外部动作。 |
| DES-WFL-013 | `AiWorkflowStateMachine#classifyFailure(failure,fingerprint)` | 保存 A/B/C/D 与次数。 | 返回 route=`CODE_FIX` 或 `PROCESS_IMPROVEMENT`。 | 第三次同指纹强制 D 类；无法分类请求人工。 |
| DES-WFL-014 | `AiWorkflowStateMachine#cancel(taskId,reason)` | 人工取消任务。 | 返回 CANCELLED 与最终版本。 | 保留产物、事件和审计，不删除工作区。 |

## 3. 状态守卫

Python 请求下一阶段时，服务端要求：前一阶段生产结果登记、全部文件 Gate PASS、阶段 Gate PASS、必要审批 APPROVED、产物摘要未变化、审计连续。Java只校验和落库，不主动创建后续执行；Quality Gate 不替代任何缺失守卫。

## 4. 事务

任务/阶段状态、approval、gate 聚合和 audit attempted 必须在 `aiFactoryTransactionManager` 管理的服务端事务内完成。跨 HTTP 与本地文件不使用分布式事务，依靠幂等和 outbox。
