import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const taskCardSource = readFileSync(new URL("../../../src/features/collaboration/components/TaskCollaborationGroup/TaskGroupCard.tsx", import.meta.url), "utf8");
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
  assert.match(personaEvolutionSource, /item\.topicId === state\.activeTopicId[\s\S]*supplement-required[\s\S]*rejected/);
});

test("协作任务状态变化会通过正式订阅重新推送按最新任务事实生成的交付投影", () => {
  assert.match(collaborationFacadeSource, /subscribe\(listener: CollaborationStateListener\)[\s\S]*#store\.subscribe\(listener\)/);
  assert.match(personaEvolutionSource, /#collaboration\.subscribe\(\(_state, reason\) => this\.#notifyCurrentTopicStageChanged\(reason\)\)/);
  assert.match(personaEvolutionSource, /#notifyCurrentTopicStageChanged\(reason: string\)[\s\S]*const state = this\.state\(\)[\s\S]*`collaboration\.\$\{reason\}`/s);
  assert.match(applicationRuntimeSource, /personaEvolution\.subscribeCurrentTopicStage\([\s\S]*desktop:evolution-state/);
  assert.doesNotMatch(applicationRuntimeSource, /onStateChanged: \(state, reason, taskIds\)[\s\S]*personaEvolution\.state\(\)/s);
});
