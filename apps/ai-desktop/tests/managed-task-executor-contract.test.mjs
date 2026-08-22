import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const executor = readFileSync(new URL("../electron/services/managed-task-executor.ts", import.meta.url), "utf8");
const codexService = readFileSync(new URL("../electron/services/codex-service.ts", import.meta.url), "utf8");
const codexRuntime = readFileSync(new URL("../electron/services/codex-runtime.ts", import.meta.url), "utf8");
const codexSessionStore = readFileSync(new URL("../electron/services/codex-session-store.ts", import.meta.url), "utf8");
const ipc = readFileSync(new URL("../electron/ipc/register-desktop-ipc.ts", import.meta.url), "utf8");
const developerApp = readFileSync(new URL("../src/variants/developer/DeveloperApp.tsx", import.meta.url), "utf8");
const markdownMessage = readFileSync(new URL("../src/variants/developer/MarkdownMessage.tsx", import.meta.url), "utf8");
const audit = readFileSync(new URL("../electron/services/business-audit-log.ts", import.meta.url), "utf8");

test("任务托管只完成代码级验证并硬拦截构建启动", () => {
  assert.match(executor, /task-managed/);
  assert.match(executor, /codeValidationGate/);
  assert.match(executor, /任务要求修改源码，但未观察到文件变更/);
  assert.doesNotMatch(executor, /likelySourceChangeRequest/);
  assert.match(executor, /必须产生可追踪的源码变更/);
  assert.match(executor, /this\.#lastChange = this\.#sequence/);
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
  assert.match(executor, /只负责理解并复述用户意图/);
  assert.match(executor, /只负责只读调查原因、定位问题点并给出具体修正方案/);
  assert.match(codexService, /analysisOnly/);
  assert.match(ipc, /mode === "conversation-managed" \|\| mode === "requirement-managed" \? "read-only"/);
});

test("测试托管独立执行构建、构建后测试和至多一次受控重启", () => {
  assert.match(executor, /buildValidationGate/);
  assert.match(executor, /唯一共享的 apps\/ai-desktop\/测试文档\.md/);
  assert.match(executor, /npm run test:document/);
  assert.doesNotMatch(ipc, /function isTestManagedRequest/);
  assert.match(ipc, /app\.relaunch\(\); app\.exit\(0\)/);
  assert.equal((ipc.match(/app\.relaunch\(\)/g) || []).length, 1);
});

test("界面按四阶段确认推进，日志记录阶段结果而不强制构建", () => {
  assert.match(developerApp, /useState<ManagedExecutionMode>\("conversation-managed"\)/);
  assert.match(developerApp, /就是这意思/);
  assert.match(developerApp, /按这个方案执行/);
  assert.match(developerApp, /测试一下/);
  assert.match(developerApp, /重新分析需求/);
  assert.match(developerApp, /重新执行/);
  assert.match(developerApp, /重新测试/);
  assert.match(developerApp, /normalized === "1"/);
  assert.match(developerApp, /current === "conversation-managed" && normalized === "就是这意思"/);
  assert.match(developerApp, /current === "requirement-managed" && normalized === "按这个方案执行"/);
  assert.match(developerApp, /managed-stage-action/);
  assert.match(developerApp, /latestManagedAssistantId/);
  assert.match(developerApp, /disabled=\{!actionable \|\| message\.streaming\}/);
  assert.match(developerApp, /managed-execution-status/);
  assert.match(audit, /managedStatus/);
  assert.match(audit, /pendingActions/);
  assert.doesNotMatch(audit, /ai_desktop_source_changed_without_build/);
  assert.doesNotMatch(audit, /running_bundle_older_than_source/);
});

test("多轮托管保留上一轮回答并只校准当前轮完成文本", () => {
  assert.match(developerApp, /turnSegments\?: Record<string, string>/);
  assert.match(developerApp, /updateTurnSegment\(message, event\.turnId/);
  assert.match(developerApp, /message\.streamTerminal && event\.type !== "error"/);
  assert.match(codexService, /segmentId: `\$\{turnId\}:\$\{itemId\}`/);
  assert.match(developerApp, /text: item\.text \|\| response\.text/);
  assert.doesNotMatch(developerApp, /text: response\.text \|\| item\.text/);
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

test("每次连接选择与本机缓存协议匹配的 Codex 并公开实际来源", () => {
  assert.match(codexRuntime, /models_cache\.json/);
  assert.match(codexRuntime, /client_version/);
  assert.match(codexRuntime, /ChatGPT\.app\/Contents\/Resources\/codex/);
  assert.match(codexRuntime, /LOCALAPPDATA/);
  assert.match(codexRuntime, /AI_DESKTOP_CODEX_PATH/);
  assert.match(codexRuntime, /isSameCodexRelease/);
  assert.match(codexRuntime, /source: "bundled"/);
  assert.match(codexService, /resolveCodexRuntime\(\)/);
  assert.match(codexService, /harness_runtime_selected/);
  assert.match(developerApp, /codexStatus\.runtime\.version/);
  assert.match(developerApp, /codexStatus\.runtime\.path/);
});

test("开发版用安全 GFM Markdown 显示回答并通过主进程打开外链", () => {
  assert.match(markdownMessage, /ReactMarkdown/);
  assert.match(markdownMessage, /remarkGfm/);
  assert.match(markdownMessage, /skipHtml/);
  assert.match(markdownMessage, /openExternalUrl/);
  assert.match(ipc, /Only HTTP\(S\) links can be opened/);
  assert.match(codexService, /像体贴、可靠的协作伙伴/);
});
