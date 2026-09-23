import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const acceptanceRunner = readFileSync("electron/services/personas/hanli/internal/acceptance/hanli-computer-acceptance.ts", "utf8");
const acceptancePort = readFileSync("electron/services/personas/hanli/internal/acceptance/hanli-acceptance-page.port.ts", "utf8");
const collaborationIpc = readFileSync("electron/system/ipc/domains/register-collaboration-ipc.ts", "utf8");
const desktopIpc = readFileSync("electron/system/ipc/register-desktop-ipc.ts", "utf8");
const applicationRuntime = readFileSync("electron/system/bootstrap/application-runtime.ts", "utf8");

test("韩立正式页面只消费真实业务状态，不接入临时验收场景", () => {
  assert.equal(existsSync("electron/services/personas/hanli/internal/acceptance/hanli-task-collaboration-scenario.ts"), false);
  for (const source of [acceptanceRunner, acceptancePort, collaborationIpc, desktopIpc]) {
    assert.doesNotMatch(source, /TaskCollaborationScenario|taskCollaborationScenario|hanliTaskScenario|acceptance-scenario/u);
  }
  assert.match(collaborationIpc, /desktop:get-collaboration-state[^\n]*collaboration\.state\(\)/u);
  assert.match(collaborationIpc, /desktop:get-nangong-evolution-state[^\n]*evolution\.state\(\)/u);
  assert.match(collaborationIpc, /desktop:continue-collaboration-task[^\n]*collaboration\.continueTask\(taskId\)/u);
  assert.match(acceptanceRunner, /所有状态必须来自当前正式业务数据/u);
  assert.match(acceptanceRunner, /不得点击任务恢复入口/u);
});

test("验收只限制危险交互，实时正式状态仍推送到验收窗口", () => {
  assert.match(desktopIpc, /hanliPageReviewGuard\.begin\(webContentsId\)/u);
  assert.match(desktopIpc, /hanliPageReviewGuard\.end\(webContentsId\)/u);
  assert.doesNotMatch(applicationRuntime, /window\.isDestroyed\(\) \|\| hanliPageReviewGuard\.isReviewing\(window\.webContents\.id\)/u);
  assert.match(applicationRuntime, /desktop:collaboration-state/u);
  assert.match(applicationRuntime, /desktop:evolution-state/u);
  assert.match(applicationRuntime, /desktop:collaboration-timeline-changed/u);
});
