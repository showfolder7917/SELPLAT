import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const runner = readFileSync(new URL("../../scripts/test-document-runner.mjs", import.meta.url), "utf8");
const launcher = readFileSync(new URL("../../启动开发版.command", import.meta.url), "utf8");
const packageManifest = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
const appConfig = readFileSync(new URL("../../electron/system/config/app-config.ts", import.meta.url), "utf8");
const startupContext = readFileSync(new URL("../../electron/system/bootstrap/startup-context.ts", import.meta.url), "utf8");
const collaborationBootstrap = readFileSync(new URL("../../electron/system/bootstrap/collaboration.bootstrap.ts", import.meta.url), "utf8");
const mainEntry = readFileSync(new URL("../../electron/main.ts", import.meta.url), "utf8");
const electronMain = readFileSync(new URL("../../electron/system/bootstrap/application-runtime.ts", import.meta.url), "utf8");
const builder = readFileSync(new URL("../../electron-builder.developer.json", import.meta.url), "utf8");
const builderConfig = readFileSync(new URL("../../electron-builder.developer.config.cjs", import.meta.url), "utf8");
const packagedRecoveryLauncher = readFileSync(new URL("../../resources/runtime-activation-recovery.command", import.meta.url), "utf8");
const macVerifier = readFileSync(new URL("../../scripts/verify-mac-developer-app.mjs", import.meta.url), "utf8");
const packageContentVerifier = readFileSync(new URL("../../scripts/verify-package-content.mjs", import.meta.url), "utf8");
const recoveryController = readFileSync(new URL("../../scripts/recover-runtime-activation.mjs", import.meta.url), "utf8");
const packagedBootstrap = readFileSync(new URL("../../electron/packaged-bootstrap.ts", import.meta.url), "utf8");
const streamDetails = readFileSync(new URL("../../src/features/conversation/components/StreamDetails.tsx", import.meta.url), "utf8");
const fixedUiText = readFileSync(new URL("../../contracts/foundation/i18n/fixed-ui-text.ts", import.meta.url), "utf8");
const developerApp = [
  "../../src/applications/developer/DeveloperApplication.tsx",
  "../../src/features/conversation/components/CodexConversationWorkspace.tsx",
  "../../src/features/conversation/components/CodexConversationWorkspace/CodexConversationComposer.tsx",
  "../../src/features/conversation/components/StreamDetails.tsx",
  "../../src/features/testing/model/useAutomaticTesting.ts",
].map((source) => readFileSync(new URL(source, import.meta.url), "utf8")).join("\n");
const developerCss = readFileSync(new URL("../../src/applications/styles/desktop-applications.css", import.meta.url), "utf8");
const conversationCss = readFileSync(new URL("../../../../shared/frontend/sel-ui/src/components/conversation/selConversation.css", import.meta.url), "utf8");
const automaticPreflight = readFileSync(new URL("../../electron/services/support/capabilities/testing/automatic-test-preflight.facade.ts", import.meta.url), "utf8");
const trustedCommands = readFileSync(new URL("../../electron/services/support/platform/security/internal/trusted-command.store.ts", import.meta.url), "utf8");
const preload = [
  "../../electron/system/preload/preload.cts",
  "../../electron/system/preload/domains/codex-bridge.cts",
].map((source) => readFileSync(new URL(source, import.meta.url), "utf8")).join("\n");
const desktopIpc = [
  "../../electron/system/ipc/register-desktop-ipc.ts",
  "../../electron/system/ipc/domains/register-codex-ipc.ts",
].map((source) => readFileSync(new URL(source, import.meta.url), "utf8")).join("\n");

test("共享测试文档使用独占锁、占用身份、心跳和过期恢复", () => {
  assert.match(runner, /openSync\(lockPath, "wx"\)/);
  assert.match(runner, /executor.*task.*thread.*pid.*host/s);
  assert.match(runner, /heartbeatAt/);
  assert.match(runner, /共享测试正在被 \$\{lock\.executor\} 执行/);
  assert.match(runner, /isStale\(lock\)/);
});

