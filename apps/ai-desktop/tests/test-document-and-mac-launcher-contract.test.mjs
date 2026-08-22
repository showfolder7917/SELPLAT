import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const runner = readFileSync(new URL("../scripts/test-document-runner.mjs", import.meta.url), "utf8");
const launcher = readFileSync(new URL("../启动开发版.command", import.meta.url), "utf8");
const appConfig = readFileSync(new URL("../electron/config/app-config.ts", import.meta.url), "utf8");
const builder = readFileSync(new URL("../electron-builder.developer.json", import.meta.url), "utf8");
const macVerifier = readFileSync(new URL("../scripts/verify-mac-developer-app.mjs", import.meta.url), "utf8");
const packagedBootstrap = readFileSync(new URL("../electron/packaged-bootstrap.ts", import.meta.url), "utf8");
const developerApp = readFileSync(new URL("../src/variants/developer/DeveloperApp.tsx", import.meta.url), "utf8");
const developerCss = readFileSync(new URL("../src/variants/developer/developer.css", import.meta.url), "utf8");

test("共享测试文档使用独占锁、占用身份、心跳和过期恢复", () => {
  assert.match(runner, /openSync\(lockPath, "wx"\)/);
  assert.match(runner, /executor.*task.*thread.*pid.*host/s);
  assert.match(runner, /heartbeatAt/);
  assert.match(runner, /共享测试正在被 \$\{lock\.executor\} 执行/);
  assert.match(runner, /isStale\(lock\)/);
});

test("统一测试执行后立即归档共享测试文档", () => {
  assert.match(runner, /const documentPath = path\.join\(appRoot, "测试文档\.md"\)/);
  assert.match(runner, /renameSync\(documentPath, archivePath\)/);
  assert.match(runner, /测试文档已归档/);
});

test("macOS 开发启动器构建并注册固定身份应用", () => {
  assert.match(builder, /com\.selplat\.aidesktop\.developer/);
  assert.match(launcher, /npm run build:developer/);
  assert.match(launcher, /npm run package:mac:developer/);
  assert.match(launcher, /codesign --force --deep --sign -/);
  assert.match(launcher, /REPACKAGE_REQUIRED=false/);
  assert.match(launcher, /固定 AI Desktop\.app 身份未变化/);
  assert.match(launcher, /--ai-desktop-runtime-root=\$SCRIPT_DIR/);
  assert.match(launcher, /lsregister/);
  assert.match(launcher, /open -n "\$APP_PATH" --args/);
  assert.match(appConfig, /--selplat-root=/);
  assert.match(appConfig, /--ai-desktop-variant=/);
  assert.match(macVerifier, /com\.selplat\.aidesktop\.developer/);
  assert.match(macVerifier, /codesign.*--verify/s);
  assert.match(packagedBootstrap, /dist-electron.*electron.*main\.js/s);
  assert.match(packagedBootstrap, /pathToFileURL\(externalMain\)/);
});

test("执行亮点只在运行中闪烁，结束后变暗并显示完成语义", () => {
  assert.match(developerCss, /\.stream-current\.running > i \{ animation: stream-status-pulse/);
  assert.match(developerCss, /\.stream-current\.completed > i[^}]+box-shadow: none/s);
  assert.match(developerApp, /意图分析完成/);
  assert.match(developerApp, /需求分析完成/);
  assert.match(developerApp, /执行与代码验证完成/);
  assert.match(developerApp, /测试完成/);
});

test("回复卡及内部执行面板不允许撑出消息边界", () => {
  assert.match(developerCss, /\.dev-message \{ width: 100%; min-width: 0; max-width: 780px/);
  assert.match(developerCss, /\.stream-details \{ width: 100%; min-width: 0; max-width: 100%/);
  assert.match(developerCss, /grid-template-columns: auto minmax\(0, 1fr\) auto/);
});
