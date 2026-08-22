import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const screenshotEditor = readFileSync(new URL("../src/variants/developer/ScreenshotEditor.tsx", import.meta.url), "utf8");
const developerApp = readFileSync(new URL("../src/variants/developer/DeveloperApp.tsx", import.meta.url), "utf8");
const codexService = readFileSync(new URL("../electron/services/codex-service.ts", import.meta.url), "utf8");
const ipc = readFileSync(new URL("../electron/ipc/register-desktop-ipc.ts", import.meta.url), "utf8");
const preload = readFileSync(new URL("../electron/preload.cts", import.meta.url), "utf8");
const executor = readFileSync(new URL("../electron/services/managed-task-executor.ts", import.meta.url), "utf8");

test("截图编辑器允许无红色标注直接完成并准确回传标注状态", () => {
  assert.match(screenshotEditor, /history\.length > 1/);
  assert.match(screenshotEditor, /className="primary" disabled=\{saving\} onClick=\{\(\) => void complete\(\)\}/);
  assert.match(developerApp, /if \(hasAnnotations\) setInput/);
  assert.match(developerApp, /composerRef\.current\?\.focus\(\)/);
  assert.match(ipc, /hasAnnotations: request\.hasAnnotations === true/);
});

test("macOS 截图预热返回结构化权限结果并提供可恢复入口", () => {
  assert.match(ipc, /systemPreferences\.getMediaAccessStatus\("screen"\)/);
  assert.match(ipc, /new ScreenCapturePreparationError\("permission-required"\)/);
  assert.match(ipc, /return \{ status: "ready" \} satisfies ScreenCapturePreparationResult/);
  assert.match(ipc, /desktop:open-screen-recording-settings/);
  assert.match(preload, /desktop:open-screen-recording-settings/);
  assert.match(developerApp, /preparation\.status === "blocked"/);
  assert.match(developerApp, /readableDesktopError/);
  assert.match(developerApp, /openScreenRecordingSettings/);
});

test("Codex 执行期间仍允许截图、粘贴和排队发送", () => {
  assert.match(developerApp, /setQueuedSends\(\(current\) => \[\.\.\.current/);
  assert.match(developerApp, /if \(screenshotBusy\) return/);
  assert.match(developerApp, /if \(screenshotBusy \|\| files\.length === 0\) return/);
  assert.doesNotMatch(developerApp, /disabled=\{screenshotBusy \|\| loading\}/);
  assert.match(developerApp, /待发送 \{queuedSends\.length\}/);
});

test("官方 requestUserInput 保持原回合等待逐题答案并通过白名单 IPC 回传", () => {
  assert.match(codexService, /#userInputs = new Map<number, CodexUserInputRequest>/);
  assert.match(codexService, /normalizeUserInputRequest\(id, params\)/);
  assert.doesNotMatch(codexService, /method === "item\/tool\/requestUserInput"\) \{\s*this\.#respond\(id, \{ answers: \{\} \}\)/);
  assert.match(codexService, /answers\[question\.id\] = \{ answers: \[/);
  assert.match(codexService, /default_mode_request_user_input/);
  assert.match(codexService, /capabilities: \{ experimentalApi: true \}/);
  assert.match(ipc, /desktop:get-codex-user-inputs/);
  assert.match(preload, /desktop:resolve-codex-user-input/);
  assert.match(developerApp, /function CodexUserInputPanel/);
  assert.match(developerApp, /confirmedQuestionIds/);
  assert.match(developerApp, /onConfirm\(question\.id\)/);
});

test("会话托管要求结构化澄清并在回答后重新输出完整意图", () => {
  assert.match(executor, /调用结构化 request_user_input/);
  assert.match(executor, /每次必须只选择一个最高优先级疑问/);
  assert.match(executor, /用户确认该点后必须重新理解完整会话/);
  assert.match(executor, /只有全部疑问消除后/);
});
