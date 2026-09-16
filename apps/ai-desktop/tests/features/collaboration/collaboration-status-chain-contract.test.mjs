import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const developerSource = [
  "../../../src/applications/developer/DeveloperApplication.tsx",
  "../../../src/features/collaboration/components/CollaborationWorkspaceFeature.tsx",
  "../../../src/features/conversation/components/CodexConversationWorkspace.tsx",
  "../../../src/features/conversation/components/CodexConversationWorkspace/CodexConversationTimeline.tsx",
  "../../../src/features/conversation/components/CollaborationStatusChain.tsx",
  "../../../src/features/conversation/components/StreamDetails.tsx",
].map((source) => readFileSync(new URL(source, import.meta.url), "utf8")).join("\n");
const coordinatorSource = readFileSync(new URL("../../../electron/services/workflow/collaboration-workflow.facade.ts", import.meta.url), "utf8");
const integrationSource = readFileSync(new URL("../../../electron/services/support/capabilities/release/internal/version-integration.pipeline.ts", import.meta.url), "utf8");
const contractSource = readFileSync(new URL("../../../contracts/services/workflow/index.ts", import.meta.url), "utf8");
const contractDefinitionSource = readFileSync(new URL("../../../contracts/services/workflow/dto/collaboration-task.out.dto.ts", import.meta.url), "utf8");
const executionContractSource = readFileSync(new URL("../../../contracts/services/workflow/dto/collaboration-execution.out.dto.ts", import.meta.url), "utf8");
const integrationContractSource = readFileSync(new URL("../../../contracts/services/workflow/dto/collaboration-integration.out.dto.ts", import.meta.url), "utf8");
const snapshotContractSource = readFileSync(new URL("../../../contracts/services/workflow/dto/collaboration-task-snapshot.out.dto.ts", import.meta.url), "utf8");
const contractValueSource = readFileSync(new URL("../../../contracts/services/workflow/value/collaboration-task.value.ts", import.meta.url), "utf8");
// 任务协作群已经按新手结构拆成主页面、页面状态、专题卡和纯显示转换；
// 静态契约必须读取完整模块，不能把单个组合入口误当成全部实现。
const taskGroupSource = [
  "../../../src/features/collaboration/components/TaskCollaborationGroup.tsx",
  "../../../src/features/collaboration/components/useTaskCollaborationGroup.ts",
  "../../../src/features/collaboration/components/TaskCollaborationGroup/TaskGroupCard.tsx",
  "../../../src/features/collaboration/components/TaskCollaborationGroup/timeline-display.ts",
].map((source) => readFileSync(new URL(source, import.meta.url), "utf8")).join("\n");
const taskGroupCardSource = readFileSync(new URL("../../../src/features/collaboration/components/TaskCollaborationGroup/TaskGroupCard.tsx", import.meta.url), "utf8");
const collaborationModelSource = readFileSync(new URL("../../../src/features/collaboration/model/useCollaborationWorkspace.ts", import.meta.url), "utf8");
const recoveryOperationSource = readFileSync(new URL("../../../src/features/collaboration/model/recovery-operation.ts", import.meta.url), "utf8");
const collaborationViewModelSource = readFileSync(new URL("../../../src/features/collaboration/model/createCollaborationWorkspaceViewModel.ts", import.meta.url), "utf8");
const evolutionRuntimeSource = readFileSync(new URL("../../../src/features/evolution/model/useEvolutionRuntime.ts", import.meta.url), "utf8");
const interactionPreloadSource = readFileSync(new URL("../../interaction/isolated-preload.cjs", import.meta.url), "utf8");
const developerStyles = readFileSync(new URL("../../../src/applications/styles/desktop-applications.css", import.meta.url), "utf8");

test("协作回复卡展示真实状态链并隐藏旧意图终态", () => {
  assert.match(developerSource, /collaborationTaskId/);
  assert.match(developerSource, /CollaborationStatusChain/);
  assert.match(developerSource, /message\.collaborationTaskId[\s\S]*messageTask[\s\S]*CollaborationStatusChain/);
  assert.doesNotMatch(developerSource, /activeConversationTask && <CollaborationStatusChain/);
  assert.match(developerSource, /!message\.collaborationTaskId[\s\S]*stream-current/);
  assert.match(developerSource, /collaboration-status-task-details[\s\S]*任务详细.*initiator\?\.displayName/s);
  assert.doesNotMatch(developerSource, /review-failed[\s\S]*重新审批/);
  assert.match(developerSource, /test-failed[\s\S]*重新测试/);
});

