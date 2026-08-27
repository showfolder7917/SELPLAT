# 分包 11：进度页面与 SSE 详细设计

> 2026-08-21 实施修订：当前页面先采用流程快照轮询，SSE 属于后续增强；进度不再读取 `AiStageExecution`。

## 0. 当前页面实现

- 顶部提供当前项目选择和统一主题入口；默认普通白底黑字极简主题。
- 导航为项目管理、规则登记、AI 门禁、流程设计、执行进度、角色管理。
- 项目管理提供增删改查；规则与门禁按当前项目过滤。
- 流程设计从左侧拖入需求分析师、软件工程师、测试工程师，节点可移动并可连线。
- 执行进度按画布角色节点逐行显示，数据来源是最新 `AiWorkflowRun/AiWorkflowNodeRun`；没有运行记录时显示 `NOT_STARTED`。
- 本地完整审计日志由 Python 写入 `OPTION/temp/ai-factory/任务/<task_id>/审计日志/`，Java 页面只展示上报的逻辑路径和摘要。

## 1. 计划文件

- Java：`progress/service/AiProgressService.java`、`progress/controller/AiProgressController.java`
- 页面：`static/aifactory/aifactory.html`、`aifactory.js`、`aifactory.css`、`i18n/`

## 2. 方法合同

| DES ID | 方法 | 作用与真实传参 | 真实返回 | 异常或副作用 |
| --- | --- | --- | --- | --- |
| DES-OBS-001 | `AiProgressService#append(CommonParam)` | runId=RUN-1、sequence=18、eventType=stage.heartbeat。 | 返回 acceptedSequence=18。 | 重复序号幂等；同序号不同摘要冲突。 |
| DES-OBS-002 | `AiProgressService#getSnapshot(CommonParam)` | taskId=TASK-10001。 | 返回 task、stages、runs、artifacts、tests、gates、errors、approvals、budget。 | 只读且按权限过滤。 |
| DES-OBS-003 | `AiProgressService#getEventsAfter(CommonParam)` | taskId、afterSequence=18、limit=200。 | 返回 19..N 有序事件。 | limit 上限 1000；无事件返回空。 |
| DES-OBS-004 | `AiProgressService#markStale(CommonParam)` | Python 看门狗提交 now、runId 和租约事实。 | 服务端复核后返回 stale run 列表。 | Java不主动扫描或重试。 |
| DES-OBS-005 | `AiProgressController#events(...)` | SSE Last-Event-ID=18。 | `id:19\nevent:stage.heartbeat\ndata:{...}`。 | 客户断开释放 emitter，不改任务。 |
| DES-OBS-006 | JS `loadTask(taskId)` | GET snapshot。 | 渲染阶段、角色、Thread、当前动作。 | 失败显示 requestId，不清空旧快照。 |
| DES-OBS-007 | JS `connectEvents(taskId,lastId)` | 建立 EventSource。 | 按 sequence 更新局部状态。 | 断线指数重连并先刷新快照。 |
| DES-OBS-008 | JS `renderPipeline(snapshot)` | 输入完整任务快照。 | 生成阶段卡、Gate、错误与阻断视图。 | 不基于 percent 推断完成。 |
| DES-OBS-009 | JS `renderArtifactGate(artifact)` | 输入 ART-1/version/gates。 | 显示逐文件 PASS/FAIL/INVALIDATED。 | 缺 Gate 显示“未验收”，不显示绿色。 |
| DES-OBS-010 | JS `renderApproval(target)` | 读取目标类型、ID、版本、摘要和审批状态。 | 只读显示 approvalId/PENDING/APPROVED。 | 页面不得提交审批或推进工作流。 |
| DES-OBS-011 | JS `renderAgentBinding(stage)` | 输入 role/agent/version/endpointType/state。 | 显示角色绑定、Agent 地址类型、Python启动状态和心跳。 | 隐藏授权和敏感地址参数；页面无启动按钮。 |

## 3. 页面区域

左侧任务列表；顶部根任务状态与预算；中部阶段时间线；右侧角色/Agent 登记、Python启动状态、心跳和阻断；下部产物/Gate、错误、审计和审批标签页。页面完全只读，使用 SelUI 公共组件且不复制公共控件实现。

## 4. 告警

STALE、审计失败、outbox 积压、摘要冲突、修复超限、敏感违规、备份校验失败必须在页面与审计中同时可见。
