import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const taskCardSource = readFileSync(new URL("../../../src/features/collaboration/components/TaskCollaborationGroup/TaskGroupCard.tsx", import.meta.url), "utf8");
const taskGroupControllerSource = readFileSync(new URL("../../../src/features/collaboration/components/useTaskCollaborationGroup.ts", import.meta.url), "utf8");
const developerStyles = readFileSync(new URL("../../../src/applications/styles/desktop-applications.css", import.meta.url), "utf8");
const applicationRuntimeSource = readFileSync(new URL("../../../electron/system/bootstrap/application-runtime.ts", import.meta.url), "utf8");
const collaborationFacadeSource = readFileSync(new URL("../../../electron/services/workflow/collaboration-workflow.facade.ts", import.meta.url), "utf8");
const personaEvolutionSource = readFileSync(new URL("../../../electron/services/workflow/internal/evolution/persona-evolution.runtime.ts", import.meta.url), "utf8");
const collaborationIpcSource = readFileSync(new URL("../../../electron/system/ipc/domains/register-collaboration-ipc.ts", import.meta.url), "utf8");
const timelineDisplaySource = readFileSync(new URL("../../../src/features/collaboration/components/TaskCollaborationGroup/timeline-display.ts", import.meta.url), "utf8");
const hostStartupServiceSource = readFileSync(new URL("../../../electron/services/evolution/internal/host-startup-evidence.service.ts", import.meta.url), "utf8");
const hostStartupCommandSource = readFileSync(new URL("../../../../../启动SELPLAT.command", import.meta.url), "utf8");

test("当前专题的恢复入口只消费交付投影，不再从时间线节点选择", () => {
  assert.match(taskCardSource, /currentTopicStage\?\.topicId === group\.topicId[\s\S]*currentTopicStage\?\.proposalId === group\.proposalId/);
  assert.match(taskCardSource, /currentStage\?\.userAction === "resume"[\s\S]*resumeOneShotRunId[\s\S]*effectiveTaskIds\.at\(-1\)/);
  assert.match(taskCardSource, /technicalRecoveryActive[\s\S]*!technicalRecoveryActive && currentStage\?\.userAction === "resume"/);
  assert.match(taskCardSource, /task-timeline-next-current[\s\S]*onResumeAcceptance[\s\S]*onContinueTask\(projectedResumeTaskId!/);
  assert.doesNotMatch(taskCardSource, /latestActiveRecoveryAction|TaskGroupRecovery|oneShotRecoveryRequired/);
});

test("任务卡在读取依据期间不沿用旧完成摘要，失败后只保留重新读取入口", () => {
  const taskGroupSource = readFileSync(new URL("../../../src/features/collaboration/components/TaskCollaborationGroup.tsx", import.meta.url), "utf8");
  assert.match(taskGroupSource, /deliveryReadStatus === "syncing"[\s\S]*正在读取验收依据[\s\S]*不会推进、恢复或改写当前专题状态/);
  assert.match(taskGroupSource, /验收依据暂时无法读取[\s\S]*onClick=\{retryDeliveryRead\}/);
  assert.match(taskCardSource, /最终验收依据[\s\S]*currentStage\.finalConclusion[\s\S]*尚未核验：当前不能确认最终验收通过/);
  assert.match(taskCardSource, /task-timeline-detail-pane[\s\S]*最终验收依据[\s\S]*task-timeline-list/s);
  assert.match(taskCardSource, /Host 启动验收[\s\S]*hostStartupAcceptance\.status === "passed"[\s\S]*启动标识[\s\S]*8080 health/);
  assert.match(taskCardSource, /hostStartupAcceptance\.reason[\s\S]*hostStartupAcceptance\.evidenceReferences/);
  assert.match(taskCardSource, /currentStage\?\.hostStartupAcceptance \?\?[\s\S]*尚未记录当前专题的 Host 启动验收依据/);
  assert.match(taskCardSource, /task-host-startup-evidence[\s\S]*展开查看本次启动依据[\s\S]*commandStatus[\s\S]*运行中，尚无退出结果/);
  assert.match(developerStyles, /task-host-startup-evidence > \.seldisclosure-content \{[^}]*max-height: 118px[^}]*overflow-y: auto/);
  assert.match(timelineDisplaySource, /nodeOccurredAtLabel[\s\S]*发生时间[\s\S]*审批依据[\s\S]*代码集成依据/);
  assert.match(taskCardSource, /nodeOccurredAtLabel\(node, locale\)[\s\S]*detailLabel\(node, locale\)}/);
  assert.match(hostStartupServiceSource, /GET[\s\S]*host-startup-evidence\/context[\s\S]*topicId[\s\S]*proposalId[\s\S]*当前专题或提案已经变化/);
  assert.match(hostStartupCommandSource, /HOST_EVIDENCE_ENDPOINT\/context\?token=[\s\S]*submit_host_startup_evidence[\s\S]*submit_host_startup_evidence "running"[\s\S]*wait "\$HOST_GRADLE_PID"/);
});

