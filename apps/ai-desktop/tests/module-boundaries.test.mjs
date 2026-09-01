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

test("contracts mirror Electron ownership and expose explicit protocol roles", () => {
  const contractRoots = readdirSync(path.join(appRoot, "contracts"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && sourceFilesUnder(path.join("contracts", entry.name)).length > 0)
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(contractRoots, ["foundation", "governance", "services", "system"]);
  for (const mirroredOwner of [
    "personas/nangong", "personas/hanli", "personas/linghu", "personas/executor",
    "evolution", "workflow", "support/application", "support/capabilities", "support/platform",
  ]) {
    assert.equal(existsSync(path.join(appRoot, "contracts/services", mirroredOwner)), true, mirroredOwner);
    assert.equal(existsSync(path.join(appRoot, "electron/services", mirroredOwner)), true, mirroredOwner);
  }
  const contractSources = sourceFilesUnder("contracts");
  for (const file of contractSources) assert.doesNotMatch(source(file), /export(?: type)? \*/u, file);
  assert.equal(existsSync(path.join(appRoot, "contracts/services/workflow/port/persona-capability.port.ts")), false);
  assert.equal(existsSync(path.join(appRoot, "contracts/services/workflow/value/persona-capability.value.ts")), true);
  assert.match(source("contracts/services/workflow/port/persona-runtime.port.ts"), /\w+\([^)]*\)\s*:/u);
});

