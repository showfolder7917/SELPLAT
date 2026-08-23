import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const executor = readFileSync(new URL("../electron/services/managed-task-executor.ts", import.meta.url), "utf8");
const codexService = readFileSync(new URL("../electron/services/codex-service.ts", import.meta.url), "utf8");
const codexRuntime = readFileSync(new URL("../electron/services/codex-runtime.ts", import.meta.url), "utf8");
const codexSessionStore = readFileSync(new URL("../electron/services/codex-session-store.ts", import.meta.url), "utf8");
const electronMain = readFileSync(new URL("../electron/main.ts", import.meta.url), "utf8");
const ipc = readFileSync(new URL("../electron/ipc/register-desktop-ipc.ts", import.meta.url), "utf8");
const developerApp = readFileSync(new URL("../src/variants/developer/DeveloperApp.tsx", import.meta.url), "utf8");
const markdownMessage = readFileSync(new URL("../src/variants/developer/MarkdownMessage.tsx", import.meta.url), "utf8");
const interactionPreload = readFileSync(new URL("./interaction/isolated-preload.cjs", import.meta.url), "utf8");
const interactionSpec = readFileSync(new URL("./interaction/developer-sidebar.spec.ts", import.meta.url), "utf8");
const audit = readFileSync(new URL("../electron/services/business-audit-log.ts", import.meta.url), "utf8");
const dispatchStore = readFileSync(new URL("../electron/services/conversation-dispatch-store.ts", import.meta.url), "utf8");

