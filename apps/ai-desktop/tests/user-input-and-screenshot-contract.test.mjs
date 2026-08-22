import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const screenshotEditor = readFileSync(new URL("../src/variants/developer/ScreenshotEditor.tsx", import.meta.url), "utf8");
const screenshotWindow = readFileSync(new URL("../src/variants/developer/ScreenshotWindowApp.tsx", import.meta.url), "utf8");
const developerApp = readFileSync(new URL("../src/variants/developer/DeveloperApp.tsx", import.meta.url), "utf8");
const codexService = readFileSync(new URL("../electron/services/codex-service.ts", import.meta.url), "utf8");
const ipc = readFileSync(new URL("../electron/ipc/register-desktop-ipc.ts", import.meta.url), "utf8");
const preload = readFileSync(new URL("../electron/preload.cts", import.meta.url), "utf8");
const executor = readFileSync(new URL("../electron/services/managed-task-executor.ts", import.meta.url), "utf8");
const developerCss = readFileSync(new URL("../src/variants/developer/developer.css", import.meta.url), "utf8");
const mainEntry = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");

test("截图编辑器使用可编辑红框并只在选中状态显示完成取消", () => {
  assert.match(screenshotEditor, /selectedRectangleId/);
  assert.match(screenshotEditor, /moveRectangle\(/);
  assert.match(screenshotEditor, /resizeRectangle\(/);
  assert.match(screenshotEditor, /className="screenshot-rectangle-selection"/);
  assert.match(screenshotEditor, /annotations\.length > 0/);
  assert.doesNotMatch(screenshotEditor, /disabled=\{saving\} onClick=\{onCancel\}/);
  assert.match(screenshotEditor, /className="screenshot-actions">[\s\S]*returnToSelection/);
  assert.match(developerApp, /if \(hasAnnotations\) setInput/);
  assert.match(developerApp, /composerRef\.current\?\.focus\(\)/);
  assert.match(ipc, /hasAnnotations: request\.hasAnnotations === true/);
});

test("macOS 截图预热返回结构化权限结果并提供可恢复入口", () => {
  assert.match(ipc, /systemPreferences\.getMediaAccessStatus\("screen"\)/);
  assert.doesNotMatch(ipc, /const accessStatus = getScreenCaptureAccessStatus\(\);[\s\S]*if \(accessStatus === "denied"/);
  assert.match(ipc, /desktopCapturer\.getSources\([\s\S]*const currentAccessStatus = getScreenCaptureAccessStatus\(\)/);
  assert.match(ipc, /new ScreenCapturePreparationError\("permission-required"\)/);
  assert.match(ipc, /return \{ status: "ready" \} satisfies ScreenCapturePreparationResult/);
  assert.match(ipc, /desktop:open-screen-recording-settings/);
  assert.match(ipc, /desktop:restart-for-screen-recording-permission/);
  assert.match(ipc, /app\.relaunch\(\);[\s\S]*app\.exit\(0\)/);
  assert.match(preload, /desktop:open-screen-recording-settings/);
  assert.match(preload, /desktop:restart-for-screen-recording-permission/);
  assert.match(developerApp, /preparation\.status === "blocked"/);
  assert.match(developerApp, /readableDesktopError/);
  assert.match(developerApp, /openScreenRecordingSettings/);
  assert.match(developerApp, /window\.addEventListener\("focus", recheckScreenRecordingPermission\)/);
  assert.match(developerApp, /screenCapturePreparedRef\.current = true;[\s\S]*setScreenshotError\(""\)/);
  assert.match(developerApp, /screenRecordingRestartRequired/);
  assert.match(developerApp, /restartForScreenRecordingPermission/);
});

test("截图固定使用 macOS 原生无光标 PNG 且失败后重建后台窗口", () => {
  assert.match(ipc, /waitForScreenCaptureStage\(resolveScreenCaptureSource\(display\), 8_000/);
  assert.match(ipc, /waitForScreenCaptureStage\(session\.rendererReady, 5_000/);
  assert.match(ipc, /captureNativeMacScreen/);
  assert.match(ipc, /"\/usr\/sbin\/screencapture"/);
  assert.match(ipc, /\["-x", "-t", "png", "-D"/);
  assert.doesNotMatch(ipc, /"-C"/);
  assert.match(ipc, /`native-screen-\$\{process\.pid\}-\$\{attemptId\}\.png`/);
  assert.doesNotMatch(ipc, /`\.native-screen-/);
  assert.match(ipc, /unlink\(scratchPath\)/);
  assert.match(ipc, /main-native-screencapture-requested/);
  assert.match(ipc, /main-native-screencapture-ready/);
  assert.match(ipc, /setTimeout\(resolve, 1_200\)/);
  assert.match(ipc, /main-automation-pointer-overlay-settled/);
  assert.match(ipc, /desktop:screen-capture-frame-requested[\s\S]*capture/);
  assert.match(ipc, /screen_capture\.stage/);
  assert.match(screenshotWindow, /request\.capture/);
  assert.match(screenshotWindow, /renderer-native-frame-received/);
  assert.doesNotMatch(screenshotWindow, /getDisplayMedia/);
  assert.doesNotMatch(screenshotWindow, /getUserMedia/);
  assert.doesNotMatch(screenshotWindow, /requestVideoFrameCallback/);
  assert.doesNotMatch(ipc, /setDisplayMediaRequestHandler/);
  assert.doesNotMatch(ipc, /thumbnail\.toDataURL/);
  assert.doesNotMatch(ipc, /getCursorScreenPoint/);
  assert.doesNotMatch(ipc, /sendInputEvent/);
  assert.doesNotMatch(developerCss, /screenshot-window-root/);
  assert.doesNotMatch(mainEntry, /classList\.add\("screenshot-window-root"\)/);
  assert.match(ipc, /if \(!screenshotWindow\.isDestroyed\(\)\) screenshotWindow\.close\(\)/);
  assert.match(developerApp, /finally \{\s*setScreenshotBusy\(false\);/);
});

test("Codex 执行期间仍允许截图、粘贴和排队发送", () => {
  assert.match(developerApp, /window\.desktop\?\.enqueueMessage/);
  assert.match(developerApp, /dispatchState\.activeTask/);
  assert.match(developerApp, /补充到当前任务/);
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
