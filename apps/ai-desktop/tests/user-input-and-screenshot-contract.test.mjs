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

test("官方 requestUserInput 保持原回合等待逐题答案并通过白名单 IPC 回传", () => {
  assert.match(codexService, /#userInputs = new Map<number, CodexUserInputRequest>/);
  assert.match(codexService, /normalizeUserInputRequest\(id, params\)/);
  assert.doesNotMatch(codexService, /method === "item\/tool\/requestUserInput"\) \{\s*this\.#respond\(id, \{ answers: \{\} \}\)/);
  assert.match(codexService, /answers\[question\.id\] = \{ answers: \[/);
  assert.match(ipc, /desktop:get-codex-user-inputs/);
  assert.match(preload, /desktop:resolve-codex-user-input/);
  assert.match(developerApp, /function CodexUserInputPanel/);
  assert.match(developerApp, /request\.questions\.every/);
});

test("会话托管要求结构化澄清并在回答后重新输出完整意图", () => {
  assert.match(executor, /必须调用结构化 request_user_input/);
  assert.match(executor, /收到全部答案后，必须重新输出一份完整意图理解/);
  assert.match(executor, /只有没有剩余疑问时才等待用户点击“就是这意思”/);
});
