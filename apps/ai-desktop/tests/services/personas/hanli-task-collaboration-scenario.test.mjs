import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const scenarioSource = readFileSync("electron/services/personas/hanli/internal/acceptance/hanli-task-collaboration-scenario.ts", "utf8");
const acceptanceRunnerSource = readFileSync("electron/services/personas/hanli/internal/acceptance/hanli-computer-acceptance.ts", "utf8");
const collaborationIpcSource = readFileSync("electron/system/ipc/domains/register-collaboration-ipc.ts", "utf8");
const desktopIpcSource = readFileSync("electron/system/ipc/register-desktop-ipc.ts", "utf8");

test("韩立任务协作群场景只向绑定窗口投影成员空闲，并在结束时恢复真实快照", () => {
  assert.match(scenarioSource, /collaborationStateFor\(webContentsId: number, actual: CollaborationStateOutDto\)/);
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