test("非当前活动卡显示退役按钮且主进程先封存旧执行树再原子退役专题", () => {
  assert.match(taskCardSource, /activeStage\.topicId !== group\.topicId[\s\S]*className="task-stale-retire"[\s\S]*退役旧卡/);
  assert.match(collaborationIpcSource, /desktop:retire-stale-evolution-topic[\s\S]*archiveStaleTopicTask[\s\S]*retireStaleTopic/);
  assert.match(collaborationIpcSource, /retireStaleTopic[\s\S]*eventType: "topic\.retired"[\s\S]*status: "cancelled"[\s\S]*sourceFactKey/);
  assert.match(personaEvolutionSource, /item\.topicId === state\.activeTopicId[\s\S]*supplement-required[\s\S]*rejected/);
});

test("非当前专题统一归入默认收起审计区，且只提供审计阅读", () => {
  const taskGroupSource = readFileSync(new URL("../../../src/features/collaboration/components/TaskCollaborationGroup.tsx", import.meta.url), "utf8");
  assert.match(taskGroupSource, /const activeGroups = establishingTopic[\s\S]*currentTopicStage\?\.topicId[\s\S]*group\.topicId === currentTopicStage\.topicId/);
  assert.match(taskGroupSource, /const auditHistoryGroups = groups\.filter\(\(group\) => !activeGroups\.includes\(group\)\)/);
  assert.match(taskGroupSource, /task-collaboration-audit-history[\s\S]*历史审计[\s\S]*createCardModel\(group, true\)/);
  const auditBranch = taskCardSource.slice(taskCardSource.indexOf('if (group.status === "cancelled" || auditReadOnly)'), taskCardSource.indexOf("// 可见节点"));
  assert.match(auditBranch, /data-audit-history-card[\s\S]*<SelUiDisclosure[\s\S]*className="task-cancelled-history-disclosure"[\s\S]*open=\{open\}[\s\S]*onOpenChange=\{onOpenChange\}/);
  assert.match(auditBranch, /task-cancelled-history-detail[\s\S]*group\.summary[\s\S]*仅供查看审计历史/);
  assert.doesNotMatch(auditBranch, /task-recovery-continue|task-stale-retire|onManualApproval|onContinueTask|onResumeAcceptance|onRetireStaleTopic/);
  assert.match(taskGroupControllerSource, /groupOpenOverrides\.get\(group\.groupId\) \?\? \(!auditReadOnly && group\.status !== "cancelled" && group\.groupId === currentGroupId\)/);
  assert.match(taskGroupControllerSource, /useState<Map<string, boolean>>\(new Map\(\)\)/);
  assert.match(developerStyles, /task-cancelled-history-header[\s\S]*task-cancelled-history-detail[\s\S]*@media \(max-width: 1120px\)[\s\S]*task-cancelled-history-disclosure/);
});

test("无活动技术卡点保留审计历史时明确显示只读空状态", () => {
  const taskGroupSource = readFileSync(new URL("../../../src/features/collaboration/components/TaskCollaborationGroup.tsx", import.meta.url), "utf8");
  assert.match(taskGroupSource, /noActiveTechnicalRecovery = activeGroups\.length === 0[\s\S]*auditHistoryGroups\.length > 0[\s\S]*currentTopicStage\.status !== "failed-pending-repair"/);
  assert.match(taskGroupSource, /noActiveTechnicalRecovery && <div className="task-collaboration-empty task-collaboration-no-active-recovery"[\s\S]*没有待处理技术卡点[\s\S]*当前无需用户操作[\s\S]*等待新证据/);
  const noActiveRecoveryBranch = taskGroupSource.slice(taskGroupSource.indexOf("noActiveTechnicalRecovery &&"), taskGroupSource.indexOf("{activeGroups.map"));
  assert.doesNotMatch(noActiveRecoveryBranch, /task-recovery-continue|onContinueTask|onResumeAcceptance/);
});

