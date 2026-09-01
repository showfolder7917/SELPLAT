import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const runner = readFileSync(new URL("../scripts/test-document-runner.mjs", import.meta.url), "utf8");
const launcher = readFileSync(new URL("../启动开发版.command", import.meta.url), "utf8");
const appConfig = readFileSync(new URL("../electron/system/config/app-config.ts", import.meta.url), "utf8");
const electronMain = readFileSync(new URL("../electron/system/bootstrap/application-runtime.ts", import.meta.url), "utf8");
const builder = readFileSync(new URL("../electron-builder.developer.json", import.meta.url), "utf8");
const macVerifier = readFileSync(new URL("../scripts/verify-mac-developer-app.mjs", import.meta.url), "utf8");
const packagedBootstrap = readFileSync(new URL("../electron/packaged-bootstrap.ts", import.meta.url), "utf8");
const developerApp = readFileSync(new URL("../src/variants/developer/DeveloperApp.tsx", import.meta.url), "utf8");
const developerCss = readFileSync(new URL("../src/variants/developer/developer.css", import.meta.url), "utf8");
const conversationCss = readFileSync(new URL("../../../shared/frontend/sel-ui/src/components/conversation/selConversation.css", import.meta.url), "utf8");
const automaticPreflight = readFileSync(new URL("../electron/services/support/capabilities/testing/automatic-test-preflight.facade.ts", import.meta.url), "utf8");
const trustedCommands = readFileSync(new URL("../electron/services/support/platform/security/internal/trusted-command.store.ts", import.meta.url), "utf8");
const preload = [
  "../electron/system/preload/preload.cts",
  "../electron/system/preload/domains/codex-bridge.cts",
].map((source) => readFileSync(new URL(source, import.meta.url), "utf8")).join("\n");
const desktopIpc = [
  "../electron/system/ipc/register-desktop-ipc.ts",
  "../electron/system/ipc/domains/register-codex-ipc.ts",
].map((source) => readFileSync(new URL(source, import.meta.url), "utf8")).join("\n");

test("共享测试文档使用独占锁、占用身份、心跳和过期恢复", () => {
  assert.match(runner, /openSync\(lockPath, "wx"\)/);
  assert.match(runner, /executor.*task.*thread.*pid.*host/s);
  assert.match(runner, /heartbeatAt/);
  assert.match(runner, /共享测试正在被 \$\{lock\.executor\} 执行/);
  assert.match(runner, /isStale\(lock\)/);
});

test("统一测试执行后立即归档共享测试文档", () => {
  assert.match(runner, /pendingRoot = assertWorkspaceDataPath\(projectRoot, projectPaths\.pendingTestRoot\)/);
  assert.match(runner, /runningRoot = assertWorkspaceDataPath\(projectRoot, projectPaths\.runningTestRoot\)/);
  assert.match(runner, /renameSync\(path\.join\(pendingRoot, runId\), path\.join\(runningRoot, runId\)\)/);
  assert.match(runner, /renameSync\(documentPath, path\.join\(runRoot, "测试结果\.md"\)\)/);
  assert.match(runner, /archiveRoot = assertWorkspaceDataPath\(projectRoot, projectPaths\.testArchiveRoot\)/);
  assert.match(runner, /renameSync\(runRoot, archivePath\)/);
  assert.match(runner, /测试运行已归档/);
  assert.match(runner, /selectRun\(argumentsMap\.runId \|\| null\)/);
  assert.match(runner, /指定测试批次不存在/);
  assert.match(runner, /filter\(\(entry\) => readdirSync[\s\S]*测试文档\./);
});

test("自动测试入口只执行验证白名单并拒绝递归或启动脚本", () => {
  const allowedTestBlock = /const allowedTestScripts = new Set\(\[[\s\S]*?\]\);/.exec(runner)?.[0] || "";
  assert.match(runner, /allowedStandaloneScripts/);
  assert.match(runner, /allowedTestScripts/);
  assert.match(allowedTestBlock, /test:dispatch/);
  assert.match(runner, /allowedStandaloneScripts\.has\(script\) \|\| allowedTestScripts\.has\(script\)/);
  assert.match(runner, /共享测试文档包含未授权脚本/);
  assert.doesNotMatch(runner, /allowedStandaloneScripts.*start:/s);
  assert.doesNotMatch(allowedTestBlock, /test:document/);
});

test("自动测试开启前集中预检并只授权无参数固定入口", () => {
  assert.match(automaticPreflight, /checkHarness/);
  assert.match(automaticPreflight, /checkWorkspace/);
  assert.match(automaticPreflight, /checkRunner/);
  assert.match(automaticPreflight, /checkLock/);
  assert.match(automaticPreflight, /checkPort/);
  assert.doesNotMatch(automaticPreflight, /checkScreenAccess/);
  assert.doesNotMatch(automaticPreflight, /screenAccessStatus/);
  assert.match(trustedCommands, /trustAutomaticTestDocument/);
  assert.match(trustedCommands, /isAutomaticTestDocumentCommand/);
  assert.match(trustedCommands, /npm run test:document/);
  assert.match(preload, /desktop:prepare-automatic-testing/);
  assert.match(desktopIpc, /automatic_test\.preflight/);
  assert.match(desktopIpc, /automatic-test-authorized/);
  assert.match(developerApp, /role="switch"/);
  assert.match(developerApp, /预检之外的授权请求，自动测试已关闭/);
});

test("macOS 开发启动器构建并注册固定身份应用", () => {
  assert.match(builder, /com\.selplat\.aidesktop\.developer/);
  assert.match(launcher, /npm run build:developer/);
  assert.match(launcher, /npm run package:mac:developer/);
  assert.match(launcher, /codesign --force --deep --sign -/);
  assert.match(launcher, /EXPECTED_DESIGNATED_REQUIREMENT='designated => identifier/);
  assert.match(launcher, /codesign --force --sign - --requirements "=\$EXPECTED_DESIGNATED_REQUIREMENT"/);
  assert.match(launcher, /与工程构建隔离的自包含 AI Desktop\.app/);
  assert.doesNotMatch(launcher, /--ai-desktop-runtime-root=/);
  assert.match(launcher, /lsregister/);
  assert.match(launcher, /APP_EXECUTABLE="\$APP_PATH\/Contents\/MacOS\/AI Desktop"/);
  assert.match(launcher, /正在关闭.*旧 AI Desktop 实例/);
  assert.match(launcher, /kill "\$\{EXISTING_PIDS\[@\]\}"/);
  assert.match(launcher, /多个版本并行/);
  assert.match(launcher, /open -n "\$APP_PATH" --args/);
  assert.match(appConfig, /--selplat-root=/);
  assert.match(appConfig, /resolveAppVariant\(\): AppVariant \{\s+return "developer";/);
  assert.match(electronMain, /--ai-desktop-variant=developer/);
  assert.match(macVerifier, /com\.selplat\.aidesktop\.developer/);
  assert.match(macVerifier, /codesign.*--verify/s);
  assert.match(macVerifier, /expectedRequirement/);
  assert.match(macVerifier, /requirementOutput\.includes\(expectedRequirement\)/);
  assert.match(packagedBootstrap, /await import\("\.\/main\.js"\)/);
  assert.doesNotMatch(packagedBootstrap, /external runtime|runtimeRoot|pathToFileURL/);
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
  assert.match(conversationCss, /\.selconversation-message \{ width: 100%; min-width: 0; max-width: 780px/);
  assert.match(developerCss, /\.stream-details \{ width: 100%; min-width: 0; max-width: 100%/);
  assert.match(developerCss, /grid-template-columns: auto minmax\(0, 1fr\) auto/);
});
