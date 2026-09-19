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

test("当前专题的恢复入口只消费交付投影，不再从时间线节点选择", () => {
  assert.match(taskCardSource, /currentTopicStage\?\.topicId === group\.topicId[\s\S]*currentTopicStage\?\.proposalId === group\.proposalId/);
  assert.match(taskCardSource, /currentStage\?\.userAction === "resume"[\s\S]*resumeOneShotRunId[\s\S]*effectiveTaskIds\.at\(-1\)/);
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