test("application-private contracts are domain modules outside shared", () => {
  assert.equal(existsSync(path.join(appRoot, "shared")), false);
  for (const contract of [
    "foundation/value/base.value.ts",
    "services/support/platform/workspace/dto/workspace.out.dto.ts",
    "services/support/platform/codex/dto/codex-stream.event.out.dto.ts",
    "services/support/platform/codex/dto/codex.out.dto.ts",
    "services/support/platform/settings/dto/settings.out.dto.ts",
    "services/evolution/dto/evolution-state.out.dto.ts",
  ]) {
    assert.equal(existsSync(path.join(appRoot, "contracts", contract)), true, contract);
    assert.match(source(path.join("contracts", contract)), /生产者：|preload 向 Renderer/, `${contract} should explain ownership`);
  }
  assert.deepEqual(readdirSync(path.join(appRoot, "contracts")).filter((name) => name.endsWith(".ts")), []);
  assert.equal(existsSync(path.join(appRoot, "ARCHITECTURE.md")), true);
  assert.doesNotMatch(source("contracts/services/workflow/index.ts"), /from ["']\.\/desktop(?:\.js)?["']/);
  assert.match(source("contracts/system/desktop/index.ts"), /export type \{ DesktopApi \} from "\.\/api\/desktop\.api\.js"/);
  assert.match(source("contracts/system/desktop/value/desktop-capability-registry.value.ts"), /keyof DesktopApi/);
  assert.match(source("contracts/system/desktop/value/desktop-capability-registry.value.ts"), /satisfies Record<string, readonly \(keyof DesktopCapabilityRegistryValue\)\[]>/);
  assert.match(source("electron/system/bootstrap/application-runtime.ts"), /desktop:evolution-workbench-changed/);
  assert.doesNotMatch(source("electron/system/bootstrap/application-runtime.ts"), /function buildEvolutionWorkbenchChange/);
  assert.match(source("electron/services/evolution/internal/evolution-workbench-change.assembler.ts"), /previousStateVersion:\s*previous\.updatedAt/);
  assert.match(source("src/features/evolution/components/EvolutionDatabaseGrid.tsx"), /onEvolutionWorkbenchChanged/);
  assert.match(source("src/features/evolution/components/EvolutionDatabaseGrid.tsx"), /visibilitychange/);
  assert.match(source("contracts/services/evolution/index.ts"), /EvolutionStateOutDto \} from "\.\/dto\/evolution-state\.out\.dto\.js"/);
  assert.match(source("contracts/services/evolution/dto/evolution-workbench.out.dto.ts"), /interface EvolutionWorkspaceLocationOutDto/);
  assert.match(source("electron/system/ipc/register-desktop-ipc.ts"), /normalizeEvolutionWorkspaceLocation/);
  assert.doesNotMatch(source("contracts/system/desktop/api/desktop.api.ts"), /onEvolutionWorkspacePerspective|openEvolutionWorkspace\(perspective/);
  assert.match(source("src/features/evolution/components/EvolutionDatabaseGrid.tsx"), /requestedLocation.*onLocationChange/);
  assert.match(source("src/features/nangong/components/NangongEvolutionRail.tsx"), /dispatchEvolutionProposal\([^\n]+evolutionMutationRequest\(state\)\)/);
  assert.match(source("src/features/evolution/model/evolution-workbench.ts"), /expectedStateVersion:\s*state\.updatedAt/);
  assert.match(source("electron/services/workflow/internal/workflow.repository.ts"), /evolution\.mutation/);
  const mutationCoordinator = source("electron/services/evolution/internal/evolution-mutation.coordinator.ts");
  assert.match(mutationCoordinator, /class EvolutionMutationCoordinator/);
  assert.match(mutationCoordinator, /runAsync/);
  assert.match(source("electron/services/personas/nangong/internal/nangong-task-distribution.service.ts"), /mutations\.runAsync\(/);
  assert.match(source("electron/services/personas/hanli/internal/hanli-application.service.ts"), /#mutations\.run\(/);
  assert.doesNotMatch(source("electron/services/personas/nangong/nangong.facade.ts"), /decideProposal|autoApprove|generateAcceptancePlan|#mutations/);
  assert.doesNotMatch(source("electron/services/personas/hanli/hanli.facade.ts"), /sendConversationMessage|createProposal|resumeOneShotRun/);
  assert.doesNotMatch(source("electron/services/evolution/internal/evolution-state.store.ts"), /automaticApprovalEnabled|raw\.version === [1-7]/);
  assert.doesNotMatch(source("electron/services/evolution/internal/evolution-state.store.ts"), /node:fs|readFileSync|writeFileSync|renameSync/);
  assert.match(source("electron/system/bootstrap/application-runtime.ts"), /createEvolutionState\(aiMemoryDatabase\)/);
  assert.doesNotMatch(source("electron/system/bootstrap/application-runtime.ts"), /new NangongEvolutionStore\(path\.join\([^\n]+nangong-evolution\.json/);
  assert.match(source("src/features/hanli/components/HanLiEvolutionApprovalPanel.tsx"), /decideEvolutionProposal\([^\n]+mutation:\s*evolutionMutationRequest\(state\)/);
  assert.match(source("src/features/hanli/components/HanLiEvolutionApprovalPanel.tsx"), /decideEvolutionResult\([^\n]+mutation:\s*evolutionMutationRequest\(state\)/);
  assert.match(source("src/features/evolution/components/EvolutionRevisionPanels.tsx"), /reviseEvolutionProposal\([^\n]+mutation:\s*evolutionMutationRequest\(state\)/);
  const apiMethods = [...source("contracts/system/desktop/api/desktop.api.ts").matchAll(/^\s{2}(\w+)\(/gm)].map((match) => match[1]);
  const registryBody = source("contracts/system/desktop/value/desktop-capability-registry.value.ts").split("export const DESKTOP_CAPABILITY_DOMAINS", 2)[1];
  const registeredMethods = [...registryBody.matchAll(/"(\w+)"/g)].map((match) => match[1]);
  assert.deepEqual(new Set(registeredMethods).size, registeredMethods.length, "capability IDs must not repeat across domains");
  assert.deepEqual([...registeredMethods].sort(), [...apiMethods].sort(), "every DesktopApi method must belong to one capability domain");
  const bridgeMethods = ["system", "rule", "codex", "screenshot", "collaboration", "conversation"]
    .flatMap((domain) => [...source(`electron/system/preload/domains/${domain}-bridge.cts`).matchAll(/^\s{4}(\w+):/gm)].map((match) => match[1]));
  assert.deepEqual(new Set(bridgeMethods).size, bridgeMethods.length, "preload methods must not repeat across domain bridges");
  assert.deepEqual([...bridgeMethods].sort(), [...apiMethods].sort(), "preload must expose every registered DesktopApi method exactly once");
});

test("all Electron IPC domains and renderer failures use the unified event boundary", () => {
  const helper = source("electron/system/ipc/event-center-ipc.ts");
  const desktopIpc = source("electron/system/ipc/register-desktop-ipc.ts");
  for (const domain of [
    "electron/system/ipc/domains/register-collaboration-ipc.ts",
    "electron/system/ipc/domains/register-settings-ipc.ts",
    "electron/system/ipc/domains/register-workspace-ipc.ts",
    "electron/system/ipc/domains/register-rules-ipc.ts",
    "electron/system/ipc/domains/register-codex-ipc.ts",
    "electron/system/ipc/domains/register-system-ipc.ts",
  ]) assert.match(source(domain), /registerEventCenterIpcHandler/);
  assert.match(helper, /ipcMain\.handle\(channel/);
  assert.doesNotMatch(desktopIpc, /ipcMain\.handle\(/);
  assert.match(desktopIpc, /desktop:renderer-exception/);
  assert.match(source("src/main.tsx"), /unhandledrejection/);
  assert.match(source("src/main.tsx"), /RendererErrorBoundary/);
  assert.match(source("electron/system/preload/domains/system-bridge.cts"), /reportRendererException/);
  for (const bridge of ["system", "rule", "codex", "screenshot", "collaboration", "conversation"]) {
    assert.match(source("electron/system/preload/preload.cts"), new RegExp(`${bridge}Bridge\\(\\)`));
  }
});

test("sandboxed preload keeps domain source boundaries but builds one physical bridge", () => {
  const manifest = JSON.parse(source("package.json"));
  const preloadBuilder = source("scripts/build-sandboxed-preload.mjs");
  const mainWindow = source("electron/system/window/create-main-window.ts");
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
  const memory = source("electron/services/support/capabilities/event-center/internal/projection/collaboration-memory.service.ts");
  const migration = source("db/sql/schema-AiDesktopCurrent.sql");
  const corpusMigration = source("db/sql/schema-AiDesktopCurrent.sql");
  const main = source("electron/system/bootstrap/application-runtime.ts");
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
  const main = source("electron/system/bootstrap/application-runtime.ts");
  const codexService = source("electron/services/support/platform/codex/codex.facade.ts");
  const ingestion = source("electron/services/support/capabilities/event-center/internal/corpus/codex-conversation-corpus.ingestion.ts");
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
  const semanticBackfill = source("electron/services/support/capabilities/event-center/internal/corpus/codex-conversation-semantic-backfill.ts");
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
  const ingestion = source("electron/services/support/capabilities/event-center/internal/corpus/codex-conversation-corpus.ingestion.ts");
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
  assert.equal(existsSync(path.join(appRoot, "electron/services/support/capabilities/testing/internal/fixed-unified-test.runner.ts")), true);
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
  const electronMainSource = source("electron/system/bootstrap/collaboration.bootstrap.ts");
  assert.doesNotMatch(electronMainSource, /LinghuAutomationStore|LinghuUnifiedTestRunner|linghuRuntime\.store/);
  assert.match(electronMainSource, /options\.runUnifiedTests/);
  assert.equal(existsSync(path.join(appRoot, "contracts/services/personas/linghu/index.ts")), true);
  const linghuDtoContracts = new Map([
    ["create-startup-prompt.in.dto.ts", ["CreateLinghuStartupPromptInDto"]],
    ["update-startup-prompt.in.dto.ts", ["UpdateLinghuStartupPromptInDto"]],
    ["startup-prompt.out.dto.ts", ["LinghuStartupPromptOutDto"]],
    ["repair-proposal.out.dto.ts", ["CreateLinghuRepairProposalOutDto"]],
    ["automation-state.event.out.dto.ts", ["LinghuAutomationStateEventOutDto"]],
    ["automation-state.out.dto.ts", [
      "LinghuAutomationFeedbackOutDto",
      "LinghuAutomaticFlowSnapshotOutDto",
      "LinghuModuleCompletionReportOutDto",
      "LinghuAutomationStateOutDto",
    ]],
  ]);
  for (const [dtoFile, expectedTypeNames] of linghuDtoContracts) {
    const relativePath = path.join("contracts/services/personas/linghu/dto", dtoFile);
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
  const linghuValueSource = source("contracts/services/personas/linghu/value/automation.value.ts");
  for (const valueName of ["LinghuAutomationModuleValue", "LinghuFlowHealthValue", "LinghuBlockingKindValue"]) {
    assert.match(linghuValueSource, new RegExp(`export type ${valueName}\\b`));
  }
  const linghuContractIndex = source("contracts/services/personas/linghu/index.ts");
  for (const dtoFile of linghuDtoContracts.keys()) {
    assert.ok(linghuContractIndex.includes(`./dto/${dtoFile.replace(/\.ts$/u, ".js")}`), `${dtoFile} must be exported by the Linghu facade`);
  }
  for (const legacyDtoFile of ["automation-state.dto.ts", "startup-prompt.dto.ts", "repair-proposal.dto.ts", "automation-event.dto.ts"]) {
    assert.equal(existsSync(path.join(appRoot, "contracts/services/personas/linghu/dto", legacyDtoFile)), false, legacyDtoFile);
  }
  assert.equal(existsSync(path.join(appRoot, "contracts/services/personas/linghu/automation.ts")), false);
  for (const sourceRoot of ["contracts", "electron", "src"]) {
    for (const sourceFile of sourceFilesUnder(sourceRoot)) {
      if (sourceFile.startsWith(path.join("contracts", "collaboration", "linghu"))) continue;
      assert.doesNotMatch(source(sourceFile), /collaboration\/linghu\/dto\//u, `${sourceFile} must use the Linghu contract facade`);
    }
  }
  assert.equal(existsSync(path.join(appRoot, "electron/services/collaboration/linghu-automation-facade.ts")), false);
  assert.equal(existsSync(path.join(appRoot, "electron/services/collaboration/linghu-automation-store.ts")), false);
  assert.equal(existsSync(path.join(appRoot, "electron/services/collaboration/linghu-unified-test-runner.ts")), false);
  assert.equal(existsSync(path.join(appRoot, "contracts/services/personas/linghu-automation.ts")), false);
  assert.doesNotMatch(developerApp, /function NangongEvolutionRail/);
  assert.doesNotMatch(developerApp, /function EvolutionControlWorkspace|function EvolutionModuleOverview|function EvolutionPeopleSummary/);
  assert.doesNotMatch(developerApp, /const EVOLUTION_STATUS_LABELS/);
  assert.equal(existsSync(path.join(appRoot, "src/features/screenshot/geometry/annotation-geometry.ts")), true);
  assert.equal(existsSync(path.join(appRoot, "src/features/screenshot/canvas/annotation-renderer.ts")), true);
});

test("main-process orchestration delegates IPC and pure collaboration parsing", () => {
  const ipcSource = source("electron/system/ipc/register-desktop-ipc.ts");
  assert.match(ipcSource, /registerSettingsIpc\(/);
  assert.match(ipcSource, /registerWorkspaceIpc\(/);
  assert.match(ipcSource, /registerCollaborationIpc\(/);
  assert.match(ipcSource, /registerRulesIpc\(/);
  assert.match(source("electron/services/support/platform/codex/codex.facade.ts"), /internal\/codex-stream-event\.mapper/);
  assert.doesNotMatch(source("electron/services/support/capabilities/conversation/internal/collaboration-codex-sessions.ts"), /review-decision-parser|CodexReviewerSession/);
  assert.match(source("electron/services/workflow/collaboration-workflow.facade.ts"), /result\/result-summary/);
  assert.match(source("electron/system/ipc/domains/register-collaboration-ipc.ts"), /NangongFacade/);
  assert.match(source("electron/system/ipc/domains/register-collaboration-ipc.ts"), /HanliFacade/);
  assert.match(source("electron/system/ipc/domains/register-collaboration-ipc.ts"), /EvolutionFacade/);
  assert.match(source("electron/system/ipc/domains/register-collaboration-ipc.ts"), /PersonaWorkflowFacade/);
  assert.match(source("electron/services/personas/nangong/internal/nangong-task-distribution.service.ts"), /evolutionProposalId/);
});

test("Electron entry delegates startup, persistence, collaboration, personas and IPC to bootstrap boundaries", () => {
  const main = source("electron/main.ts");
  assert.ok(main.split(/\r?\n/u).length <= 30, "electron/main.ts must remain a thin lifecycle entry");
  assert.match(main, /startApplication/);
  assert.match(main, /disposeApplication/);
  assert.doesNotMatch(main, /initializeAiMemoryDatabase|createHanliRuntime|createLinghuRuntime|registerDesktopIpc|BrowserWindow/);
  for (const bootstrap of [
    "startup-context.ts",
    "persistence.bootstrap.ts",
    "capabilities.bootstrap.ts",
    "collaboration.bootstrap.ts",
    "personas.bootstrap.ts",
    "ipc.bootstrap.ts",
    "application-runtime.ts",
  ]) assert.equal(existsSync(path.join(appRoot, "electron/system/bootstrap", bootstrap)), true, bootstrap);
  assert.equal(existsSync(path.join(appRoot, "electron/README.md")), true, "electron README must document system and services");
  const electronReadme = source("electron/README.md");
  assert.match(electronReadme, /system\/.*Electron 系统层/s);
  assert.match(electronReadme, /services\/.*应用服务层/s);
  for (const retiredRoot of ["bootstrap", "config", "ipc", "preload", "policies", "window", "application"]) {
    assert.equal(existsSync(path.join(appRoot, "electron", retiredRoot)), false, `electron/${retiredRoot} must remain retired`);
  }
  assert.match(source("electron/system/bootstrap/application-runtime.ts"), /createPersistenceContext/);
  assert.match(source("electron/system/bootstrap/application-runtime.ts"), /createCapabilityContext/);
  assert.match(source("electron/system/bootstrap/application-runtime.ts"), /createCollaborationContext/);
  assert.match(source("electron/system/bootstrap/application-runtime.ts"), /createPersonaApplicationContext/);
  assert.match(source("electron/system/bootstrap/application-runtime.ts"), /registerApplicationIpc/);
});

test("customer package config excludes build-machine roots and carries external rule resources", () => {
  const customerConfig = source("electron-builder.customer.config.cjs");
  const builderManifest = JSON.parse(source("electron-builder.developer.json"));
  assert.doesNotMatch(customerConfig, /selplatDevelopmentRoot\s*:/);
  assert.match(customerConfig, /package\/customer/);
  assert.ok(builderManifest.extraResources.some((resource) => resource.to === "ruleengine"));
  assert.match(source("electron/system/config/app-config.ts"), /userData"\), "workspace"/);
  assert.match(source("electron/system/bootstrap/capabilities.bootstrap.ts"), /options\.resourcesPath, "ruleengine"/);
});

test("核心业务区与 support 支撑区只通过唯一 index 交叉协作且旧路径归零", () => {
  const serviceModules = [
    "personas/nangong",
    "personas/hanli",
    "personas/linghu",
    "evolution",
    "workflow",
    "support/capabilities/conversation",
    "support/capabilities/execution",
    "support/capabilities/event-center",
    "support/capabilities/testing",
    "support/capabilities/release",
    "support/capabilities/rules",
    "support/platform/codex",
    "support/platform/persistence",
    "support/platform/workspace",
    "support/platform/settings",
    "support/platform/security",
    "support/platform/attachments",
  ];
  for (const moduleRoot of serviceModules) {
    const indexPath = path.join("electron/services", moduleRoot, "index.ts");
    assert.equal(existsSync(path.join(appRoot, indexPath)), true, `${moduleRoot} 必须有唯一公开 index.ts`);
    assert.match(source(indexPath), /[\u3400-\u9fff]/u, `${moduleRoot} 的公开入口必须包含新手可读业务注释`);
  }

  const rootServiceFiles = readdirSync(path.join(appRoot, "electron/services"), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"));
  assert.deepEqual(rootServiceFiles, [], "electron/services 根层不得平铺具体 Service");
  const rootServiceDirectories = readdirSync(path.join(appRoot, "electron/services"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(rootServiceDirectories, ["evolution", "personas", "support", "workflow"], "services 顶层只保留核心业务区和 support");
  const supportDirectories = readdirSync(path.join(appRoot, "electron/services/support"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(supportDirectories, ["application", "capabilities", "platform"], "support 只收敛三类非人物业务能力");
  for (const supportOnlyRoot of ["application", "capabilities", "platform"]) {
    assert.equal(existsSync(path.join(appRoot, "electron/services", supportOnlyRoot)), false, `${supportOnlyRoot} 必须收敛到 services/support`);
    assert.equal(existsSync(path.join(appRoot, "electron/services/support", supportOnlyRoot)), true, `services/support/${supportOnlyRoot} 必须存在`);
  }

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

  for (const sourceFile of sourceFilesUnder("electron/services/support/platform")) {
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
  const hanliApplication = source("electron/services/personas/hanli/internal/hanli-application.service.ts");
  assert.match(hanliApplication, /class HanliApplicationService/);
  assert.match(hanliApplication, /new EvolutionApprovalService/);
  assert.match(hanliApplication, /new HanliDeliberationService/);
  assert.doesNotMatch(personaWorkflow, /createEvolutionApprovalService|createHanliDeliberationPort|#approvals|#hanliDecisions/);
  assert.match(source("electron/services/personas/hanli/hanli.facade.ts"), /interface HanliWorkflowPort/);
  assert.match(personaWorkflow, /hanli:\s*HanliWorkflowPort/);
  for (const method of ["decideProposal", "decideResult", "autoApprove", "generateAcceptancePlan", "acceptancePlan", "recordAcceptanceRun", "advanceHanLiDeliberation"]) {
    assert.doesNotMatch(personaWorkflow, new RegExp(`\\n\\s{2}${method}\\(`), `${method} 只能由 HanliFacade 公开`);
  }
  const hanliIndex = source("electron/services/personas/hanli/index.ts");
  assert.doesNotMatch(hanliIndex, /createEvolutionApprovalService|createHanliDeliberationPort|EvolutionApprovalPort|HanliDeliberationPort/);
  const nangongApplication = source("electron/services/personas/nangong/internal/nangong-application.service.ts");
  assert.match(nangongApplication, /class NangongApplicationService/);
  assert.match(nangongApplication, /new NangongConversationService\(options\)/);
  assert.match(nangongApplication, /new NangongEvolutionAuthoringService\(options\)/);
  assert.doesNotMatch(nangongApplication, /#store\.(?:appendConversation|createProposal)|revisionInvestigationPrompt/);
  const nangongPorts = source("electron/services/personas/nangong/internal/nangong-application.ports.ts");
  assert.match(nangongPorts, /interface NangongProposalReviewPort/);
  assert.match(nangongPorts, /interface NangongOneShotWorkflowPort/);
  assert.match(nangongPorts, /interface NangongTaskDistributionPort/);
  assert.match(source("electron/services/personas/nangong/internal/nangong-task-distribution.service.ts"), /class NangongTaskDistributionService/);
  assert.equal(existsSync(path.join(appRoot, "electron/services/workflow/internal/evolution-task-distribution.service.ts")), false);
  const executorFacade = source("electron/services/personas/executor/executor.facade.ts");
  assert.match(executorFacade, /class ExecutorFacade/);
  assert.match(executorFacade, /#sessions = new Map/);
  assert.doesNotMatch(source("electron/services/workflow/collaboration-workflow.facade.ts"), /#executorSessions|CollaborationSessionFactory/);
  assert.match(source("electron/system/ipc/domains/register-collaboration-ipc.ts"), /dispatch-evolution-proposal[\s\S]*nangong\.distributeProposal/);
  assert.match(source("electron/services/personas/nangong/internal/nangong-conversation.service.ts"), /class NangongConversationService/);
  assert.match(source("electron/services/personas/nangong/internal/nangong-evolution-authoring.service.ts"), /class NangongEvolutionAuthoringService/);
  assert.match(source("electron/services/personas/nangong/internal/nangong-conversation.parser.ts"), /parseNangongConversationResponse/);
  assert.match(source("electron/services/personas/nangong/internal/nangong-revision.investigator.ts"), /revisionInvestigationPrompt/);
  assert.doesNotMatch(personaWorkflow, /parseConversationResponse|revisionInvestigationPrompt|NANGONG_TOPIC_META/);
  assert.doesNotMatch(personaWorkflow, /recordProposalApplication|resolveEnabledMemberDisplayName|hasLiveOneShotOwner|advanceOneShot:/);
  for (const method of ["sendConversationMessage", "newConversation", "generateTopicDraft", "convertConversationToTopic", "createProposal", "updateTopic", "reviseProposal", "investigateAndReviseReturnedProposal"]) {
    assert.doesNotMatch(personaWorkflow, new RegExp(`\\n\\s{2}${method}\\(`), `${method} 只能由 NangongFacade 公开`);
  }
  const main = source("electron/system/bootstrap/application-runtime.ts");
  const personaBootstrap = source("electron/system/bootstrap/personas.bootstrap.ts");
  assert.match(main, /hanli:\s*hanliRuntime\.facade/);
  assert.doesNotMatch(main, /createHanliRuntime\(\{\s*application:/);
  assert.doesNotMatch(main, /const nangongStore\s*=/);
  for (const runtimeName of ["nangongRuntime", "hanliRuntime", "linghuRuntime"]) {
    assert.match(personaBootstrap, new RegExp(`memberId: (?:options\\.)?${runtimeName}\\.memberId`));
  }

  // Contracts 按人物、共享事实、流程以及输入输出方向分层。
  for (const contract of [
    "contracts/services/personas/nangong/dto/send-conversation-message.in.dto.ts",
    "contracts/services/personas/nangong/dto/conversation.out.dto.ts",
    "contracts/services/personas/nangong/dto/create-proposal.in.dto.ts",
    "contracts/services/personas/hanli/dto/decide-proposal.in.dto.ts",
    "contracts/services/personas/hanli/dto/acceptance-plan.out.dto.ts",
    "contracts/services/personas/hanli/dto/acceptance-run.out.dto.ts",
    "contracts/services/personas/executor/dto/executor-execution-result.out.dto.ts",
    "contracts/services/personas/executor/port/executor-session.port.ts",
    "contracts/services/evolution/dto/evolution-state.out.dto.ts",
    "contracts/services/evolution/dto/evolution-state.event.out.dto.ts",
    "contracts/services/evolution/dto/evolution-proposal.out.dto.ts",
    "contracts/services/workflow/dto/configure-persona-workflow.in.dto.ts",
    "contracts/services/workflow/dto/persona-workflow-action.in.dto.ts",
    "contracts/services/workflow/port/persona-runtime.port.ts",
    "contracts/services/workflow/value/persona-capability.value.ts",
  ]) assert.equal(existsSync(path.join(appRoot, contract)), true, contract);

  for (const legacyContract of [
    "contracts/services/personas/nangong/dto/nangong-command.in.dto.ts",
    "contracts/services/personas/nangong/dto/nangong-result.out.dto.ts",
    "contracts/services/personas/hanli/dto/hanli-decision.in.dto.ts",
    "contracts/services/personas/hanli/dto/hanli-acceptance.out.dto.ts",
    "contracts/services/workflow/dto/persona-workflow.in.dto.ts",
  ]) assert.equal(existsSync(path.join(appRoot, legacyContract)), false, legacyContract);

  const contractSources = sourceFilesUnder("contracts").map((file) => source(file)).join("\n");
  assert.doesNotMatch(contractSources, /export(?: type)? \*/u, "contracts 必须使用显式符号出口");
  assert.doesNotMatch(contractSources, /\b(?:EvolutionState|EvolutionMutationRequest|DecideEvolutionProposalRequest|SendNangongConversationMessageRequest)\b/u, "旧总协议名称必须归零");
  assert.equal(existsSync(path.join(appRoot, "contracts/services/workflow/collaboration.ts")), false, "Workflow 总协议文件必须完成拆分");
  const electronSources = sourceFilesUnder("electron").map((file) => source(file)).join("\n");
  assert.doesNotMatch(electronSources, /contracts\/desktop\/desktop\.js/u, "主进程必须从目标领域 index 导入，Desktop 聚合只属于 preload 和 Renderer");

  // 人物页面已离开共享 Evolution 组件目录，共享工作区只从人物 index 组合它们。
  assert.equal(existsSync(path.join(appRoot, "src/features/nangong/components/NangongEvolutionRail.tsx")), true);
  assert.equal(existsSync(path.join(appRoot, "src/features/hanli/components/HanLiEvolutionApprovalPanel.tsx")), true);
  assert.equal(existsSync(path.join(appRoot, "src/features/evolution/components/NangongEvolutionRail.tsx")), false);
  assert.equal(existsSync(path.join(appRoot, "src/features/evolution/components/HanLiEvolutionApprovalPanel.tsx")), false);
  assert.match(source("src/features/evolution/components/EvolutionControlWorkspace.tsx"), /from "\.\.\/\.\.\/nangong"/);
  assert.match(source("src/features/evolution/components/EvolutionControlWorkspace.tsx"), /from "\.\.\/\.\.\/hanli"/);

  // 旧混合命名和旧平铺契约必须在完成阶段消失。
  assert.equal(existsSync(path.join(appRoot, "contracts/services/evolution/nangong-evolution.ts")), false);
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
