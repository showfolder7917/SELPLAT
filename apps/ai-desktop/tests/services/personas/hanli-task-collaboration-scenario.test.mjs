import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const scenarioSource = readFileSync("electron/services/personas/hanli/internal/acceptance/hanli-task-collaboration-scenario.ts", "utf8");
const acceptanceRunnerSource = readFileSync("electron/services/personas/hanli/internal/acceptance/hanli-computer-acceptance.ts", "utf8");
const acceptancePortSource = readFileSync("electron/services/personas/hanli/internal/acceptance/hanli-acceptance-page.port.ts", "utf8");
const collaborationIpcSource = readFileSync("electron/system/ipc/domains/register-collaboration-ipc.ts", "utf8");
const desktopIpcSource = readFileSync("electron/system/ipc/register-desktop-ipc.ts", "utf8");

test("韩立任务协作群场景只向绑定窗口投影成员空闲，并在结束时恢复真实快照", () => {
  assert.match(scenarioSource, /collaborationStateFor\(webContentsId: number, actual: CollaborationStateOutDto\)/);
  assert.match(scenarioSource, /stateFor\(webContentsId: number, actual: EvolutionStateOutDto\)[\s\S]*oneShotRun: null[\s\S]*currentTopicStage: createStage/);
  assert.match(scenarioSource, /if \(!this\.isActiveFor\(webContentsId\)\) return actual/);
  assert.match(scenarioSource, /state: "idle"[\s\S]*currentTaskId: null[\s\S]*blockingReason: null/);
  assert.match(scenarioSource, /return this\.collaborationStateFor\(webContentsId, this\.readCollaborationState\(\)\)/);
  assert.match(scenarioSource, /this\.publish\(active\.window, this\.readState\(\), this\.readTimeline\(\), this\.readCollaborationState\(\), "acceptance-scenario\.ended"\)/);
  assert.match(acceptanceRunnerSource, /finally \{[\s\S]*interactions\.endTaskCollaborationScenario\?\.\(\)/);
});

test("成员投影通过既有读取与订阅通道同步，不改变普通协作入口", () => {
  assert.match(collaborationIpcSource, /desktop:get-collaboration-state[\s\S]*collaborationStateFor\(event\.sender\.id, collaboration\.state\(\)\)/);
  assert.match(collaborationIpcSource, /desktop:continue-collaboration-task[\s\S]*hanliTaskScenario\?\.confirm[\s\S]*韩立隔离验收场景只接受当前页面签发的确认入口[\s\S]*collaboration\.continueTask/);
  assert.match(desktopIpcSource, /desktop:collaboration-state[\s\S]*state: collaborationState[\s\S]*taskIds: \[\]/);
});

test("完整指导和新阻塞由验收条件准备，复查中仍只接受正式页面确认", () => {
  assert.match(scenarioSource, /stageFor\(webContentsId: number\)[\s\S]*scenarioStage/);
  assert.match(scenarioSource, /prepare\(webContentsId: number, target:[\s\S]*customer-guidance[\s\S]*active\.stage === 0[\s\S]*new-blocker[\s\S]*active\.stage === 2/);
  assert.match(scenarioSource, /confirm\(webContentsId: number, taskId: string\)[\s\S]*active\.stage !== 1[\s\S]*active\.stage = 2/);
  assert.match(acceptancePortSource, /currentTaskCollaborationScenarioStage[\s\S]*prepareTaskCollaborationScenario/);
  assert.match(acceptanceRunnerSource, /taskCollaborationScenarioTarget[\s\S]*customer-guidance[\s\S]*taskCollaborationScenarioNextAction/);
  assert.match(scenarioSource, /affectedFiles: \["apps\/ai-desktop\/electron\/services\/workflow\/domain\/current-topic-stage\.projection\.ts"\][\s\S]*完成该文件关联的外部确认[\s\S]*已确认 current-topic-stage\.projection\.ts 关联的外部条件/);
  assert.doesNotMatch(scenarioSource, /affectedFiles: \["任务协作群卡点记录"\]/);
  assert.doesNotMatch(acceptanceRunnerSource, /advance-task-collaboration-scenario/);
});

test("窗口专属阶段只关联既有当前节点，供主卡和时间线同屏核对", () => {
  assert.match(scenarioSource, /const currentTaskId = active\.group\.nodes\.find\(\(node\) => node\.status === "current" && node\.taskId\)\?\.taskId \|\| null/);
  assert.match(scenarioSource, /effectiveTaskIds: currentTaskId \? \[currentTaskId\] : \[\]/);
  assert.doesNotMatch(scenarioSource, /continueTask\(/);
});