test("执行失败经令狐修复并固定回到原负责人", () => {
  // 业务入口只负责公开协议，具体状态由入口导出的定义文件承载。
  assert.match(contractSource, /CollaborationTaskStateValue[\s\S]*from "\.\/value\/collaboration-task\.value\.js"/);
  assert.doesNotMatch(contractValueSource, /repairing-review|queued-reviewer/);
  assert.match(contractValueSource, /repairing-execution/);
  assert.doesNotMatch(coordinatorSource, /review\.repair_completed|preferredReviewerMemberId/);
  assert.match(coordinatorSource, /execution\.repair_completed[\s\S]*preferredExecutorMemberId/);
});

test("执行成功后由令狐老祖记录统一测试结果", () => {
  assert.match(contractSource, /CollaborationTaskStateValue[\s\S]*from "\.\/value\/collaboration-task\.value\.js"/);
  assert.match(contractValueSource, /unified-testing/);
  assert.match(integrationSource, /task\.state = "unified-testing"/);
  assert.match(integrationSource, /unified_test\.passed/);
  assert.match(integrationSource, /unified_test\.failed/);
});

test("任务级恢复入口在等待和恢复中都位于下一流程", () => {
  assert.match(taskGroupSource, /continuingTaskIds = useRef\(new Set<string>\(\)\)/);
  assert.match(recoveryOperationSource, /RECOVERY_REQUEST_TIMEOUT_MS = 12_000[\s\S]*RECOVERY_RECHECK_TIMEOUT_MS = 4_000/);
  assert.match(recoveryOperationSource, /finally\(\(\) => globalThis\.clearTimeout\(timer\)\)\.catch\(\(\) => undefined\)/);
  assert.match(taskGroupSource, /disabled=\{recoveryPending\}[\s\S]*"恢复中…"[\s\S]*"从卡点继续"/);
  assert.match(taskGroupSource, /task-timeline-next-current[\s\S]*onContinueTask\(projectedResumeTaskId\)/);
  assert.doesNotMatch(taskGroupSource, /latestActiveRecoveryAction|TaskGroupRecovery|task-node-recovery-action/);
  const nextFlowBlock = taskGroupCardSource.slice(taskGroupCardSource.indexOf('<div className="task-timeline-next">'), taskGroupCardSource.indexOf('<div className="task-timeline-list">'));
  assert.doesNotMatch(nextFlowBlock, /failureNextStep/);
  assert.match(taskGroupSource, /!open && <span className="task-group-primary-next"/);
  assert.doesNotMatch(taskGroupSource, /continueCurrentTask|currentTaskGroupPresentation/);
  assert.match(taskGroupSource, /visibleTimelineNodes\(group\.nodes\)/);
  assert.match(taskGroupSource, /nextSameTask[\s\S]*nextIsSameWaitingState[\s\S]*return !nextIsSameWaitingState/);
  assert.match(developerSource, /continueTimelineTask[\s\S]*continueTaskWithRecovery\(taskId, controller\.actions\)[\s\S]*onContinueTask: continueTimelineTask[\s\S]*<TaskCollaborationGroup model=\{viewModel\.taskGroup\}/);
  assert.match(recoveryOperationSource, /dependencies\.continueTask\(taskId\)[\s\S]*dependencies\.refreshRecoveryState\(\)/);
  assert.match(collaborationModelSource, /const continueTask = async \(taskId: string\)[\s\S]*if \(!desktop\) throw new Error\("无法连接协作状态服务。"\)[\s\S]*desktop\.continueCollaborationTask\(taskId\)/);
  assert.match(developerStyles, /\.task-recovery-continue[\s\S]*background: var\(--sel-theme-workbench-accent\)[\s\S]*font-weight: 700/);
  assert.match(developerStyles, /\.task-recovery-continue:focus-visible/);
});

test("任务级恢复失败显示短原因并保留可展开证据", () => {
  assert.match(taskGroupCardSource, /function RecoveryError[\s\S]*compactTimelineText\(detail\)[\s\S]*role="alert"/);
  assert.match(taskGroupCardSource, /className="task-recovery-evidence"[\s\S]*查看完整原因与证据[\s\S]*<pre>\{detail\}<\/pre>/);
});

test("人工审批窗口读取待审批节点正文而非技术详情", () => {
  assert.match(taskGroupSource, /onManualApproval\(node\.manualApprovalProposalId, group\.title, node\.content\)/);
  assert.doesNotMatch(taskGroupSource, /onManualApproval\(node\.manualApprovalProposalId, group\.title, node\.detail \|\| node\.content\)/);
});