test("任务托管只完成代码级验证并硬拦截构建启动", () => {
  assert.match(executor, /task-managed/);
  assert.match(executor, /codeValidationGate/);
  assert.match(executor, /任务要求修改源码，但未观察到文件变更/);
  assert.doesNotMatch(executor, /likelySourceChangeRequest/);
  assert.match(executor, /必须产生可追踪的源码变更/);
  assert.match(executor, /this\.#lastChange = this\.#sequence/);
  assert.match(executor, /diff-updated 是当前工作树的完整路径快照/);
  assert.match(executor, /isManagedValidationArtifact/);
  assert.match(executor, /if \(sourceFiles\.length > 0\) this\.#lastChange = this\.#sequence/);
  assert.match(executor, /执行日志\\\/\(\?:待执行\|运行中\)\\\/测试/);
  assert.match(executor, /归档日志\\\/\(\?:测试归档/);
  assert.match(executor, /静态检查已通过/);
  assert.match(executor, /禁止构建、启动或重启/);
  assert.match(codexService, /activeExecutionMode === "task-managed"/);
  assert.match(codexService, /isManagedBuildOrStartCommand/);
});

test("任务托管使用后台隔离 Electron 交互测试并最多自动修复五轮", () => {
  assert.match(executor, /const VALIDATION_ROUNDS = 5/);
  assert.match(executor, /interaction-validation/);
  assert.match(executor, /isIsolatedInteractionTestCommand/);
  assert.match(executor, /npm run test:interaction/);
  assert.match(executor, /后台隔离 Electron 交互测试已通过/);
  assert.match(audit, /isolated_interaction_test_not_observed/);
});

test("会话与需求托管只读运行并由确认动作逐级推进", () => {
  assert.match(executor, /conversation-managed/);
  assert.match(executor, /requirement-managed/);
  assert.match(executor, /当前只负责交流、理解和确认意图/);
  assert.match(executor, /只允许只读调查原因、定位问题点并给出具体修正方案/);
  assert.match(executor, /这是后台工作边界，仅供内部遵守/);
  assert.match(executor, /不要把用户每句话都改写成正式需求/);
  assert.doesNotMatch(executor, /\[会话托管\]|\[需求托管\]|\[任务托管执行|\[测试托管执行/);
  assert.match(codexService, /analysisOnly/);
  assert.match(codexService, /普通问题直接回答/);
  assert.match(codexService, /不要机械复述阶段名称、规则、标签或固定模板/);
  assert.match(ipc, /mode === "conversation-managed" \|\| mode === "requirement-managed" \? "read-only"/);
});

test("测试托管只在完成门禁明确要求时执行自身的单次受控重启", () => {
  assert.match(executor, /buildValidationGate/);
  assert.match(executor, /公共路径能力解析当前工程目录/);
  assert.match(executor, /归档日志\/测试归档\/<年月>\/<runId>/);
  assert.match(executor, /npm run test:document/);
  assert.match(executor, /isUnifiedTestDocumentCommand/);
  assert.match(executor, /unifiedDocumentCompleted/);
  assert.match(executor, /this\.#targetedTest < this\.#build/);
  assert.doesNotMatch(ipc, /function isTestManagedRequest/);
  const testManagedRestartBlock = ipc.match(/if \(response\.restartRequired\) \{[\s\S]*?\n      \}/)?.[0] || "";
  assert.match(testManagedRestartBlock, /test_managed_completed/);
  assert.match(testManagedRestartBlock, /app\.relaunch\(\); app\.exit\(0\)/);
  assert.equal((testManagedRestartBlock.match(/app\.relaunch\(\)/g) || []).length, 1);
});

test("屏幕录制权限恢复只允许用户通过 macOS 专用无参数 IPC 重启", () => {
  const permissionRestartHandler = ipc.match(/ipcMain\.handle\("desktop:restart-for-screen-recording-permission"[\s\S]*?\n  \}\);/)?.[0] || "";
  assert.match(permissionRestartHandler, /process\.platform !== "darwin"/);
  assert.match(permissionRestartHandler, /main-permission-restart-requested/);
  assert.match(permissionRestartHandler, /app\.relaunch\(\);[\s\S]*app\.exit\(0\)/);
  assert.equal((permissionRestartHandler.match(/app\.relaunch\(\)/g) || []).length, 1);
  // 主进程只允许上述两条目的明确、互不混用的重启路径。
  assert.equal((ipc.match(/app\.relaunch\(\)/g) || []).length, 2);
});

test("界面按四阶段确认推进，日志记录阶段结果而不强制构建", () => {
  assert.match(developerApp, /useState<ManagedExecutionMode>\("conversation-managed"\)/);
  assert.match(developerApp, /就是这意思/);
  assert.match(developerApp, /按这个方案执行/);
  assert.match(developerApp, /测试一下/);
  assert.match(developerApp, /重新分析需求/);
  assert.match(developerApp, /重新执行/);
  assert.match(developerApp, /重新测试/);
  assert.match(developerApp, /回到会话托管/);
  assert.match(developerApp, /回到任务托管/);
  assert.match(developerApp, /normalized === "1"/);
  assert.match(developerApp, /current === "conversation-managed" && normalized === "就是这意思"/);
  assert.match(developerApp, /current === "requirement-managed" && normalized === "按这个方案执行"/);
  assert.match(developerApp, /managed-stage-action/);
  assert.match(developerApp, /onReturn=\{setExecutionMode\}/);
  assert.match(developerApp, /activeMode === returnTarget/);
  assert.match(developerApp, /current === "task-managed" \|\| current === "test-managed"/);
  assert.match(developerApp, /latestManagedAssistantId/);
  assert.match(developerApp, /disabled=\{!actionable \|\| message\.streaming\}/);
  assert.match(developerApp, /managed-execution-status/);
  assert.match(audit, /managedStatus/);
  assert.match(audit, /pendingActions/);
  assert.doesNotMatch(audit, /ai_desktop_source_changed_without_build/);
  assert.doesNotMatch(audit, /running_bundle_older_than_source/);
});

test("多轮托管按真实 turnId 向下新增回复卡并冻结上一轮", () => {
  assert.match(developerApp, /turnSegments\?: Record<string, string>/);
  assert.match(developerApp, /turnMessageIdsRef = useRef<Map<string, number>>/);
  assert.match(developerApp, /createAssistantMessage\(messageId, activeManagedModeRef\.current\)/);
  assert.match(developerApp, /turnMessageIdsRef\.current\.set\(event\.turnId, messageId\)/);
  assert.match(developerApp, /streaming: false, streamTerminal: true/);
  assert.match(developerApp, /updateTurnSegment\(message, event\.segmentId \|\| event\.turnId/);
  assert.match(developerApp, /message\.streamTerminal && event\.type !== "error"/);
  assert.match(codexService, /segmentId: `\$\{turnId\}:\$\{itemId\}`/);
  assert.match(developerApp, /completedAssistantId = activeAssistantIdRef\.current \|\| assistantId/);
  assert.match(developerApp, /text: item\.text \|\| response\.text/);
  assert.doesNotMatch(developerApp, /text: response\.text \|\| item\.text/);
  assert.match(interactionPreload, /turnId: "isolated-turn-1"/);
  assert.match(interactionPreload, /turnId: "isolated-turn-2"/);
  assert.match(interactionSpec, /托管内部新回合向下新增回复卡且不覆盖上一轮文字/);
  assert.match(interactionSpec, /expect\(positions\)\.toHaveLength\(2\)/);
});

test("允许项目命令默认建立信任且危险命令不进入持久信任", () => {
  assert.match(codexService, /trustedCommands\.isTrusted/);
  assert.match(codexService, /trustedCommands\.trust/);
  assert.match(ipc, /decision === "accept"/);
  assert.match(ipc, /trustResult\.trusted/);
  assert.match(developerApp, /允许并信任/);
  assert.match(developerApp, /clearTrustedCommands/);
});

test("AI Desktop 重建后恢复当前线程且用户新建任务时明确删除", () => {
  assert.match(codexService, /"thread\/resume"/);
  assert.match(codexService, /"thread\/delete"/);
  assert.match(codexService, /ephemeral: false/);
  assert.match(codexService, /developerInstructions/);
  assert.match(codexService, /官方硬删除未确认成功时保留本地恢复凭据/);
  assert.match(codexService, /恢复失败可能只是临时连接故障/);
  assert.match(codexSessionStore, /active thread|当前活动线程/);
  assert.match(developerApp, /getActiveCodexSession/);
  assert.match(developerApp, /ACTIVE_CHAT_STORAGE_KEY/);
  assert.match(developerApp, /只有官方确认删除后才清空页面/);
  assert.doesNotMatch(codexService, /text: `\$\{this\.#responseLanguage\(locale\)\}/);
});

test("AI Desktop 使用专属 Codex 数据域且只精准迁移已保存的旧活动线程", () => {
  assert.match(electronMain, /path\.join\(app\.getPath\("userData"\), "codex-home"\)/);
  assert.match(electronMain, /mkdirSync\(codexHome, \{ recursive: true \}\)/);
  assert.match(codexService, /childEnvironment\.CODEX_HOME = codexHome/);
  assert.match(codexService, /delete childEnvironment\.CODEX_INTERNAL_ORIGINATOR_OVERRIDE/);
  assert.match(codexService, /resolveCodexRuntime\(childEnvironment\)/);
  assert.match(codexService, /serviceName: this\.#options\.serviceName/);
  assert.match(codexService, /threadSource: this\.#options\.threadSource/);
  assert.match(codexService, /stored\.version !== 1/);
  assert.match(codexService, /#deleteStoredThread\("storage_domain_migration"\)/);
  assert.match(codexService, /不枚举默认 Codex 数据域/);
  assert.match(codexSessionStore, /version: 2/);
  assert.match(codexSessionStore, /storageDomain: "ai-desktop"/);
  assert.match(codexService, /text: `\$\{userTask\}\\n\\n\$\{workspaceContext\(workspaces\)\}`/);
  assert.doesNotMatch(codexService, /text: `\$\{workspaceContext\(workspaces\)\}\\n\\n\$\{userTask\}`/);
});

test("会话发送统一排队、显式补充并在重建后显示恢复操作", () => {
  assert.match(dispatchStore, /status === "running"/);
  assert.match(dispatchStore, /"recoverable"/);
  assert.match(dispatchStore, /dispatch\.queued/);
  assert.match(dispatchStore, /dispatch\.recovery_queued/);
  assert.match(codexService, /"turn\/steer"/);
  assert.match(codexService, /expectedTurnId: this\.#activeTurnId/);
  assert.match(ipc, /desktop:enqueue-message/);
  assert.match(ipc, /desktop:supplement-queued-message/);
  assert.match(ipc, /if \(dispatch\.state\(\)\.activeTask\)/);
  assert.match(developerApp, /补充到当前任务/);
  assert.match(developerApp, /继续执行/);
  assert.match(developerApp, /放弃任务/);
});

test("Harness 只使用指定版本的内置或校验下载 Codex 并公开实际来源", () => {
  assert.match(codexRuntime, /CODEX_TARGET_VERSION = "0\.149\.0"/);
  assert.match(codexRuntime, /source: "bundled" \| "downloaded"/);
  assert.match(codexRuntime, /registry\.npmjs\.org/);
  assert.match(codexRuntime, /archiveIntegrity/);
  assert.match(codexRuntime, /TeamIdentifier=/);
  assert.match(codexRuntime, /resolveBundledExecutable/);
  assert.match(codexRuntime, /installVerifiedRuntime/);
  assert.match(codexService, /resolveCodexRuntime\(childEnvironment\)/);
  assert.match(codexService, /harness_runtime_selected/);
  assert.match(developerApp, /codexStatus\.runtime\.version/);
  assert.match(developerApp, /codexStatus\.runtime\.source/);
  assert.doesNotMatch(developerApp, /codexStatus\.runtime\.path/);
  assert.doesNotMatch(codexRuntime, /displayPath/);
  assert.doesNotMatch(codexService, /path: runtime\.displayPath/);
});

test("开发版用安全 GFM Markdown 显示回答并通过主进程打开外链", () => {
  assert.match(markdownMessage, /ReactMarkdown/);
  assert.match(markdownMessage, /remarkGfm/);
  assert.match(markdownMessage, /skipHtml/);
  assert.match(markdownMessage, /openExternalUrl/);
  assert.match(ipc, /Only HTTP\(S\) links can be opened/);
  assert.match(codexService, /像体贴、可靠的协作伙伴/);
});