test("发布恢复由候选包外控制器校验身份后委托已提升包资源", () => {
  assert.equal(packageManifest.scripts["recover:runtime-activation"], "node scripts/run-with-dependencies.mjs node scripts/recover-runtime-activation.mjs");
  assert.match(recoveryController, /document\.state !== "failed"/);
  assert.match(recoveryController, /document\.runtimeActivation\?\.state !== "preparing"/);
  assert.match(recoveryController, /manifest\.sourceSha !== candidateSha/);
  assert.match(recoveryController, /runtime-activation-recovery\.command/);
  assert.match(recoveryController, /--release-batch=\$\{request\.releaseBatchId\}/);
  assert.match(recoveryController, /fileURLToPath\(import\.meta\.url\)/);
  assert.doesNotMatch(recoveryController, /writeFileSync|renameSync|rmSync/);
});

test("韩立交互式验收超时先返回明确事实，再回收隔离 harness", () => {
  assert.match(electronMain, /const acceptanceTimeout = new Promise<never>/);
  assert.match(electronMain, /韩立交互式验收会话超过10分钟未完成，未代替韩立给出验收结论/);
  assert.match(electronMain, /const sendAcceptanceTurn = \(promptId:[\s\S]*Promise\.race\(\[\s*service\.send\([\s\S]*acceptanceTimeout,/);
  assert.match(electronMain, /await sendAcceptanceTurn\("hanli\.computer-acceptance"\);[\s\S]*for \(let continuationIndex = 0; continuationIndex < 3;[\s\S]*const continuation = session\.nextContinuation\(\);[\s\S]*continuation\.kind === "retry-observation"[\s\S]*hanli\.computer-acceptance-finalization[\s\S]*hanli\.computer-acceptance-correction/);
  assert.match(electronMain, /finally \{ if \(timer\) clearTimeout\(timer\); service\.dispose\(\); \}/);
  assert.doesNotMatch(electronMain, /setTimeout\(\(\) => service\.dispose\(\), 180_000\)/);
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
  assert.match(builderConfig, /const sourceBundleBuildRoot = path\.join\(selplatRoot, "build", "ai-desktop"\);[\s\S]*resource\.to === "ruleengine".*path\.join\(sourceBundleBuildRoot, "rule-bundle"\)[\s\S]*resource\.to === "prompts".*path\.join\(sourceBundleBuildRoot, "prompt-bundle"\)/);
  assert.match(builderConfig, /const candidateProjectRoot = path\.resolve\(applicationRoot, "\.\.\/\.\."\);[\s\S]*const candidateBuildRoot = path\.join\(candidateProjectRoot, "build", "ai-desktop"\);[\s\S]*entry\.from === "\.\.\/\.\.\/build\/ai-desktop\/renderer\/developer"[\s\S]*path\.join\(candidateBuildRoot, "renderer", "developer"\)[\s\S]*entry\.from === "\.\.\/\.\.\/build\/ai-desktop\/electron"[\s\S]*path\.join\(candidateBuildRoot, "electron"\)/);
  assert.match(builderConfig, /resource\.to === "db\/sql".*path\.join\(applicationRoot, "db", "sql"\)/);
  assert.match(builder, /"to": "runtime-activation-recovery\.command"/);
  assert.match(builderConfig, /resource\.to === "runtime-activation-recovery\.command"[\s\S]*path\.join\(applicationRoot, "resources", "runtime-activation-recovery\.command"\)/);
  assert.match(builder, /\{ "from": "db\/sql", "to": "db\/sql", "filter": \["load-order\.txt", "\*\.sql"\] \}/);
  assert.doesNotMatch(launcher, /^if ! npm run build:developer/m);
  assert.match(launcher, /npm run package:mac:developer/);
  assert.match(launcher, /RUN_PATH="\$RUNS_ROOT\/\$RUN_ID"[\s\S]*mkdir "\$RUN_PATH"/);
  assert.match(launcher, /export AI_DESKTOP_PACKAGE_OUTPUT_ROOT="\$RUN_PATH"/);
  assert.match(launcher, /npm run verify:package-content \|\| ! npm run verify:mac:developer/);
  assert.ok(launcher.indexOf("npm run verify:mac:developer") < launcher.indexOf('kill "${EXISTING_PIDS[@]}"'), "旧进程只能在隔离包验证后关闭");
  assert.match(launcher, /RUNS_ROOT="\$PACKAGE_AREA\/developer-runs"/);
  assert.match(launcher, /READY_FILE="\$RUN_PATH\/\.renderer-ready\.json"[\s\S]*--ai-desktop-launch-ready-file=\$READY_FILE/);
  assert.match(launcher, /NEW_PROCESS_READY[\s\S]*\[\[ -f "\$READY_FILE" \]\][\s\S]*rm -rf -- "\$OLD_RUN"/);
  assert.match(launcher, /\[\[ -d "\$PACKAGE_AREA\/published" && ! -L "\$PACKAGE_AREA\/published" \]\][\s\S]*rm -rf -- "\$OLD_PUBLISHED"/);
  assert.match(electronMain, /launchReadyFile[\s\S]*confirmPublishedRestart\(\)[\s\S]*writeFileSync\(launchReadyFile/);
  assert.match(packageManifest.scripts["package:mac:developer"], /npm run build:developer/);
  assert.match(launcher, /codesign --force --deep --sign -/);
  assert.match(launcher, /EXPECTED_DESIGNATED_REQUIREMENT='designated => identifier/);
  assert.match(launcher, /codesign --force --sign - --requirements "=\$EXPECTED_DESIGNATED_REQUIREMENT"/);
  assert.match(launcher, /最新的自包含 AI Desktop\.app/);
  assert.doesNotMatch(launcher, /--ai-desktop-runtime-root=/);
  assert.match(launcher, /lsregister/);
  assert.match(launcher, /APP_EXECUTABLE="\$APP_PATH\/Contents\/MacOS\/AI Desktop"/);
  assert.match(launcher, /正在关闭.*旧 AI Desktop 实例/);
  assert.match(launcher, /kill "\$\{EXISTING_PIDS\[@\]\}"/);
  assert.match(mainEntry, /for \(const signal of \["SIGTERM", "SIGINT"\] as const\) process\.once\(signal, \(\) => app\.quit\(\)\);/);
  assert.match(mainEntry, /app\.on\("before-quit", \(\) => disposeApplication\(\)\)/);
  assert.doesNotMatch(mainEntry, /app\.on\("before-quit", disposeApplication\)/);
  assert.match(launcher, /多个版本并行/);
  assert.match(launcher, /open -n "\$APP_PATH" --args/);
  assert.match(launcher, /git -C "\$SELPLAT_ROOT" diff --quiet "\$CONTROLLED_SHA" HEAD --/);
  assert.match(launcher, /--ai-desktop-runtime-sha=\$CONTROLLED_SHA/);
  assert.doesNotMatch(launcher, /recover-staged-release/);
  assert.match(packagedRecoveryLauncher, /ai-desktop-runtime-source\.json/);
  assert.match(packagedRecoveryLauncher, /--ai-desktop-recover-release=\$RELEASE_BATCH/);
  assert.match(packagedRecoveryLauncher, /归档批次、候选 SHA、暂存清理失败事实或运行包来源不匹配/);
  assert.doesNotMatch(packagedRecoveryLauncher, /npm run package:mac:developer/);
  assert.match(launcher, /--ai-desktop-user-data-dir=\$CONTROLLED_USER_DATA_DIR/);
  assert.match(electronMain, /isolatedUserDataArgument[\s\S]*--user-data-dir=\$\{isolatedUserData\}/);
  assert.match(appConfig, /--selplat-root=/);
  assert.match(appConfig, /resolveAppVariant\(\): AppVariantValue \{\s+return "developer";/);
  assert.match(electronMain, /releaseRestartArguments\(projectRoot, runtimeSourceSha, process\.argv\)/);
  assert.match(startupContext, /const ownsApplicationInstance = healthCheckFile \? true : app\.requestSingleInstanceLock\(\);/);
  assert.match(startupContext, /if \(!healthCheckFile && !ownsApplicationInstance\) app\.quit\(\);/);
  assert.match(startupContext, /else if \(!healthCheckFile\) app\.on\("second-instance"/);
  assert.match(startupContext, /recoverReleaseBatchId = readArgument\("--ai-desktop-recover-release="\)/);
  assert.match(collaborationBootstrap, /recoverArchivedStagingCleanupFailure\(recoveryBatchId, options\.startup\.runtimeSourceSha \|\| ""\)/);
  assert.match(macVerifier, /com\.selplat\.aidesktop\.developer/);
  assert.match(macVerifier, /codesign.*--verify/s);
  assert.match(macVerifier, /expectedRequirement/);
  assert.match(macVerifier, /requirementOutput\.includes\(expectedRequirement\)/);
  assert.match(macVerifier, /const describeHealthCheckFailure = \(health, cause = null\) => \{/);
  assert.match(macVerifier, /const healthDiagnostics = \{/);
  assert.match(macVerifier, /status: health\.status/);
  assert.match(macVerifier, /signal: health\.signal/);
  assert.match(macVerifier, /healthFileContent: existsSync\(healthFile\) \? readFileSync\(healthFile, "utf8"\) : null/);
  assert.match(macVerifier, /候选包隔离启动失败；保留诊断目录/);
  assert.match(macVerifier, /describeHealthCheckFailure\(health, `候选包未报告 ready 状态：/);
  assert.match(macVerifier, /if \(healthCheckPassed\) rmSync\(healthRun/);
  assert.match(packageContentVerifier, /for \(const promptResource of \["manifest\.json", "prompts\.json"\]\)/);
  assert.match(packageContentVerifier, /Packaged prompt resource is missing/);
  assert.match(packageContentVerifier, /Packaged SQLite migration manifest is missing/);
  assert.match(packageContentVerifier, /Packaged SQLite migration is missing/);
  assert.match(packageContentVerifier, /Packaged runtime activation recovery launcher is missing/);
  assert.match(packageContentVerifier, /Packaged runtime activation recovery launcher is not executable/);
  assert.match(packageContentVerifier, /filter\(\(entry\) => entry && !entry\.startsWith\("#"\)\)/);
  assert.match(packageContentVerifier, /assertPackagedDistributionParser/);
  assert.match(packageContentVerifier, /packagedDistributionServicePath/);
  assert.match(packagedBootstrap, /await import\("\.\/main\.js"\)/);
  assert.doesNotMatch(packagedBootstrap, /external runtime|runtimeRoot|pathToFileURL/);
});

test("执行亮点只在运行中闪烁，结束后变暗并显示完成语义", () => {
  assert.match(developerCss, /\.stream-current\.running > i \{ animation: stream-status-pulse/);
  assert.match(developerCss, /\.stream-current\.completed > i[^}]+box-shadow: none/s);
  assert.match(streamDetails, /"conversation-managed": "streamConversationCompleted"/);
  assert.match(streamDetails, /"requirement-managed": "streamRequirementCompleted"/);
  assert.match(streamDetails, /"task-managed": "streamTaskCompleted"/);
  assert.match(streamDetails, /"test-managed": "streamTestCompleted"/);
  assert.match(streamDetails, /return fixedUiText\(locale, mode \? labelsByMode\[mode\] \|\| "streamCompleted" : "streamCompleted"\)/);
  assert.match(fixedUiText, /streamConversationCompleted: "意图分析完成"/);
  assert.match(fixedUiText, /streamRequirementCompleted: "需求分析完成"/);
  assert.match(fixedUiText, /streamTaskCompleted: "执行与代码验证完成"/);
  assert.match(fixedUiText, /streamTestCompleted: "测试完成"/);
});

test("回复卡及内部执行面板不允许撑出消息边界", () => {
  assert.match(conversationCss, /\.selconversation-message \{ width: 100%; min-width: 0; max-width: 780px/);
  assert.match(developerCss, /\.stream-details \{ width: 100%; min-width: 0; max-width: 100%/);
  assert.match(developerCss, /grid-template-columns: auto minmax\(0, 1fr\) auto/);
});