test("专题卡使用单一卡片模型归组显示状态和用户操作", () => {
  // 父页面先构造具名卡片模型，避免在 JSX 调用处平铺十多个无法辨别职责的参数。
  assert.match(taskGroupSource, /const cardModel: TaskGroupCardModel = \{[\s\S]*presentation: \{[\s\S]*actions: \{/);
  // 卡片组件只接收一个模型参数，后续子节点继续复用同一模型而不重复透传共享依赖。
  assert.match(taskGroupSource, /<TaskGroupCard key=\{group\.groupId\} model=\{cardModel\}/);
  assert.match(taskGroupSource, /function TaskTimelineNode\([\s\S]*model: TaskGroupCardModel/);
});

test("任务时间线公开稳定时间边界供韩立区分本轮与历史审计", () => {
  assert.match(taskGroupCardSource, /data-task-timeline-topic-id=\{group\.topicId \|\| ""\}/);
  assert.match(taskGroupCardSource, /data-task-timeline-proposal-id=\{group\.proposalId \|\| ""\}/);
  assert.match(taskGroupCardSource, /data-task-timeline-event-type=\{node\.eventType\}/);
  assert.match(taskGroupCardSource, /data-task-timeline-started-at=\{node\.startedAt\}/);
  assert.match(taskGroupCardSource, /data-task-timeline-status=\{node\.status\}/);
});

test("动态耗时只刷新局部文字，不能驱动整页时间线重绘", () => {
  assert.doesNotMatch(taskGroupSource, /const \[nowMs, setNowMs\][\s\S]*useTaskCollaborationGroup/);
  assert.match(taskGroupCardSource, /function TimelineDuration[\s\S]*window\.setInterval/);
  assert.match(taskGroupCardSource, /const TaskTimelineNode = memo/);
});

test("协作页面和控制器使用具名模型归组公开依赖", () => {
  // 任务群与人物页都只接收一个模型，工作区不再传递未使用的会话和截图控制器。
  assert.match(developerSource, /<TaskCollaborationGroup model=\{viewModel\.taskGroup\}/);
  assert.match(developerSource, /<CollaborationMemberPage model=\{viewModel\.memberPage\}/);
  assert.doesNotMatch(developerSource, /<CollaborationWorkspaceFeature[\s\S]{0,300}(?:workspaces|nangong|screenshot)=/);
  // 协作控制器按权威数据、导航、反馈、操作和稳定配置分组，调用方通过组名理解字段职责。
  assert.match(collaborationModelSource, /data: \{[\s\S]*navigation: \{[\s\S]*feedback: \{[\s\S]*actions: \{[\s\S]*configuration: \{/);
});

test("会话任务不再携带已退役的页面审查文件清单", () => {
  const storeSource = readFileSync("electron/services/workflow/internal/collaboration/collaboration.store.ts", "utf8");
  assert.doesNotMatch(collaborationModelSource, /EvolutionAcceptanceMaterialAuthorizationOutDto/);
  assert.doesNotMatch(collaborationModelSource, /materials: structuredClone\(materials\)/);
  assert.match(storeSource, /delete \(task\.snapshot as unknown as \{ materials\?: unknown \}\)\.materials/);
});

test("没有专题任务时可从空状态进入韩立会话，但不创建任务", () => {
  assert.match(taskGroupSource, /groups\.length === 0[\s\S]*onClick=\{openHanliConversation\}[\s\S]*找韩立说需求/);
  assert.match(collaborationModelSource, /const openMemberPage = async \(memberId: string\)[\s\S]*selectMember\(memberId\)[\s\S]*setPanel\("member"\)/);
  assert.match(collaborationViewModelSource, /onOpenHanliConversation: \(\) => controller\.actions\.openMemberPage\("han-li"\)/);
  assert.doesNotMatch(taskGroupSource, /submitTask|submitConversationTask/);
});

test("任务群在协作状态未返回或读取失败时不把空专题当作当前事实", () => {
  assert.match(collaborationViewModelSource, /taskGroup:[\s\S]*stateReadStatus: controller\.data\.stateReadStatus/);
  assert.match(collaborationViewModelSource, /deliveryReadStatus: evolution\.readStatus[\s\S]*timelineReadStatus: controller\.data\.timelineReadStatus[\s\S]*readRecovery: evolution\.readRecovery/);
  assert.match(evolutionRuntimeSource, /function readRecoveryAfterFailure[\s\S]*desktop\.getEvolutionReadRecovery[\s\S]*return automaticReadRecovery/);
  assert.match(interactionPreloadSource, /getEvolutionReadRecovery: async \(\) => structuredClone\(evolutionState\.currentTopicStage\?\.readRecovery/);
  assert.match(taskGroupSource, /const deliveryUnavailable = deliveryReadStatus === "unavailable"[\s\S]*const timelineUnavailable = timelineReadStatus === "unavailable"[\s\S]*if \(readObstruction\)[\s\S]*当前无法读取/);
  assert.match(taskGroupSource, /function createReadObstructionPresentation[\s\S]*recovery: CurrentTopicReadRecoveryOutDto[\s\S]*input\.recovery\.requiresUserAction/);
  assert.match(taskGroupSource, /自动重读只按档案政策执行一次[\s\S]*automaticRetryPolicyId/);
  assert.doesNotMatch(taskGroupSource, /automaticReadRetryFinished/);
  assert.match(taskGroupSource, /正在等待：[\s\S]*是否需要你操作：[\s\S]*下一步：\{readObstruction\.nextAction\}/);
  assert.match(taskGroupSource, /submittedReadPolicyId[\s\S]*readObstruction\.requiresUserAction[\s\S]*task-recovery-continue[\s\S]*disabled=\{retryingRead \|\| submittedReadPolicyId === readObstruction\.policyId\}[\s\S]*重新读取中…[\s\S]*已提交，等待处理/);
  assert.match(taskGroupSource, /stateReadStatus === "syncing"[\s\S]*正在同步/);
  assert.match(taskGroupSource, /stateReadStatus === "unavailable"[\s\S]*状态暂未更新/);
  assert.match(taskGroupSource, /statusMessage \? <strong role="status">\{statusMessage\}<\/strong> : <>/);
});

test("空任务页先引导说明需求，再展示后续协作安排", () => {
  assert.match(
    taskGroupSource,
    /task-collaboration-empty-intro[\s\S]*先点击“找韩立说需求”说明目标；会话会引导你确认需求与范围，之后的任务安排会显示在这里。[\s\S]*<\/span>[\s\S]*task-collaboration-empty-action[\s\S]*task-collaboration-empty-detail[\s\S]*审批、分发、执行和验证会按发生顺序显示在这里。/,
  );
});

test("任务协作群空状态在窄窗口保持单列、换行和容器边界", () => {
  assert.match(developerStyles, /\.task-collaboration-empty \{[\s\S]*width: min\(100%, 480px\)[\s\S]*min-width: 0[\s\S]*display: grid/);
  assert.match(developerStyles, /\.task-collaboration-empty > span \{[\s\S]*max-width: 100%[\s\S]*overflow-wrap: anywhere/);
  assert.match(developerStyles, /\.task-collaboration-empty-action \{[\s\S]*max-width: 100%/);
});

test("任务协作群窄窗口不截断专题与节点摘要", () => {
  assert.match(developerStyles, /@media \(max-width: 1120px\) \{[\s\S]*\.task-group-header-content small, \.task-node-main > small \{[\s\S]*overflow-wrap: anywhere[\s\S]*white-space: normal/);
});

test("Workflow 任务协议按业务对象拆分并使用具名子结构", () => {
  // 任务主协议只负责组合当前状态，执行、集成和提交快照分别由独立文件解释。
  assert.doesNotMatch(contractDefinitionSource, /interface CollaborationExecutionRecordOutDto|interface CollaborationIntegrationFailureOutDto|interface CollaborationTaskSnapshotOutDto/);
  assert.match(executionContractSource, /interface CollaborationExecutionRecordOutDto/);
  assert.match(integrationContractSource, /interface CollaborationIntegrationFailureOutDto/);
  assert.match(snapshotContractSource, /interface CollaborationTaskSnapshotOutDto/);
  // 统一测试使用有业务名称的 DTO，避免把匿名对象继续塞进任务主接口。
  assert.match(executionContractSource, /interface CollaborationUnifiedTestOutDto/);
  assert.match(contractDefinitionSource, /unifiedTest\?: CollaborationUnifiedTestOutDto \| null/);
  // 唯一公开入口继续导出原有类型名，业务调用方不需要依赖物理文件位置。
  assert.match(contractSource, /CollaborationExecutionRecordOutDto[\s\S]*collaboration-execution\.out\.dto\.js/);
  assert.match(contractSource, /CollaborationIntegrationBatchOutDto[\s\S]*collaboration-integration\.out\.dto\.js/);
  assert.match(contractSource, /CollaborationTaskSnapshotOutDto[\s\S]*collaboration-task-snapshot\.out\.dto\.js/);
});
