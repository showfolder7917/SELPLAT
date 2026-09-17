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

test("非当前活动卡显示退役按钮且主进程先封存旧执行树再原子退役专题", () => {
  assert.match(taskCardSource, /activeStage\.topicId !== group\.topicId[\s\S]*className="task-stale-retire"[\s\S]*退役旧卡/);
  assert.match(collaborationIpcSource, /desktop:retire-stale-evolution-topic[\s\S]*archiveStaleTopicTask[\s\S]*retireStaleTopic/);
  assert.match(collaborationIpcSource, /retireStaleTopic[\s\S]*eventType: "topic\.retired"[\s\S]*status: "cancelled"[\s\S]*sourceFactKey/);
  assert.match(personaEvolutionSource, /item\.topicId === state\.activeTopicId[\s\S]*supplement-required[\s\S]*rejected/);
});

test("已取消专题独立归入历史区，默认收起且只提供审计阅读", () => {
  const taskGroupSource = readFileSync(new URL("../../../src/features/collaboration/components/TaskCollaborationGroup.tsx", import.meta.url), "utf8");
  assert.match(taskGroupSource, /const cancelledHistoryGroups = groups\.filter\(\(group\) => group\.status === "cancelled"\)/);
  assert.match(taskGroupSource, /task-collaboration-history[\s\S]*已取消专题历史/);
  const cancelledBranch = taskCardSource.slice(taskCardSource.indexOf('if (group.status === "cancelled")'), taskCardSource.indexOf("// 可见节点"));
  assert.match(cancelledBranch, /<article[\s\S]*className="task-collaboration-cancelled-history-card"[\s\S]*data-cancelled-history-card[\s\S]*<SelUiDisclosure[\s\S]*idPrefix="task-collaboration-cancelled-history"[\s\S]*className="task-cancelled-history-disclosure"[\s\S]*open=\{open\}[\s\S]*onOpenChange=\{onOpenChange\}/);
  assert.match(cancelledBranch, /task-cancelled-history-detail[\s\S]*group\.summary[\s\S]*仅供查看审计历史/);
  assert.doesNotMatch(cancelledBranch, /task-recovery-continue|task-stale-retire|onManualApproval|onContinueTask|onResumeAcceptance|onRetireStaleTopic/);
  assert.match(taskGroupControllerSource, /groupOpenOverrides\.get\(group\.groupId\) \?\? \(group\.status !== "cancelled" && group\.groupId === currentGroupId\)/);
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