test("审计历史卡在窄窗口仍公开四项事实和只读长证据", () => {
  const auditBranch = taskCardSource.slice(taskCardSource.indexOf('if (group.status === "cancelled" || auditReadOnly)'), taskCardSource.indexOf("// 可见节点"));
  assert.match(auditBranch, /taskGroupPrimaryPresentation\(group, locale\)[\s\S]*task-cancelled-history-facts[\s\S]*发生事项[\s\S]*处理人和状态[\s\S]*是否需要你操作[\s\S]*下一步/);
  assert.match(auditBranch, /const auditEvidence = visibleTimelineNodes\(group\.nodes\)[\s\S]*node\.actor\.displayName[\s\S]*task-cancelled-history-evidence/);
  assert.doesNotMatch(auditBranch, /task-recovery-continue|task-stale-retire|onManualApproval|onContinueTask|onResumeAcceptance|onRetireStaleTopic/);
});

test("令狐处理中的活动技术卡点公开转交原因且不签发恢复入口", () => {
  const header = taskCardSource.slice(taskCardSource.indexOf("function TaskGroupHeader"), taskCardSource.indexOf("function TaskNodeHeader"));
  assert.match(header, /technicalRecoveryReason = currentStage\?\.status === "failed-pending-repair"[\s\S]*currentStage\.userAction === "none"[\s\S]*currentStage\.waitingFor === "令狐老祖"[\s\S]*currentStage\.remaining/);
  assert.match(header, /task-group-primary-handoff-reason[\s\S]*转交原因[\s\S]*technicalRecoveryReason/);
  assert.doesNotMatch(header, /task-recovery-continue|onContinueTask|onResumeAcceptance/);
});

test("协作任务状态变化会通过正式订阅重新推送按最新任务事实生成的交付投影", () => {
  assert.match(collaborationFacadeSource, /subscribe\(listener: CollaborationStateListener\)[\s\S]*#store\.subscribe\(listener\)/);
  assert.match(personaEvolutionSource, /#collaboration\.subscribe\(\(_state, reason\) => this\.#notifyCurrentTopicStageChanged\(reason\)\)/);
  assert.match(personaEvolutionSource, /#notifyCurrentTopicStageChanged\(reason: string\)[\s\S]*const state = this\.state\(\)[\s\S]*`collaboration\.\$\{reason\}`/s);
  assert.match(applicationRuntimeSource, /personaEvolution\.subscribeCurrentTopicStage\([\s\S]*desktop:evolution-state/);
  assert.doesNotMatch(applicationRuntimeSource, /onStateChanged: \(state, reason, taskIds\)[\s\S]*personaEvolution\.state\(\)/s);
});

test("独立专题建立中和失败优先于审计历史与空任务引导，且不提供旧专题恢复入口", () => {
  const taskGroupSource = readFileSync(new URL("../../../src/features/collaboration/components/TaskCollaborationGroup.tsx", import.meta.url), "utf8");
  assert.match(taskGroupSource, /const establishingTopic = currentTopicStage[\s\S]*\["establishing-topic", "topic-establishment-failed"\][\s\S]*if \(establishingTopic\)[\s\S]*task-topic-establishment[\s\S]*\{auditHistory\}/);
  assert.match(taskGroupSource, /发生事项：\{establishingTopic\.summary\}[\s\S]*是否需要你操作：当前无需操作。[\s\S]*下一步：\{establishingTopic\.nextAction\}/);
  const establishmentBranch = taskGroupSource.slice(taskGroupSource.indexOf("if (establishingTopic)"), taskGroupSource.indexOf("if (groups.length === 0)"));
  assert.doesNotMatch(establishmentBranch, /openHanliConversation|task-recovery-continue/);
  assert.match(developerStyles, /\.task-topic-establishment \{[\s\S]*width: min\(100%, 560px\)[\s\S]*min-width: 0/);
});
