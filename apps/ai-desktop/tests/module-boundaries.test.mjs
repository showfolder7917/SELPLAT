import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function source(relativePath) {
  return readFileSync(path.join(appRoot, relativePath), "utf8");
}

test("application-private contracts are domain modules outside shared", () => {
  assert.equal(existsSync(path.join(appRoot, "shared")), false);
  for (const contract of [
    "foundation/base.ts",
    "desktop/workspace.ts",
    "codex/codex-stream.ts",
    "codex/conversation.ts",
    "codex/codex.ts",
    "desktop/settings.ts",
    "desktop/screenshot.ts",
    "governance/audit.ts",
    "desktop/desktop-api.ts",
    "desktop/capability-registry.ts",
    "collaboration/nangong-evolution.ts",
    "collaboration/collaboration-memory.ts",
    "governance/workflow.ts",
    "governance/rules.ts",
  ]) {
    assert.equal(existsSync(path.join(appRoot, "contracts", contract)), true, contract);
    assert.match(source(path.join("contracts", contract)), /生产者：|preload 向 Renderer/, `${contract} should explain ownership`);
  }
  assert.deepEqual(readdirSync(path.join(appRoot, "contracts")).filter((name) => name.endsWith(".ts")), []);
  assert.doesNotMatch(source("contracts/collaboration/collaboration.ts"), /from ["']\.\/desktop(?:\.js)?["']/);
  assert.match(source("contracts/desktop/desktop.ts"), /export \* from "\.\/desktop-api\.js"/);
  assert.match(source("contracts/desktop/capability-registry.ts"), /keyof DesktopApi/);
  assert.match(source("contracts/desktop/capability-registry.ts"), /satisfies Record<string, readonly \(keyof DesktopCapabilityRegistry\)\[]>/);
  const apiMethods = [...source("contracts/desktop/desktop-api.ts").matchAll(/^\s{2}(\w+)\(/gm)].map((match) => match[1]);
  const registryBody = source("contracts/desktop/capability-registry.ts").split("export const DESKTOP_CAPABILITY_DOMAINS", 2)[1];
  const registeredMethods = [...registryBody.matchAll(/"(\w+)"/g)].map((match) => match[1]);
  assert.deepEqual(new Set(registeredMethods).size, registeredMethods.length, "capability IDs must not repeat across domains");
  assert.deepEqual([...registeredMethods].sort(), [...apiMethods].sort(), "every DesktopApi method must belong to one capability domain");
  const bridgeMethods = ["system", "rule", "codex", "screenshot", "collaboration", "conversation"]
    .flatMap((domain) => [...source(`electron/preload/domains/${domain}-bridge.cts`).matchAll(/^\s{4}(\w+):/gm)].map((match) => match[1]));
  assert.deepEqual(new Set(bridgeMethods).size, bridgeMethods.length, "preload methods must not repeat across domain bridges");
  assert.deepEqual([...bridgeMethods].sort(), [...apiMethods].sort(), "preload must expose every registered DesktopApi method exactly once");
});

test("all Electron IPC domains and renderer failures use the unified event boundary", () => {
  const helper = source("electron/ipc/event-center-ipc.ts");
  const desktopIpc = source("electron/ipc/register-desktop-ipc.ts");
  for (const domain of [
    "electron/ipc/domains/register-collaboration-ipc.ts",
    "electron/ipc/domains/register-settings-ipc.ts",
    "electron/ipc/domains/register-workspace-ipc.ts",
    "electron/ipc/domains/register-rules-ipc.ts",
    "electron/ipc/domains/register-codex-ipc.ts",
    "electron/ipc/domains/register-system-ipc.ts",
  ]) assert.match(source(domain), /registerEventCenterIpcHandler/);
  assert.match(helper, /ipcMain\.handle\(channel/);
  assert.doesNotMatch(desktopIpc, /ipcMain\.handle\(/);
  assert.match(desktopIpc, /desktop:renderer-exception/);
  assert.match(source("src/main.tsx"), /unhandledrejection/);
  assert.match(source("src/main.tsx"), /RendererErrorBoundary/);
  assert.match(source("electron/preload/domains/system-bridge.cts"), /reportRendererException/);
  for (const bridge of ["system", "rule", "codex", "screenshot", "collaboration", "conversation"]) {
    assert.match(source("electron/preload.cts"), new RegExp(`${bridge}Bridge\\(\\)`));
  }
});

test("sandboxed preload keeps domain source boundaries but builds one physical bridge", () => {
  const manifest = JSON.parse(source("package.json"));
  const preloadBuilder = source("scripts/build-sandboxed-preload.mjs");
  const mainWindow = source("electron/window/create-main-window.ts");
  const rendererEntry = source("src/main.tsx");
  assert.match(manifest.scripts["build:electron"], /build-sandboxed-preload\.mjs/);
  assert.match(preloadBuilder, /bundle:\s*true/);
  assert.match(preloadBuilder, /external:\s*\["electron"\]/);
  assert.match(mainWindow, /sandbox:\s*true/);
  assert.match(rendererEntry, /AI Desktop 桌面桥接加载失败/);
  assert.doesNotMatch(source("tests/interaction/isolated-preload.cjs"), /require\(["']node:path["']\)/);
  assert.match(source("tests/interaction/isolated-main.cjs"), /sandbox:\s*true/);
});

test("Nangong memory keeps source, preview, free topic semantics and visible user intent", () => {
  const memory = source("electron/services/event-center/collaboration-memory-service.ts");
  const migration = source("db/sql/schema-AiDesktopCurrent.sql");
  const corpusMigration = source("db/sql/schema-AiDesktopCurrent.sql");
  const main = source("electron/main.ts");
  const app = source("src/variants/developer/DeveloperApp.tsx");
  assert.match(migration, /content TEXT NOT NULL/);
  assert.match(migration, /contentPreview TEXT NOT NULL/);
  assert.match(migration, /inferredIntent TEXT/);
  assert.match(migration, /topicType TEXT NOT NULL/);
  assert.match(corpusMigration, /AiDesktopTrainingCorpusTopic/);
  assert.match(corpusMigration, /AiDesktopTrainingCorpusMessage/);
  assert.doesNotMatch(corpusMigration, /AiDesktopConversationArchiveMessage/);
  assert.match(corpusMigration, /contentRetention IN \('exact', 'preview-300'\)/);
  assert.match(memory, /characters\.slice\(0, 80\)/);
  assert.match(memory, /AI登记的用户意图/);
  assert.match(main, /我了解到您的想法是/);
  assert.match(main, /NANGONG_TOPIC_META=.*userIntent/);
  assert.match(app, /我了解到您的想法是/);
});

test("人物训练语料通过主会话完成钩子和启动补录闭环且清空只重置内部线程", () => {
  const main = source("electron/main.ts");
  const codexService = source("electron/services/codex-service.ts");
  const ingestion = source("electron/services/event-center/codex-conversation-corpus-ingestion.ts");
  const repository = source("electron/services/event-center/workflow-repository.ts");
  assert.match(main, /ingestTrainingCorpus\("startup"\)/);
  assert.match(main, /onConversationTurnCompleted:\s*\(\) => ingestTrainingCorpus\("turn-completed"\)/);
  assert.match(codexService, /await this\.#options\.onConversationTurnCompleted\?\.\(\)/);
  assert.match(ingestion, /eligibleThreadSources:\s*policy\.eligibleThreadSources \|\| \["ai-desktop"\]/);
  assert.match(ingestion, /AiDesktopCorpusIngestionCheckpoint/);
  assert.match(ingestion, /SELPLAT_CORPUS_META/);
  assert.match(ingestion, /contentRetention:\s*"preview-300"/);
  assert.doesNotMatch(ingestion, /classifyUserMessage/);
  assert.match(main, /CodexConversationCorpusWatcher/);
  assert.match(main, /requiredWorkspaceRoot:\s*projectRoot/);
  assert.match(main, /requiredOriginator:\s*"codex_work_desktop"/);
  assert.match(main, /requireCompletedTurns:\s*true/);
  assert.match(main, /codexAppCorpusIngestionEnabled/);
  assert.match(main, /ingestPendingRolloutsIncrementally/);
  assert.match(main, /corpusIngestionRunning/);
  assert.match(ingestion, /task_complete/);
  assert.match(ingestion, /setImmediate/);
  assert.match(ingestion, /watch\(root, \{ recursive: true \}/);
  assert.match(main, /Promise\.all\(\[hanLiCodex, nangongDeliberationCodex, nangongDistributionCodex, linghuDistributionAuditCodex\]/);
  const semanticBackfill = source("electron/services/event-center/codex-conversation-semantic-backfill.ts");
  assert.match(semanticBackfill, /phase\) === "final_answer"/);
  assert.match(semanticBackfill, /task_complete/);
  assert.match(semanticBackfill, /preview-300/);
  assert.match(semanticBackfill, /ON CONFLICT\(source, sourceMessageId\) DO NOTHING/);
  assert.doesNotMatch(semanticBackfill, /AiDesktop(?:Approval|Workflow|Task|Event|Evolution)/);
  assert.match(main, /ai-desktop-corpus-semantic-backfill/);
  assert.doesNotMatch(main, /Promise\.all\(\[(?:[^\]]*codex|[^\]]*nangongCodex)[^\]]*\]\.map\(\(service\) => service!\.newChat\(\)\)\)/);
  assert.doesNotMatch(repository.match(/const tables = \[([\s\S]*?)\] as const/)?.[1] || "", /Conversation|CorpusIngestionCheckpoint/);
});

test("统一对话语料不吸收专题审批任务测试与异常业务投影", () => {
  const packageJson = source("package.json");
  const corpusMigration = source("db/sql/schema-AiDesktopCurrent.sql");
  const ingestion = source("electron/services/event-center/codex-conversation-corpus-ingestion.ts");
  assert.doesNotMatch(packageJson, /backfill:codex-conversation/);
  assert.doesNotMatch(packageJson, /backfill-codex-conversation\.mjs/);
  assert.doesNotMatch(corpusMigration, /FROM AiDesktop(?:Approval|Workflow|Task|Event|Evolution)/);
  assert.doesNotMatch(ingestion, /AiDesktop(?:Approval|Workflow|Task|Event|Evolution)/);
  assert.match(corpusMigration, /CREATE TABLE AiDesktopConversationMemory/);
  assert.doesNotMatch(corpusMigration, /AiDesktopConversationArchiveMessage|preview-80|legacy:/);
});

test("renderer feature logic is no longer owned by the developer shell", () => {
  const developerApp = source("src/variants/developer/DeveloperApp.tsx");
  assert.doesNotMatch(developerApp, /function applyCodexStreamEvent/);
  assert.doesNotMatch(developerApp, /function readStoredChat/);
  assert.match(developerApp, /features\/conversation\/model\/chat-message/);
  assert.match(developerApp, /features\/collaboration\/model\/collaboration-task-progress/);
  assert.match(developerApp, /features\/settings\/components\/SettingsFloatingPanel/);
  assert.match(developerApp, /features\/evolution\/components\/EvolutionTreeNavigation/);
  assert.equal(existsSync(path.join(appRoot, "src/features/screenshot/geometry/annotation-geometry.ts")), true);
  assert.equal(existsSync(path.join(appRoot, "src/features/screenshot/canvas/annotation-renderer.ts")), true);
});

test("main-process orchestration delegates IPC and pure collaboration parsing", () => {
  const ipcSource = source("electron/ipc/register-desktop-ipc.ts");
  assert.match(ipcSource, /registerSettingsIpc\(/);
  assert.match(ipcSource, /registerWorkspaceIpc\(/);
  assert.match(ipcSource, /registerCollaborationIpc\(/);
  assert.match(ipcSource, /registerRulesIpc\(/);
  assert.match(source("electron/services/codex-service.ts"), /codex\/stream-event-mapper/);
  assert.match(source("electron/services/collaboration/collaboration-codex-sessions.ts"), /review\/review-decision-parser/);
  assert.match(source("electron/services/collaboration/collaboration-coordinator.ts"), /result\/result-summary/);
  assert.match(source("electron/ipc/domains/register-collaboration-ipc.ts"), /NangongEvolutionFacade/);
  assert.match(source("electron/services/collaboration/nangong-evolution-facade.ts"), /evolutionProposalId/);
});

test("customer package config excludes build-machine roots and carries external rule resources", () => {
  const customerConfig = source("electron-builder.customer.config.cjs");
  const builderManifest = JSON.parse(source("electron-builder.developer.json"));
  assert.doesNotMatch(customerConfig, /selplatDevelopmentRoot\s*:/);
  assert.match(customerConfig, /package\/customer/);
  assert.ok(builderManifest.extraResources.some((resource) => resource.to === "ruleengine"));
  assert.match(source("electron/config/app-config.ts"), /userData"\), "workspace"/);
  assert.match(source("electron/main.ts"), /process\.resourcesPath, "ruleengine"/);
});
