import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function source(relativePath) {
  return readFileSync(path.join(appRoot, relativePath), "utf8");
}

function sourceFilesUnder(relativeRoot) {
  const collected = [];
  const visit = (relativeDirectory) => {
    for (const entry of readdirSync(path.join(appRoot, relativeDirectory), { withFileTypes: true })) {
      const relativePath = path.join(relativeDirectory, entry.name);
      if (entry.isDirectory()) visit(relativePath);
      else if (/\.(?:ts|tsx)$/u.test(entry.name)) collected.push(relativePath);
    }
  };
  visit(relativeRoot);
  return collected;
}

test("application-private contracts are domain modules outside shared", () => {
  assert.equal(existsSync(path.join(appRoot, "shared")), false);
  for (const contract of [
    "foundation/base.ts",
    "platform/workspace/workspace.ts",
    "platform/codex/codex-stream.ts",
    "capabilities/conversation/conversation.ts",
    "platform/codex/codex.ts",
    "platform/settings/settings.ts",
    "platform/attachments/screenshot.ts",
    "governance/audit.ts",
    "desktop/desktop-api.ts",
    "desktop/capability-registry.ts",
    "collaboration/evolution/dto/evolution-state.out.dto.ts",
    "capabilities/event-center/collaboration-memory.ts",
    "governance/workflow.ts",
    "capabilities/rules/rules.ts",
  ]) {
    assert.equal(existsSync(path.join(appRoot, "contracts", contract)), true, contract);
    assert.match(source(path.join("contracts", contract)), /生产者：|preload 向 Renderer/, `${contract} should explain ownership`);
  }
  assert.deepEqual(readdirSync(path.join(appRoot, "contracts")).filter((name) => name.endsWith(".ts")), []);
  assert.doesNotMatch(source("contracts/collaboration/workflow/index.ts"), /from ["']\.\/desktop(?:\.js)?["']/);
  assert.match(source("contracts/desktop/desktop.ts"), /export \* from "\.\/desktop-api\.js"/);
  assert.match(source("contracts/desktop/capability-registry.ts"), /keyof DesktopApi/);
  assert.match(source("contracts/desktop/capability-registry.ts"), /satisfies Record<string, readonly \(keyof DesktopCapabilityRegistry\)\[]>/);
  assert.match(source("electron/main.ts"), /desktop:evolution-workbench-changed/);
  assert.doesNotMatch(source("electron/main.ts"), /function buildEvolutionWorkbenchChange/);
  assert.match(source("electron/services/evolution/internal/evolution-workbench-change.assembler.ts"), /previousStateVersion:\s*previous\.updatedAt/);
  assert.match(source("src/features/evolution/components/EvolutionDatabaseGrid.tsx"), /onEvolutionWorkbenchChanged/);
  assert.match(source("src/features/evolution/components/EvolutionDatabaseGrid.tsx"), /visibilitychange/);
  assert.match(source("contracts/collaboration/evolution/index.ts"), /export \* from "\.\/dto\/evolution-state\.out\.dto\.js"/);
  assert.match(source("contracts/collaboration/evolution/dto/evolution-state.out.dto.ts"), /interface EvolutionWorkspaceLocation/);
  assert.match(source("electron/ipc/register-desktop-ipc.ts"), /normalizeEvolutionWorkspaceLocation/);
  assert.doesNotMatch(source("contracts/desktop/desktop-api.ts"), /onEvolutionWorkspacePerspective|openEvolutionWorkspace\(perspective/);
  assert.match(source("src/features/evolution/components/EvolutionDatabaseGrid.tsx"), /requestedLocation.*onLocationChange/);
  assert.match(source("src/features/nangong/components/NangongEvolutionRail.tsx"), /dispatchEvolutionProposal\([^\n]+evolutionMutationRequest\(state\)\)/);
  assert.match(source("src/features/evolution/model/evolution-workbench.ts"), /expectedStateVersion:\s*state\.updatedAt/);
  assert.match(source("electron/services/workflow/internal/workflow.repository.ts"), /evolution\.mutation/);
  const mutationCoordinator = source("electron/services/evolution/internal/evolution-mutation.coordinator.ts");
  assert.match(mutationCoordinator, /class EvolutionMutationCoordinator/);
  assert.match(mutationCoordinator, /runAsync/);
  assert.match(source("electron/services/workflow/internal/persona-evolution.runtime.ts"), /#mutations\.run\(/);
  assert.doesNotMatch(source("electron/services/personas/nangong/nangong.facade.ts"), /decideProposal|autoApprove|generateAcceptancePlan|#mutations/);
  assert.doesNotMatch(source("electron/services/personas/hanli/hanli.facade.ts"), /sendConversationMessage|createProposal|resumeOneShotRun/);
  assert.doesNotMatch(source("electron/services/evolution/internal/evolution-state.store.ts"), /automaticApprovalEnabled|raw\.version === [1-7]/);
  assert.doesNotMatch(source("electron/services/evolution/internal/evolution-state.store.ts"), /node:fs|readFileSync|writeFileSync|renameSync/);
  assert.match(source("electron/main.ts"), /createEvolutionState\(aiMemoryDatabase\)/);
  assert.doesNotMatch(source("electron/main.ts"), /new NangongEvolutionStore\(path\.join\([^\n]+nangong-evolution\.json/);
  assert.match(source("src/features/hanli/components/HanLiEvolutionApprovalPanel.tsx"), /decideEvolutionProposal\([^\n]+mutation:\s*evolutionMutationRequest\(state\)/);
  assert.match(source("src/features/hanli/components/HanLiEvolutionApprovalPanel.tsx"), /decideEvolutionResult\([^\n]+mutation:\s*evolutionMutationRequest\(state\)/);
  assert.match(source("src/features/evolution/components/EvolutionRevisionPanels.tsx"), /reviseEvolutionProposal\([^\n]+mutation:\s*evolutionMutationRequest\(state\)/);
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

test("Nangong memory keeps internal intent without rendering it as user-authored text", () => {
  const memory = source("electron/services/capabilities/event-center/internal/projection/collaboration-memory.service.ts");
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
  assert.match(main, /不要复述、改写或冒充用户原话/);
  assert.match(main, /NANGONG_TOPIC_META=.*userIntent/);
  assert.doesNotMatch(app, /nangong-intent-summary|我了解到您的想法是/);
});

test("人物训练语料通过主会话完成钩子和启动补录闭环且清空只重置内部线程", () => {
  const main = source("electron/main.ts");
  const codexService = source("electron/services/platform/codex/codex.facade.ts");
  const ingestion = source("electron/services/capabilities/event-center/internal/corpus/codex-conversation-corpus.ingestion.ts");
  const repository = source("electron/services/workflow/internal/workflow.repository.ts");
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
  assert.doesNotMatch(main, /linghuDistributionAuditCodex|ai-desktop-linghu-distribution-audit/);
  const semanticBackfill = source("electron/services/capabilities/event-center/internal/corpus/codex-conversation-semantic-backfill.ts");
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
  const ingestion = source("electron/services/capabilities/event-center/internal/corpus/codex-conversation-corpus.ingestion.ts");
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
  assert.match(developerApp, /features\/evolution\/components\/EvolutionRevisionPanels/);
  assert.match(developerApp, /features\/evolution\/components\/EvolutionControlWorkspace/);
  const controlWorkspace = source("src/features/evolution/components/EvolutionControlWorkspace.tsx");
  assert.match(controlWorkspace, /EvolutionTreeNavigation/);
  assert.match(controlWorkspace, /EvolutionDatabaseGrid/);
  assert.match(controlWorkspace, /HanLiEvolutionApprovalPanel/);
  assert.match(controlWorkspace, /NangongEvolutionRail/);
  assert.match(controlWorkspace, /evolution-workbench/);
  const nangongRail = source("src/features/nangong/components/NangongEvolutionRail.tsx");
  assert.match(nangongRail, /EvolutionProposalGrid/);
  assert.match(nangongRail, /EvolutionProposalDetail/);
  assert.match(nangongRail, /EvolutionTopicDossierView/);
  assert.match(nangongRail, /MemberSelfUpgradePanel/);
  assert.doesNotMatch(developerApp, /function EvolutionProposalGrid/);
  assert.doesNotMatch(developerApp, /function EvolutionDatabaseGrid/);
  assert.doesNotMatch(developerApp, /function EvolutionProposalDetail|function EvolutionTopicDossierView|function HanLiEvolutionApprovalPanel/);
  assert.doesNotMatch(developerApp, /function MemberSelfUpgradePanel|function LinghuRepairProposalPanel/);
  assert.doesNotMatch(developerApp, /function LinghuAutomationPanel|function linghuModuleLabel/);
  assert.match(developerApp, /features\/linghu/);
  assert.equal(existsSync(path.join(appRoot, "src/features/linghu/index.ts")), true);
  assert.equal(existsSync(path.join(appRoot, "electron/services/personas/linghu/index.ts")), true);
  assert.equal(existsSync(path.join(appRoot, "electron/services/personas/linghu/linghu-automation.facade.ts")), true);
  for (const internalFile of [
    "create-linghu-runtime.ts",
    "linghu-automation.store.ts",
    "linghu-flow.analyzer.ts",
  ]) {
    assert.equal(existsSync(path.join(appRoot, "electron/services/personas/linghu/internal", internalFile)), true, internalFile);
  }
  assert.equal(existsSync(path.join(appRoot, "electron/services/capabilities/testing/internal/fixed-unified-test.runner.ts")), true);
  for (const legacyRootFile of ["automation-facade.ts", "automation-store.ts", "create-runtime.ts", "flow-analysis.ts", "unified-test-runner.ts"]) {
    assert.equal(existsSync(path.join(appRoot, "electron/services/personas/linghu", legacyRootFile)), false, legacyRootFile);
  }
  for (const sourceRoot of ["electron", "src"]) {
    for (const sourceFile of sourceFilesUnder(sourceRoot)) {
      if (sourceFile.startsWith(path.join("electron", "services", "personas", "linghu"))) continue;
      assert.doesNotMatch(source(sourceFile), /services\/collaboration\/linghu\/(?:internal|linghu-automation\.facade)/u, `${sourceFile} must use the Linghu service facade index`);
    }
  }
  const linghuServiceIndex = source("electron/services/personas/linghu/index.ts");
  assert.match(linghuServiceIndex, /LinghuAutomationFacade/);
  assert.match(linghuServiceIndex, /createLinghuRuntime/);
  assert.doesNotMatch(linghuServiceIndex, /LinghuAutomationStore|LinghuUnifiedTestRunner|UnifiedTestInfrastructureError|DEFAULT_LINGHU_STARTUP_PROMPT|LINGHU_AUTOMATION_MODULES/);
  const linghuFacadeSource = source("electron/services/personas/linghu/linghu-automation.facade.ts");
  assert.match(linghuFacadeSource, /interface LinghuCollaborationPort/);
  assert.doesNotMatch(linghuFacadeSource, /import \{ CollaborationCoordinator \}/);
  const electronMainSource = source("electron/main.ts");
  assert.doesNotMatch(electronMainSource, /LinghuAutomationStore|LinghuUnifiedTestRunner|linghuRuntime\.store/);
  assert.match(electronMainSource, /linghuRuntime!\.runUnifiedTests/);
  assert.equal(existsSync(path.join(appRoot, "contracts/collaboration/linghu/index.ts")), true);
  const linghuDtoContracts = new Map([
    ["create-startup-prompt.in.dto.ts", ["CreateLinghuStartupPromptInDto"]],
    ["update-startup-prompt.in.dto.ts", ["UpdateLinghuStartupPromptInDto"]],
    ["startup-prompt.out.dto.ts", ["LinghuStartupPromptOutDto"]],
    ["repair-proposal.out.dto.ts", ["CreateLinghuRepairProposalOutDto"]],
    ["automation-state-event.out.dto.ts", ["LinghuAutomationStateEventOutDto"]],
    ["automation-state.out.dto.ts", [
      "LinghuAutomationModuleOutDto",
      "LinghuAutomationFeedbackOutDto",
      "LinghuFlowHealthOutDto",
      "LinghuBlockingKindOutDto",
      "LinghuAutomaticFlowSnapshotOutDto",
      "LinghuModuleCompletionReportOutDto",
      "LinghuAutomationStateOutDto",
    ]],
  ]);
  for (const [dtoFile, expectedTypeNames] of linghuDtoContracts) {
    const relativePath = path.join("contracts/collaboration/linghu/dto", dtoFile);
    assert.equal(existsSync(path.join(appRoot, relativePath)), true, relativePath);
    const dtoSource = source(relativePath);
    const exportedTypeNames = [...dtoSource.matchAll(/export (?:interface|type) (\w+)/gu)].map((match) => match[1]);
    assert.deepEqual(exportedTypeNames, expectedTypeNames, `${dtoFile} must expose its registered directional DTOs`);
    const expectedSuffix = dtoFile.includes(".in.dto.ts") ? "InDto" : "OutDto";
    assert.ok(exportedTypeNames.every((name) => name.endsWith(expectedSuffix)), `${dtoFile} exports must use the ${expectedSuffix} suffix`);
    for (const requiredCommentLabel of ["DTO 方向：", "数据生产方：", "数据接收方：", "数据流向：", "禁止职责："]) {
      assert.ok(dtoSource.includes(requiredCommentLabel), `${dtoFile} must explain ${requiredCommentLabel}`);
    }
  }
  const linghuContractIndex = source("contracts/collaboration/linghu/index.ts");
  for (const dtoFile of linghuDtoContracts.keys()) {
    assert.ok(linghuContractIndex.includes(`./dto/${dtoFile.replace(/\.ts$/u, ".js")}`), `${dtoFile} must be exported by the Linghu facade`);
  }
  for (const legacyDtoFile of ["automation-state.dto.ts", "startup-prompt.dto.ts", "repair-proposal.dto.ts", "automation-event.dto.ts"]) {
    assert.equal(existsSync(path.join(appRoot, "contracts/collaboration/linghu/dto", legacyDtoFile)), false, legacyDtoFile);
  }
  assert.equal(existsSync(path.join(appRoot, "contracts/collaboration/linghu/automation.ts")), false);
  for (const sourceRoot of ["contracts", "electron", "src"]) {
    for (const sourceFile of sourceFilesUnder(sourceRoot)) {
      if (sourceFile.startsWith(path.join("contracts", "collaboration", "linghu"))) continue;
      assert.doesNotMatch(source(sourceFile), /collaboration\/linghu\/dto\//u, `${sourceFile} must use the Linghu contract facade`);
    }
  }
  assert.equal(existsSync(path.join(appRoot, "electron/services/collaboration/linghu-automation-facade.ts")), false);
  assert.equal(existsSync(path.join(appRoot, "electron/services/collaboration/linghu-automation-store.ts")), false);
  assert.equal(existsSync(path.join(appRoot, "electron/services/collaboration/linghu-unified-test-runner.ts")), false);
  assert.equal(existsSync(path.join(appRoot, "contracts/collaboration/linghu-automation.ts")), false);
  assert.doesNotMatch(developerApp, /function NangongEvolutionRail/);
  assert.doesNotMatch(developerApp, /function EvolutionControlWorkspace|function EvolutionModuleOverview|function EvolutionPeopleSummary/);
  assert.doesNotMatch(developerApp, /const EVOLUTION_STATUS_LABELS/);
  assert.equal(existsSync(path.join(appRoot, "src/features/screenshot/geometry/annotation-geometry.ts")), true);
  assert.equal(existsSync(path.join(appRoot, "src/features/screenshot/canvas/annotation-renderer.ts")), true);
});

test("main-process orchestration delegates IPC and pure collaboration parsing", () => {
  const ipcSource = source("electron/ipc/register-desktop-ipc.ts");
  assert.match(ipcSource, /registerSettingsIpc\(/);
  assert.match(ipcSource, /registerWorkspaceIpc\(/);
  assert.match(ipcSource, /registerCollaborationIpc\(/);
  assert.match(ipcSource, /registerRulesIpc\(/);
  assert.match(source("electron/services/platform/codex/codex.facade.ts"), /internal\/codex-stream-event\.mapper/);
  assert.doesNotMatch(source("electron/services/capabilities/conversation/internal/collaboration-codex-sessions.ts"), /review-decision-parser|CodexReviewerSession/);
  assert.match(source("electron/services/workflow/collaboration-workflow.facade.ts"), /result\/result-summary/);
  assert.match(source("electron/ipc/domains/register-collaboration-ipc.ts"), /NangongFacade/);
  assert.match(source("electron/ipc/domains/register-collaboration-ipc.ts"), /HanliFacade/);
  assert.match(source("electron/ipc/domains/register-collaboration-ipc.ts"), /EvolutionFacade/);
  assert.match(source("electron/ipc/domains/register-collaboration-ipc.ts"), /PersonaWorkflowFacade/);
  assert.match(source("electron/services/workflow/internal/evolution-task-distribution.service.ts"), /evolutionProposalId/);
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

test("公共能力五区只通过唯一 index 交叉协作且旧路径归零", () => {
  const serviceModules = [
    "personas/nangong",
    "personas/hanli",
    "personas/linghu",
    "evolution",
    "workflow",
    "capabilities/conversation",
    "capabilities/execution",
    "capabilities/event-center",
    "capabilities/testing",
    "capabilities/release",
    "capabilities/rules",
    "platform/codex",
    "platform/persistence",
    "platform/workspace",
    "platform/settings",
    "platform/security",
    "platform/attachments",
  ];
  for (const moduleRoot of serviceModules) {
    const indexPath = path.join("electron/services", moduleRoot, "index.ts");
    assert.equal(existsSync(path.join(appRoot, indexPath)), true, `${moduleRoot} 必须有唯一公开 index.ts`);
    assert.match(source(indexPath), /[\u3400-\u9fff]/u, `${moduleRoot} 的公开入口必须包含新手可读业务注释`);
  }

  const rootServiceFiles = readdirSync(path.join(appRoot, "electron/services"), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"));
  assert.deepEqual(rootServiceFiles, [], "electron/services 根层不得平铺具体 Service");

  // 解析相对导入的真实目标；只有模块自身文件可以引用自己的 internal。
  for (const sourceFile of sourceFilesUnder("electron")) {
    const text = source(sourceFile);
    for (const match of text.matchAll(/from\s+["']([^"']+)["']/gu)) {
      const specifier = match[1];
      if (!specifier.startsWith(".")) continue;
      const target = path.normalize(path.join(path.dirname(sourceFile), specifier.replace(/\.js$/u, ".ts")));
      const internalMarker = `${path.sep}internal${path.sep}`;
      if (!target.includes(internalMarker)) continue;
      const ownerRoot = target.slice(0, target.indexOf(internalMarker));
      assert.ok(sourceFile === ownerRoot || sourceFile.startsWith(`${ownerRoot}${path.sep}`), `${sourceFile} 不得直接导入其他模块 internal：${specifier}`);
    }
  }

  for (const sourceFile of sourceFilesUnder("electron/services/platform")) {
    assert.doesNotMatch(source(sourceFile), /(?:services\/|\.\.\/)+(?:personas|workflow|evolution|capabilities)\//u, `${sourceFile} 的 Platform 不能反向依赖上层`);
  }
  for (const sourceFile of sourceFilesUnder("electron/services/personas")) {
    assert.doesNotMatch(source(sourceFile), /from ["']node:(?:fs|child_process|sqlite)["']/u, `${sourceFile} 的人物业务不能直接操作文件、子进程或 SQLite`);
  }

  for (const oldRoot of ["codex", "collaboration", "event-center", "rules"]) {
    assert.equal(existsSync(path.join(appRoot, "electron/services", oldRoot)), false, `旧服务目录必须删除：${oldRoot}`);
  }
  assert.equal(existsSync(path.join(appRoot, "contracts/codex")), false, "旧 Codex Contracts 目录必须删除");
  assert.doesNotMatch(source("src/variants/developer/DeveloperApp.tsx"), /electron\/services|ipcRenderer/u);
});

test("南宫韩立令狐以并列人物模块接入中立 Evolution 与 Workflow", () => {
  // 三个人物必须各自拥有唯一公开入口、门面和可启动运行时。
  for (const [persona, facadeName, memberId] of [
    ["nangong", "NangongFacade", "nangong-wan"],
    ["hanli", "HanliFacade", "han-li"],
    ["linghu", "LinghuAutomationFacade", "linghu-ancestor"],
  ]) {
    const personaRoot = `electron/services/personas/${persona}`;
    assert.equal(existsSync(path.join(appRoot, personaRoot, "index.ts")), true);
    assert.match(source(`${personaRoot}/index.ts`), new RegExp(facadeName));
    assert.match(sourceFilesUnder(personaRoot).map(source).join("\n"), new RegExp(memberId));
  }

  // 人物不得越过公开入口读取另一个人物的实现目录。
  for (const persona of ["nangong", "hanli", "linghu"]) {
    for (const file of sourceFilesUnder(`electron/services/personas/${persona}`)) {
      assert.doesNotMatch(source(file), /personas\/(?:nangong|hanli|linghu)\/internal/u, `${file} 不得依赖其他人物 internal`);
    }
  }

  const registry = source("electron/services/workflow/internal/persona-capability.registry.ts");
  assert.match(registry, /class PersonaCapabilityRegistry/);
  assert.match(registry, /requireCapability/);
  const personaWorkflow = source("electron/services/workflow/internal/persona-evolution.runtime.ts");
  assert.doesNotMatch(personaWorkflow, /你是韩立|parseHanLiQuestion|parseHanLiJudgment/);
  assert.match(source("electron/services/personas/hanli/internal/hanli-deliberation.service.ts"), /你是韩立/);
  const main = source("electron/main.ts");
  for (const runtimeName of ["nangongRuntime", "hanliRuntime", "linghuRuntime"]) {
    assert.match(main, new RegExp(`personaRegistry\\.register\\(\\{ memberId: ${runtimeName}\\.memberId`));
  }

  // Contracts 按人物、共享事实、流程以及输入输出方向分层。
  for (const contract of [
    "contracts/collaboration/nangong/dto/nangong-command.in.dto.ts",
    "contracts/collaboration/nangong/dto/nangong-result.out.dto.ts",
    "contracts/collaboration/hanli/dto/hanli-decision.in.dto.ts",
    "contracts/collaboration/hanli/dto/hanli-acceptance.out.dto.ts",
    "contracts/collaboration/evolution/dto/evolution-state.out.dto.ts",
    "contracts/collaboration/workflow/dto/persona-workflow.in.dto.ts",
    "contracts/collaboration/workflow/port/persona-capability.port.ts",
  ]) assert.equal(existsSync(path.join(appRoot, contract)), true, contract);

  // 人物页面已离开共享 Evolution 组件目录，共享工作区只从人物 index 组合它们。
  assert.equal(existsSync(path.join(appRoot, "src/features/nangong/components/NangongEvolutionRail.tsx")), true);
  assert.equal(existsSync(path.join(appRoot, "src/features/hanli/components/HanLiEvolutionApprovalPanel.tsx")), true);
  assert.equal(existsSync(path.join(appRoot, "src/features/evolution/components/NangongEvolutionRail.tsx")), false);
  assert.equal(existsSync(path.join(appRoot, "src/features/evolution/components/HanLiEvolutionApprovalPanel.tsx")), false);
  assert.match(source("src/features/evolution/components/EvolutionControlWorkspace.tsx"), /from "\.\.\/\.\.\/nangong"/);
  assert.match(source("src/features/evolution/components/EvolutionControlWorkspace.tsx"), /from "\.\.\/\.\.\/hanli"/);

  // 旧混合命名和旧平铺契约必须在完成阶段消失。
  assert.equal(existsSync(path.join(appRoot, "contracts/collaboration/evolution/nangong-evolution.ts")), false);
  assert.equal(existsSync(path.join(appRoot, "electron/services/personas/nangong/internal/nangong-evolution.facade.ts")), false);
  for (const publicIndex of [
    "electron/services/personas/nangong/index.ts",
    "electron/services/personas/hanli/index.ts",
    "electron/services/personas/linghu/index.ts",
  ]) {
    const executableExports = source(publicIndex).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gmu, "");
    assert.doesNotMatch(executableExports, /(?:Store|Runner|Repository|DEFAULT_)/u, `${publicIndex} 不得公开内部实现`);
  }
});
