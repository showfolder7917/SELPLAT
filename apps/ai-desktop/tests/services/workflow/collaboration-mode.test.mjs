import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { CollaborationDurationLog } from "../../../../../build/ai-desktop/electron/electron/services/workflow/internal/collaboration/collaboration-duration.log.js";
import { CollaborationCoordinator } from "../../../../../build/ai-desktop/electron/electron/services/workflow/collaboration-workflow.facade.js";
import { PersonaSessionWriterQueue, collaborationWorkspaceState } from "../../../../../build/ai-desktop/electron/electron/services/support/capabilities/conversation/internal/collaboration-codex-sessions.js";
import { createCollaborationResultSummary } from "../../../../../build/ai-desktop/electron/electron/services/workflow/internal/result/result-summary.js";
import { inspectManagedDependencyRecovery, acquireManagedDependencyLease, cleanupIntegrationDependencyLinks, ensureIntegrationDependencies, releaseManagedDependencyLease, verifyCandidateDelta } from "../../../../../build/ai-desktop/electron/electron/services/support/capabilities/release/internal/integration.verifier.js";
import { stageVerifiedDeveloperExecutable } from "../../../../../build/ai-desktop/electron/electron/services/support/capabilities/release/internal/verified-package.release.js";
import { CollaborationStore } from "../../../../../build/ai-desktop/electron/electron/services/workflow/internal/collaboration/collaboration.store.js";
import { CollaborationNavigationPreferenceStore } from "../../../../../build/ai-desktop/electron/electron/services/workflow/internal/collaboration/collaboration-navigation-preference.store.js";
import { LinghuAutomationFacade } from "../../../../../build/ai-desktop/electron/electron/services/personas/linghu/index.js";
import { ExecutorFacade } from "../../../../../build/ai-desktop/electron/electron/services/personas/executor/index.js";
import { LinghuAutomationStore } from "../../../../../build/ai-desktop/electron/electron/services/personas/linghu/internal/linghu-automation.store.js";
import { parseCustomerActionGuidance } from "../../../../../build/ai-desktop/electron/electron/services/personas/linghu/internal/linghu-customer-action-guidance.js";
import { TestResourceCoordinatorFacade } from "../../../../../build/ai-desktop/electron/electron/services/support/capabilities/testing/test-resource-coordinator.facade.js";
import { isUnifiedTestCapacityBlockedError } from "../../../../../build/ai-desktop/electron/electron/services/support/capabilities/testing/index.js";
import { IntegrationReleaseCoordinatorFacade } from "../../../../../build/ai-desktop/electron/electron/services/support/capabilities/release/integration-release.facade.js";
import { ReleaseBatchStore } from "../../../../../build/ai-desktop/electron/electron/services/support/capabilities/release/internal/release-batch.store.js";
import { describeGitFailure, resolveGitCommand } from "../../../../../build/ai-desktop/electron/electron/services/support/capabilities/release/internal/git-process.js";
import { LocalChangeOwnershipError, MergeConflictError, StaleTaskResultError, UncommittedTaskWorkspaceError, VersionWorkspaceManager } from "../../../../../build/ai-desktop/electron/electron/services/support/capabilities/release/internal/version-workspace.manager.js";
import { ManagedTaskExecutor } from "../../../../../build/ai-desktop/electron/electron/services/support/capabilities/execution/internal/managed-task.executor.js";
import { TaskRepairScopeAggregate, TaskRepairScopeViolationError } from "../../../../../build/ai-desktop/electron/electron/services/support/capabilities/execution/index.js";
import { PromptLibraryFacade } from "../../../../../build/ai-desktop/electron/electron/services/support/capabilities/prompts/index.js";
import { createAtomicJsonPersistence } from "../../../../../build/ai-desktop/electron/electron/services/support/platform/persistence/index.js";
import { appRoot, controlledTestRoot, projectPaths, projectRoot } from "#test-paths";

const controlledTempRoot = controlledTestRoot;
const prompts = new PromptLibraryFacade(path.join(projectPaths.buildRoot, "prompt-bundle"));
mkdirSync(controlledTempRoot, { recursive: true });
const activeStableUserId = readFileSync(path.join(appRoot, "ruleengine/AGENTS.md"), "utf8").match(/当前稳定用户 ID：`([^`]+)`/u)?.[1];
assert.ok(activeStableUserId, "AGENTS.md 必须声明当前稳定用户 ID");
const rendererCollaborationSources = [
  "../../../src/applications/developer/DeveloperApplication.tsx",
  "../../../src/features/collaboration/components/TaskCollaborationGroup.tsx",
  "../../../src/features/collaboration/components/CollaborationMemberPage.tsx",
  "../../../src/features/conversation/components/CollaborationStatusChain.tsx",
  "../../../src/features/conversation/components/CodexConversationWorkspace.tsx",
  "../../../src/features/conversation/components/CodexConversationWorkspace/CodexConversationTimeline.tsx",
];
const developerSource = rendererCollaborationSources.map((source) => readFileSync(new URL(source, import.meta.url), "utf8")).join("\n");
const coordinatorSource = readFileSync(new URL("../../../electron/services/workflow/collaboration-workflow.facade.ts", import.meta.url), "utf8");
const integrationPipelineSource = readFileSync(new URL("../../../electron/services/support/capabilities/release/internal/version-integration.pipeline.ts", import.meta.url), "utf8");
const releaseBatchStoreSource = readFileSync(new URL("../../../electron/services/support/capabilities/release/internal/release-batch.store.ts", import.meta.url), "utf8");
const verifiedPackageReleaseSource = readFileSync(new URL("../../../electron/services/support/capabilities/release/internal/verified-package.release.ts", import.meta.url), "utf8");
const collaborationBootstrapSource = readFileSync(new URL("../../../electron/system/bootstrap/collaboration.bootstrap.ts", import.meta.url), "utf8");
// 入口存在性由边界测试负责；这里读取 Workflow 稳定 Value 验证完整状态枚举。
const collaborationContractSource = readFileSync(new URL("../../../contracts/services/workflow/value/collaboration-task.value.ts", import.meta.url), "utf8");
const unifiedTestRunnerSource = readFileSync(new URL("../../../electron/services/support/capabilities/testing/internal/fixed-unified-test.runner.ts", import.meta.url), "utf8");
const linghuRuntimeSource = readFileSync(new URL("../../../electron/services/personas/linghu/internal/create-linghu-runtime.ts", import.meta.url), "utf8");
const integrationVerifierSource = readFileSync(new URL("../../../electron/services/support/capabilities/release/internal/integration.verifier.ts", import.meta.url), "utf8");
const startupContextSource = readFileSync(new URL("../../../electron/system/bootstrap/startup-context.ts", import.meta.url), "utf8");
const applicationRuntimeSource = readFileSync(new URL("../../../electron/system/bootstrap/application-runtime.ts", import.meta.url), "utf8");

test("原始逐字流只进入时间线流表，不重复写入全局事件中心", () => {
  assert.match(applicationRuntimeSource, /event\.type !== "message-delta" && event\.type !== "reasoning-summary-delta"/);
});
const collaborationSessionsSource = readFileSync(new URL("../../../electron/services/support/capabilities/conversation/internal/collaboration-codex-sessions.ts", import.meta.url), "utf8");
const idleTestResourceState = () => ({ holder: null, waiters: [], localQueueDepth: 0, lastEvent: null });

test("监控者一次调用封存旧修复任务、退役工作树并释放遗留执行者", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "monitor-takeover-archive-"));
  try {
    const store = new CollaborationStore(path.join(directory, "collaboration.json"));
    const submitted = store.submitTask({
      title: "旧修复任务",
      problemStatement: "旧执行链已失效",
      confirmedIntent: "由监控者接管正式版本",
      workspaceState,
      locale: "zh-CN",
      automationSource: "linghu-safeguard",
      evolutionProposalId: "proposal-monitor-takeover",
      initiatorMemberId: "linghu-ancestor",
      preferredExecutorMemberId: "linghu-ancestor",
    });
    const workspace = { workspaceId: "worktree:old:r1", rootPath: path.join(directory, "old-worktree"), branchName: "codex/collab/old/r1", baseSha: "base", resultSha: null, createdAt: new Date().toISOString(), retiredAt: null };
    store.updateTask(submitted.taskId, "fixture.executing", (task, state) => {
      task.state = "repairing-execution";
      task.phase = "executing";
      task.executorMemberId = "linghu-ancestor";
      task.assignmentId = "assignment-old";
      task.versionWorkspace = workspace;
      const member = state.members.find((candidate) => candidate.memberId === "linghu-ancestor");
      member.state = "working";
      member.role = "executor";
      member.phase = "executing";
      member.currentTaskId = task.taskId;
    });
    const calls = [];
    const coordinator = new CollaborationCoordinator({
      store,
      durations: { startWait: () => "wait", finish: () => undefined, start: () => "span", instant: () => undefined, interruptOpenSpans: () => undefined },
      workspaces: {
        readTaskUncommittedFiles: async () => [],
        retireWorkspace: async (value) => { calls.push(`retire:${value.workspaceId}`); },
      },
      executor: { close: async (taskId) => { calls.push(`close:${taskId}`); }, closeAll: async () => undefined },
      integrationPipeline: { dispose: () => undefined },
      emitState: () => undefined,
      emitStream: () => undefined,
    });

    const archivedTaskId = await coordinator.archiveMonitorTakeover("proposal-monitor-takeover", "abcdef1234567890", "正式版本已由监控者交付");
    const archived = store.task(submitted.taskId);
    const member = store.state().members.find((candidate) => candidate.memberId === "linghu-ancestor");
    assert.equal(archivedTaskId, submitted.taskId);
    assert.deepEqual(calls, [`close:${submitted.taskId}`, "retire:worktree:old:r1"]);
    assert.equal(archived.state, "cancelled");
    assert.equal(archived.assignmentId, null);
    assert.equal(archived.executorMemberId, null);
    assert.ok(archived.versionWorkspace.retiredAt);
    assert.match(archived.flowEvents.at(-1).summary, /abcdef123456/);
    assert.equal(member.state, "idle");
    assert.equal(member.currentTaskId, null);
    await coordinator.dispose();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("候选跨模块回传容量阻断时保留等待身份", () => {
  const capacity = { fileBytes: 1, directoryBytes: 2, headroomBytes: 3, requiredBytes: 6, availableBytes: 4 };
  const relayed = { name: "UnifiedTestCapacityBlockedError", code: "unified-test-capacity-blocked", script: "package:mac:developer", capacity };
  assert.equal(isUnifiedTestCapacityBlockedError(relayed), true);
  assert.equal(isUnifiedTestCapacityBlockedError({ code: "ENOSPC", capacity }), false);
});

// 测试也经 Platform Port 创建人物 Store，避免用例重新引入文件路径耦合。
function createTestLinghuStore(filePath) {
  return new LinghuAutomationStore(createAtomicJsonPersistence(filePath));
}

function runCoordinatorWorker(coordinationRoot, runId, buildRoot, holdMilliseconds) {
  const worker = new URL("../../support/fixtures/test-resource-coordinator-worker.mjs", import.meta.url);
  const moduleUrl = new URL("../../../../../build/ai-desktop/electron/electron/services/support/capabilities/testing/test-resource-coordinator.facade.js", import.meta.url).href;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [fileURLToPath(worker), moduleUrl, coordinationRoot, runId, buildRoot, String(holdMilliseconds)], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code !== 0) return reject(new Error(`测试资源子进程失败：${stderr || stdout}`));
      try { resolve(JSON.parse(stdout.trim())); } catch (error) { reject(error); }
    });
  });
}

function runReleaseWorker(coordinationRoot, releaseBatchId, holdMilliseconds) {
  const worker = new URL("../../support/fixtures/integration-release-coordinator-worker.mjs", import.meta.url);
  const moduleUrl = new URL("../../../../../build/ai-desktop/electron/electron/services/support/capabilities/release/integration-release.facade.js", import.meta.url).href;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [fileURLToPath(worker), moduleUrl, coordinationRoot, releaseBatchId, String(holdMilliseconds)], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code !== 0) return reject(new Error(`发布资源子进程失败：${stderr || stdout}`));
      try { resolve(JSON.parse(stdout.trim())); } catch (error) { reject(error); }
    });
  });
}

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } }).trim();
}

test("darwin 发布 Git 使用系统可执行文件并保留启动诊断", () => {
  assert.equal(resolveGitCommand("darwin", () => true), "/usr/bin/git");
  assert.equal(resolveGitCommand("darwin", () => false), "git");
  const error = Object.assign(new Error("spawn git ENOENT"), { code: "ENOENT" });
  const diagnostic = describeGitFailure(error, "/usr/bin/git", "/candidate/worktree", { PATH: "" });
  assert.match(diagnostic.message, /command=\/usr\/bin\/git/);
  assert.match(diagnostic.message, /cwd=\/candidate\/worktree/);
  assert.match(diagnostic.message, /PATH=<missing>/);
  const checkFailure = Object.assign(new Error("Command failed"), { stdout: "candidate.txt:1: trailing whitespace\n" });
  assert.match(describeGitFailure(checkFailure, "/usr/bin/git", "/candidate/worktree", {}).message, /candidate\.txt:1: trailing whitespace/);
  const bufferedCheckFailure = Object.assign(new Error("Command failed"), { stderr: Buffer.from("candidate.txt:1: trailing whitespace\n") });
  assert.match(describeGitFailure(bufferedCheckFailure, "/usr/bin/git", "/candidate/worktree", {}).message, /candidate\.txt:1: trailing whitespace/);
});

test("会话卡片绑定真实协作任务并完整显示修复回流与统一测试状态", () => {
  assert.match(developerSource, /collaborationTaskId/);
  assert.match(developerSource, /CollaborationStatusChain/);
  assert.match(developerSource, /node\.actor\.displayName/);
  assert.match(developerSource, /message\.collaborationTaskId[\s\S]*messageTask[\s\S]*CollaborationStatusChain/);
  assert.match(developerSource, /test-failed[\s\S]*重新测试/);
  assert.doesNotMatch(collaborationContractSource, /repairing-review|queued-reviewer/);
  assert.match(collaborationContractSource, /repairing-execution/);
  assert.match(collaborationContractSource, /unified-testing/);
  assert.match(collaborationContractSource, /returned-to-nangong/);
  assert.match(collaborationContractSource, /awaiting-restart/);
  assert.doesNotMatch(coordinatorSource, /review\.repair_completed|preferredReviewerMemberId/);
  assert.match(coordinatorSource, /execution\.repair_completed[\s\S]*preferredExecutorMemberId/);
  assert.match(integrationPipelineSource, /currentActor\.displayName\}正在统一测试/);
  assert.match(coordinatorSource, /sealEvolutionRound/);
  assert.match(coordinatorSource, /结果已返回南宫婉收集/);
  assert.match(coordinatorSource, /current\.automationSource !== "linghu-safeguard"/);
  assert.match(coordinatorSource, /ORCHESTRATOR_MEMBER_IDS/);
  assert.match(integrationPipelineSource, /release\.awaiting_restart/);

  assert.match(integrationPipelineSource, /invalidateTask[\s\S]*integration\.batch_invalidated[\s\S]*publishedExecutable = null/);
  assert.match(integrationPipelineSource, /release\.restart_healthy/);
  assert.match(integrationPipelineSource, /unified_test\.passed/);
  assert.match(integrationPipelineSource, /unified_test\.failed/);
  assert.match(integrationPipelineSource, /runtime_activation_failed[\s\S]*task\.integrationFailure = \{[\s\S]*kind: "verification"[\s\S]*phase: "verification"/,
    "受控激活后继续测试失败也必须保存自动修复调度器消费的结构化验证失败");
});

const workspaceState = {
  primaryId: "root",
  roots: [{ id: "root", name: "SELPLAT", path: projectRoot, permission: "workspace-write" }],
};

function createExecutionResultCoordinator(directory, store, executionResult) {
  const workspace = { workspaceId: "worktree:execution-result", rootPath: directory, branchName: "codex/execution-result", baseSha: "base", resultSha: null, createdAt: new Date().toISOString(), retiredAt: null };
  return new CollaborationCoordinator({
    store,
    durations: { startWait: () => "wait", finish: () => undefined, start: () => "span", instant: () => undefined, interruptOpenSpans: () => undefined },
    workspaces: { prepareTask: async () => workspace, resumeTask: async () => workspace, commitTaskResult: async () => "result" },
    executor: new ExecutorFacade({
      createExecutor: async () => ({
        isAlive: () => true,
        analyze: async () => "只修改已确认文件并执行针对性验证",
        optimize: async () => "",
        execute: async () => executionResult,
        investigateRepair: async () => "已核对失败事实",
        executeRepair: async () => executionResult,
        dispose: async () => undefined,
      }),
    }),
    integrationPipeline: { finishWaitingTask: () => undefined, trackWaitingTask: () => undefined, invalidateTask: () => undefined, schedule: () => undefined, dispose: () => undefined },
    createTaskRuleContext: () => ({
      activeUserId: "XUNAN", role: "executor", ruleRevision: "revision-one",
      mandatoryRoleRuleIds: ["AI_DESKTOP_EXECUTOR_SOURCE_IMPLEMENTATION_RULES"], matchedTaskRuleIds: [],
      dependencyRuleIds: [], loadedRuleHashes: {}, loadedRuleContents: {}, agentsContent: "# AGENTS", indexCatalog: "# index", ruleReceipt: [],
    }),
    emitState: () => undefined,
    emitStream: () => undefined,
  });
}

test("默认人物稳定列出，新增、重命名和删除入口退役，存量人物保留", () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "collaboration-store-"));
  try {
    const store = new CollaborationStore(path.join(directory, "state.json"));
    assert.equal(store.state().mode, "collaboration");
    store.setMode("single-conversation");
    assert.equal(new CollaborationStore(path.join(directory, "state.json")).state().mode, "collaboration", "重启忽略上次展示模式而不移除任务");
    assert.deepEqual(store.state().members.map((member) => member.displayName), [
      "韩立", "南宫婉", "令狐老祖", "紫灵", "元瑶", "宋玉", "冰魄仙子", "墨彩环", "墨大夫", "厉飞雨", "张铁", "李化元",
    ]);
    const existing = store.state();
    existing.members.push({ ...existing.members.at(-1), memberId: "legacy-yinyue", displayName: "银月" });
    writeFileSync(path.join(directory, "state.json"), JSON.stringify(existing));
    assert.ok(new CollaborationStore(path.join(directory, "state.json")).state().members.find((member) => member.memberId === "legacy-yinyue"));
    assert.equal(store.createMember, undefined);
    assert.equal(store.updateMember, undefined);
    assert.equal(store.deleteMember, undefined);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("人物查看位置不写入协作状态，重复桌面模式不产生协作状态事件", () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "collaboration-selection-idempotent-"));
  try {
    const store = new CollaborationStore(path.join(directory, "state.json"));
    const reasons = [];
    store.subscribe((_state, reason) => reasons.push(reason));
    const before = store.state();
    assert.equal(store.selectMember, undefined);
    assert.equal("selectedMemberId" in store.state(), false);
    store.setMode("collaboration");
    assert.deepEqual(reasons, []);
    assert.equal(store.state().updatedAt, before.updatedAt);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("人物导航偏好独立保存、重启恢复且不修改协作事实", () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "collaboration-navigation-preference-"));
  try {
    const statePath = path.join(directory, "state.json");
    const preferencePath = path.join(directory, "navigation.json");
    const store = new CollaborationStore(statePath);
    const before = store.state();
    const preferences = new CollaborationNavigationPreferenceStore(preferencePath);
    preferences.save("nangong-wan", store.state().members);

    assert.equal(new CollaborationNavigationPreferenceStore(preferencePath).restore(store.state().members), "nangong-wan");
    assert.deepEqual(store.state(), before);
    writeFileSync(preferencePath, JSON.stringify({ memberId: "removed-member" }));
    assert.equal(preferences.restore(store.state().members), "han-li");
    assert.deepEqual(store.state(), before);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("退役的人物选择原因不再影响演化状态机", () => {
  assert.match(applicationRuntimeSource, /reason !== "mode\.changed"/);
  assert.doesNotMatch(applicationRuntimeSource, /member\.selected/);
});

test("旧令狐卡点修复结果从返回南宫婉迁回集成队列", () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "checkpoint-repair-migration-"));
  try {
    const filePath = path.join(directory, "collaboration.json");
    const store = new CollaborationStore(filePath);
    const seeded = store.submitTask({
      title: "修复验收卡点",
      problemStatement: "真实界面验收受阻。",
      confirmedIntent: "令狐修复后回到韩立原验收步骤。",
      workspaceState,
      locale: "zh-CN",
      initiatorMemberId: "han-li",
      preferredExecutorMemberId: "linghu-ancestor",
      automationSource: "linghu-safeguard",
      evolutionProposalId: "proposal-1",
      evolutionRoundId: "proposal-1",
    });
    const persisted = store.state();
    const task = persisted.tasks.find((item) => item.taskId === seeded.taskId);
    task.state = "returned-to-nangong";
    task.phase = "ready";
    task.currentHandler = { memberId: "nangong-wan", displayName: "南宫婉" };
    task.versionWorkspace = { taskId: task.taskId, root: directory, branch: "task", baseSha: "base", resultSha: "result", createdAt: task.createdAt };
    writeFileSync(filePath, JSON.stringify(persisted));

    const migrated = new CollaborationStore(filePath).state().tasks.find((item) => item.taskId === seeded.taskId);
    assert.equal(migrated.state, "ready-for-integration");
    assert.equal(migrated.phase, "ready");
    assert.equal(migrated.currentHandler, null);
    assert.equal(migrated.versionWorkspace.resultSha, "result");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("客户范围修订保留原令狐任务并使旧执行代次失效", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "scope-revision-"));
  try {
    const store = new CollaborationStore(path.join(directory, "collaboration.json"));
    const seeded = store.submitTask({
      title: "修复验收卡点",
      problemStatement: "测试台被错误加入韩立验收。",
      confirmedIntent: "先按旧范围修复。",
      constraints: ["卡点标识：run-4:proposal:proposal-4:round:4"],
      workspaceState,
      locale: "zh-CN",
      initiatorMemberId: "han-li",
      preferredExecutorMemberId: "linghu-ancestor",
      automationSource: "linghu-safeguard",
      evolutionProposalId: "proposal-4",
      evolutionRoundId: "proposal-4",
    });
    store.updateTask(seeded.taskId, "test.completed_before_customer_correction", (task) => {
      task.state = "integrated";
      task.completedAt = new Date().toISOString();
    });
    const coordinator = createExecutionResultCoordinator(directory, store, { status: "code-verified", text: "", pendingActions: [], authorizedFiles: [] });
    // 本用例只核对原子修订结果；关闭调度器，避免新租约在断言前已经开始。
    await coordinator.dispose();
    const revised = await coordinator.reviseActiveRepairScope({
      runId: "run-4",
      proposalId: "proposal-4",
      instruction: "测试台保持通用工具，令狐改为读取内部证据并由韩立查看真实页面验收。",
      confirmedIntent: "测试台保持通用工具，验收回到真实页面。",
      acceptanceCriteria: ["韩立在真实页面核对结果"],
      currentProposalId: "proposal-5",
    });
    const task = store.task(seeded.taskId);
    assert.equal(revised.updated, true);
    assert.equal(revised.taskId, seeded.taskId);
    assert.equal(task.taskRevision, 2);
    assert.equal(task.state, "queued-executor");
    assert.equal(task.assignmentId, null);
    assert.match(task.snapshot.confirmedIntent, /测试台保持通用工具/);
    assert.match(task.snapshot.constraints.at(-1), /^客户最新范围修订：/);
    assert.deepEqual(task.snapshot.acceptanceCriteria, ["韩立在真实页面核对结果"]);
    assert.equal(task.evolutionProposalId, "proposal-5");
    assert.equal(task.evolutionRoundId, "proposal-5");
    assert.equal(task.flowEvents.at(-1).type, "task.scope_revised");
    assert.equal(store.state().tasks.length, 1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("客户范围修订后迟到的旧执行结果只被丢弃，不触发令狐重复修复", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "scope-revision-late-result-"));
  let finishOldExecution;
  let oldExecutionStarted;
  const oldExecutionGate = new Promise((resolve) => { finishOldExecution = resolve; });
  const startedGate = new Promise((resolve) => { oldExecutionStarted = resolve; });
  try {
    const store = new CollaborationStore(path.join(directory, "collaboration.json"));
    const workspace = { workspaceId: "worktree:late-result", rootPath: directory, branchName: "codex/late-result", baseSha: "base", resultSha: null, createdAt: new Date().toISOString(), retiredAt: null };
    const coordinator = new CollaborationCoordinator({
      store,
      durations: { startWait: () => "wait", finish: () => undefined, start: () => "span", instant: () => undefined, interruptOpenSpans: () => undefined },
      workspaces: { prepareTask: async () => workspace, resumeTask: async () => workspace, commitTaskResult: async () => "result" },
      executor: new ExecutorFacade({
        createExecutor: async () => ({
          isAlive: () => true,
          analyze: async () => "按旧范围实施",
          optimize: async () => "",
          execute: async () => {
            oldExecutionStarted();
            return oldExecutionGate;
          },
          investigateRepair: async () => "不应进入修复",
          executeRepair: async () => ({ status: "code-verified", text: "不应进入修复", pendingActions: [], authorizedFiles: [] }),
          dispose: async () => undefined,
        }),
      }),
      integrationPipeline: { finishWaitingTask: () => undefined, trackWaitingTask: () => undefined, invalidateTask: () => undefined, schedule: () => undefined, dispose: () => undefined },
      createTaskRuleContext: () => ({
        activeUserId: "XUNAN", role: "executor", ruleRevision: "revision-one",
        mandatoryRoleRuleIds: ["AI_DESKTOP_EXECUTOR_SOURCE_IMPLEMENTATION_RULES"], matchedTaskRuleIds: [],
        dependencyRuleIds: [], loadedRuleHashes: {}, loadedRuleContents: {}, agentsContent: "# AGENTS", indexCatalog: "# index", ruleReceipt: [],
      }),
      emitState: () => undefined,
      emitStream: () => undefined,
    });
    const { state: submitted } = coordinator.submitTask({
      title: "修复验收卡点",
      problemStatement: "测试台被错误加入韩立验收。",
      confirmedIntent: "先按旧范围修复。",
      workspaceState,
      locale: "zh-CN",
      initiatorMemberId: "han-li",
      preferredExecutorMemberId: "linghu-ancestor",
      automationSource: "linghu-safeguard",
      evolutionProposalId: "proposal-late",
      evolutionRoundId: "proposal-late",
    });
    const seeded = submitted.tasks.at(-1);
    await startedGate;
    const revised = await coordinator.reviseActiveRepairScope({
      runId: "run-late",
      proposalId: "proposal-late",
      instruction: "停止旧范围，改查内部证据链。",
      confirmedIntent: "按新范围读取内部证据链。",
      acceptanceCriteria: ["新范围证据链完成验证"],
    });
    await coordinator.dispose();
    finishOldExecution({ status: "code-verified", text: "旧结果", pendingActions: [], authorizedFiles: [] });
    await new Promise((resolve) => setImmediate(resolve));
    const task = store.task(seeded.taskId);
    assert.equal(revised.updated, true);
    assert.equal(task.state, "queued-executor");
    assert.equal(task.taskRevision, 2);
    assert.equal(task.flowEvents.at(-1).type, "task.scope_revised");
    assert.equal(task.flowEvents.some((event) => event.type === "execution.repair_started"), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("客户范围修订后迟到的旧执行人初始化失败不会阻塞新范围", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "scope-revision-late-startup-"));
  let rejectOldStartup;
  let oldStartupStarted;
  const oldStartupGate = new Promise((_, reject) => { rejectOldStartup = reject; });
  const startedGate = new Promise((resolve) => { oldStartupStarted = resolve; });
  try {
    const store = new CollaborationStore(path.join(directory, "collaboration.json"));
    const workspace = { workspaceId: "worktree:late-startup", rootPath: directory, branchName: "codex/late-startup", baseSha: "base", resultSha: null, createdAt: new Date().toISOString(), retiredAt: null };
    const coordinator = new CollaborationCoordinator({
      store,
      durations: { startWait: () => "wait", finish: () => undefined, start: () => "span", instant: () => undefined, interruptOpenSpans: () => undefined },
      workspaces: { prepareTask: async () => workspace, resumeTask: async () => workspace, commitTaskResult: async () => "result" },
      executor: new ExecutorFacade({
        createExecutor: async () => {
          oldStartupStarted();
          return oldStartupGate;
        },
      }),
      integrationPipeline: { finishWaitingTask: () => undefined, trackWaitingTask: () => undefined, invalidateTask: () => undefined, schedule: () => undefined, dispose: () => undefined },
      createTaskRuleContext: () => ({
        activeUserId: "XUNAN", role: "executor", ruleRevision: "revision-one",
        mandatoryRoleRuleIds: ["AI_DESKTOP_EXECUTOR_SOURCE_IMPLEMENTATION_RULES"], matchedTaskRuleIds: [],
        dependencyRuleIds: [], loadedRuleHashes: {}, loadedRuleContents: {}, agentsContent: "# AGENTS", indexCatalog: "# index", ruleReceipt: [],
      }),
      emitState: () => undefined,
      emitStream: () => undefined,
    });
    const { state: submitted } = coordinator.submitTask({
      title: "修复长会话性能",
      problemStatement: "长会话切换变慢。",
      confirmedIntent: "保留历史并按需渲染。",
      workspaceState,
      locale: "zh-CN",
      initiatorMemberId: "han-li",
      preferredExecutorMemberId: "linghu-ancestor",
      automationSource: "linghu-safeguard",
      evolutionProposalId: "proposal-late-startup",
      evolutionRoundId: "proposal-late-startup",
    });
    const seeded = submitted.tasks.at(-1);
    await startedGate;
    await coordinator.dispose();
    const revised = await coordinator.reviseActiveRepairScope({
      runId: "run-late-startup",
      proposalId: "proposal-late-startup",
      instruction: "停止旧令狐执行，交由南宫婉调查后分配普通执行人。",
      confirmedIntent: "按新范围重新分配执行。",
      acceptanceCriteria: ["新范围由当前执行链完成"],
    });
    rejectOldStartup(new Error("旧执行人初始化失败"));
    await new Promise((resolve) => setImmediate(resolve));
    const task = store.task(seeded.taskId);
    assert.equal(revised.updated, true);
    assert.equal(task.state, "queued-executor");
    assert.equal(task.taskRevision, 2);
    assert.equal(task.flowEvents.at(-1).type, "task.scope_revised");
    assert.equal(task.flowEvents.some((event) => event.type === "task.blocked"), false);
  } finally {
    rejectOldStartup?.(new Error("测试结束"));
    rmSync(directory, { recursive: true, force: true });
  }
});

test("客户范围修订会取消已经排队但尚未开始的旧令狐恢复", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "scope-revision-pending-repair-"));
  let releaseClose;
  let reportCloseStarted;
  const closeGate = new Promise((resolve) => { releaseClose = resolve; });
  const closeStarted = new Promise((resolve) => { reportCloseStarted = resolve; });
  let closeReported = false;
  let executionCount = 0;
  let transientRepairCount = 0;
  try {
    const store = new CollaborationStore(path.join(directory, "collaboration.json"));
    const workspace = { workspaceId: "worktree:pending-repair", rootPath: directory, branchName: "codex/pending-repair", baseSha: "base", resultSha: null, createdAt: new Date().toISOString(), retiredAt: null };
    const executor = {
      open: async () => undefined,
      isAlive: () => true,
      session: () => ({}),
      analyze: async () => "按当前范围实施",
      execute: async () => {
        executionCount += 1;
        return executionCount === 1
          ? { status: "incomplete", text: "", pendingActions: ["旧执行失败"], authorizedFiles: [] }
          : { status: "code-verified", text: "新范围完成", pendingActions: [], authorizedFiles: [] };
      },
      close: async () => {
        if (!closeReported) {
          closeReported = true;
          reportCloseStarted();
        }
        await closeGate;
      },
      closeAll: async () => undefined,
      createTransient: async () => {
        transientRepairCount += 1;
        throw new Error("范围修订后不得创建旧令狐恢复会话");
      },
    };
    const coordinator = new CollaborationCoordinator({
      store,
      durations: { startWait: () => "wait", finish: () => undefined, start: () => "span", instant: () => undefined, interruptOpenSpans: () => undefined },
      workspaces: { prepareTask: async () => workspace, resumeTask: async () => workspace, commitTaskResult: async () => "result" },
      executor,
      integrationPipeline: { finishWaitingTask: () => undefined, trackWaitingTask: () => undefined, invalidateTask: () => undefined, schedule: () => undefined, dispose: () => undefined },
      createTaskRuleContext: () => ({
        activeUserId: "XUNAN", role: "executor", ruleRevision: "revision-one",
        mandatoryRoleRuleIds: ["AI_DESKTOP_EXECUTOR_SOURCE_IMPLEMENTATION_RULES"], matchedTaskRuleIds: [],
        dependencyRuleIds: [], loadedRuleHashes: {}, loadedRuleContents: {}, agentsContent: "# AGENTS", indexCatalog: "# index", ruleReceipt: [],
      }),
      emitState: () => undefined,
      emitStream: () => undefined,
    });
    const { state: submitted } = coordinator.submitTask({
      title: "修复验收卡点",
      problemStatement: "旧执行失败后准备交给令狐。",
      confirmedIntent: "按旧范围修复。",
      workspaceState,
      locale: "zh-CN",
      initiatorMemberId: "han-li",
      preferredExecutorMemberId: "linghu-ancestor",
      automationSource: "linghu-safeguard",
      evolutionProposalId: "proposal-pending-repair",
      evolutionRoundId: "proposal-pending-repair",
    });
    const seeded = submitted.tasks.at(-1);
    await closeStarted;
    const revision = coordinator.reviseActiveRepairScope({
      runId: "run-pending-repair",
      proposalId: "proposal-pending-repair",
      instruction: "停止旧恢复，按新范围继续。",
      confirmedIntent: "按新范围继续原任务。",
      acceptanceCriteria: ["原任务按新范围完成"],
    });
    await new Promise((resolve) => setImmediate(resolve));
    releaseClose();
    await revision;
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(transientRepairCount, 0);
    assert.equal(store.task(seeded.taskId).flowEvents.some((event) => event.type === "execution.repair_started"), false);
    await coordinator.dispose();
  } finally {
    releaseClose?.();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("清空测试数据保留人物配置并重置令狐运行态", () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "clear-test-data-"));
  try {
    const collaborationStore = new CollaborationStore(path.join(directory, "collaboration.json"));
    collaborationStore.setMode("collaboration");
    const custom = collaborationStore.state().members.find((member) => member.displayName === "墨大夫");
    collaborationStore.submitTask({ title: "待清空任务", problemStatement: "验证测试数据清理", confirmedIntent: "删除运行记录并保留配置", workspaceState, locale: "zh-CN" });
    assert.ok(collaborationStore.clearTestData() > 0);
    const collaborationState = new CollaborationStore(path.join(directory, "collaboration.json")).state();
    assert.equal(collaborationState.mode, "collaboration");
    assert.equal(collaborationState.tasks.length, 0);
    assert.equal(collaborationState.integrationBatches.length, 0);
    assert.ok(collaborationState.members.some((member) => member.memberId === custom.memberId));
    assert.ok(collaborationState.members.every((member) => member.currentTaskId === null));

    const linghuPath = path.join(directory, "linghu.json");
    const linghuStore = createTestLinghuStore(linghuPath);
    linghuStore.setEnabled(true);
    linghuStore.updateRuntime("test.runtime", (state) => { state.flowSnapshots.push({ sourceTaskId: "task-1", taskTitle: "旧任务", taskState: "executing", sourceGeneration: 1, sourceStage: "execution", sourceStatus: "started", sourceResultSha: null, completionConditions: [], observedAt: new Date().toISOString() }); });
    assert.ok(linghuStore.clearTestData() > 0);
    const linghuState = createTestLinghuStore(linghuPath).state();
    assert.equal(linghuState.enabled, false);
    assert.equal(linghuState.flowSnapshots.length, 0);
    assert.equal("prompts" in linghuState, false);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("令狐既有保障任务恢复进度，完成后无新故障不泛化派发", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "linghu-existing-progress-"));
  let facade;
  try {
    const collaborationStore = new CollaborationStore(path.join(directory, "collaboration.json"));
    const storePath = path.join(directory, "linghu.json");
    const automationStore = createTestLinghuStore(storePath);
    const seeded = collaborationStore.submitTask({ title: "已授权保障任务", problemStatement: "已有具体故障", confirmedIntent: "沿原任务恢复并验证", workspaceState, locale: "zh-CN", initiatorMemberId: "linghu-ancestor", preferredExecutorMemberId: "linghu-ancestor" });
    automationStore.updateRuntime("test.existing_task", (state) => { state.activeTaskId = seeded.taskId; });
    automationStore.setEnabled(true);
    let dispatched = 0;
    facade = new LinghuAutomationFacade({ store: automationStore,
      collaboration: { state: () => collaborationStore.state(), setMode: (mode) => collaborationStore.setMode(mode), submitTask() { dispatched++; throw Error("无新故障不应派发"); } },
      readWorkspaceState: () => workspaceState, locale: () => "zh-CN", recordEvent() {}, readTestResourceState: idleTestResourceState, runUnifiedTestAndRestart: async () => {},
    });
    await facade.checkNow();
    assert.equal(facade.state().flowSnapshots.length, 1);
    const restored = createTestLinghuStore(storePath).state();
    assert.equal(restored.activeTaskId, seeded.taskId);
    assert.equal(restored.enabled, true);
    assert.equal(restored.pollIntervalMs, 60_000);
    collaborationStore.updateTask(seeded.taskId, "test.integrated", (task) => { task.state = "integrated"; task.completedAt = new Date().toISOString(); task.finalResult = "已有任务完成"; });
    await facade.checkNow();
    assert.equal(dispatched, 0);
    assert.equal(facade.state().currentModule, "test-coverage");
    assert.equal(facade.state().lastModuleReport.module, "flow-completion");
    assert.equal(facade.state().activeTaskId, null);
  } finally { facade?.stop(); rmSync(directory, { recursive: true, force: true }); }
});

test("令狐旧审批链已退役，空闲巡检不创建泛化任务且不读取旧提案指针", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "linghu-retired-approval-"));
  let facade;
  try {
    const collaborationStore = new CollaborationStore(path.join(directory, "collaboration.json"));
    const statePath = path.join(directory, "linghu.json");
    const initial = createTestLinghuStore(statePath);
    initial.setEnabled(true);
    writeFileSync(statePath, JSON.stringify({ ...initial.state(), pendingRepairProposalId: "retired-proposal" }));
    const automationStore = createTestLinghuStore(statePath);
    let submitted = 0;
    facade = new LinghuAutomationFacade({ store: automationStore,
      collaboration: { state: () => collaborationStore.state(), setMode: (mode) => collaborationStore.setMode(mode), submitTask() { submitted++; throw Error("不得无事实创建任务"); } },
      readWorkspaceState: () => workspaceState, locale: () => "zh-CN", recordEvent() {}, readTestResourceState: idleTestResourceState, runUnifiedTestAndRestart: async () => {},
    });
    await facade.checkNow(); await facade.checkNow();
    assert.equal(submitted, 0);
    assert.equal("pendingRepairProposalId" in facade.state(), false);
    assert.equal("pendingRepairProposalId" in JSON.parse(readFileSync(statePath, "utf8")), false);
    assert.match(facade.state().blockingReason, /没有未完成任务/);
    assert.equal(collaborationStore.state().tasks.length, 0);
  } finally { facade?.stop(); rmSync(directory, { recursive: true, force: true }); }
});

test("退役文案字段不再读回，开关和运行恢复点保持", () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "linghu-retired-fields-"));
  const storePath = path.join(directory, "linghu.json");
  try {
    const original = createTestLinghuStore(storePath);
    original.setEnabled(true);
    original.updateRuntime("test.checkpoint", state => { state.recoveryCheckpoint = "active-task:T1"; });
    const persisted = JSON.parse(readFileSync(storePath, "utf8"));
    persisted.prompts = [{ promptId: "retired", content: "不得执行旧文案" }];
    persisted.activePromptId = "retired";
    writeFileSync(storePath, JSON.stringify(persisted), "utf8");
    const restored = createTestLinghuStore(storePath);
    assert.equal(restored.state().enabled, true);
    assert.equal(restored.state().recoveryCheckpoint, "active-task:T1");
    assert.equal("prompts" in restored.state(), false);
    assert.equal("activePromptId" in restored.state(), false);
    restored.setEnabled(false);
    assert.equal("prompts" in JSON.parse(readFileSync(storePath, "utf8")), false);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("令狐自动状态损坏时从最近有效备份恢复开启开关和检测恢复点", () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "linghu-backup-recovery-"));
  const storePath = path.join(directory, "linghu.json");
  try {
    const store = createTestLinghuStore(storePath);
    store.setEnabled(true);
    store.updateRuntime("test.checkpoint", (state) => {
      state.detectionCursor = "2026-08-23T10:00:00.000Z";
      state.recoveryCheckpoint = "active-task:TASK-1:flow-completion";
    });
    writeFileSync(storePath, "{损坏状态", "utf8");
    const restored = createTestLinghuStore(storePath).state();
    assert.equal(restored.enabled, true);
    assert.equal(restored.detectionCursor, "2026-08-23T10:00:00.000Z");
    assert.equal(restored.recoveryCheckpoint, "active-task:TASK-1:flow-completion");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("令狐自动状态主文件和备份均损坏时安全关闭并等待用户重新开启", () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "linghu-state-rebuild-"));
  const storePath = path.join(directory, "linghu.json");
  try {
    const store = createTestLinghuStore(storePath);
    store.setEnabled(true);
    writeFileSync(storePath, "{主文件损坏", "utf8");
    writeFileSync(`${storePath}.bak`, "{备份损坏", "utf8");
    const rebuilt = createTestLinghuStore(storePath).state();
    assert.equal(rebuilt.enabled, false);
    assert.match(rebuilt.blockingReason, /已安全关闭/);
    assert.equal(rebuilt.currentModule, "flow-completion");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("令狐对同一故障事实只派发一次但新技术事实可以继续修复", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "linghu-recovery-limit-"));
  try {
    const collaborationStore = new CollaborationStore(path.join(directory, "collaboration.json"));
    collaborationStore.setMode("collaboration");
    let recoveryRequests = 0;
    const collaboration = {
      state: () => collaborationStore.state(),
      setMode: (mode) => collaborationStore.setMode(mode),
      submitTask: (request) => {
        collaborationStore.submitTask(request);
        return collaborationStore.state();
      },
      continueTask: () => { recoveryRequests += 1; },
      recoverTask: () => { throw new Error("阻塞任务应走 continueTask 恢复入口"); },
    };
    const automationStore = createTestLinghuStore(path.join(directory, "linghu.json"));
    const facade = new LinghuAutomationFacade({
      store: automationStore,
      collaboration,
      readWorkspaceState: () => workspaceState,
      locale: () => "zh-CN",
      recordEvent: () => undefined,
      readTestResourceState: idleTestResourceState,
      runUnifiedTestAndRestart: async () => undefined,
    });
    automationStore.setEnabled(true);
    const seeded = collaborationStore.submitTask({ title: "已授权保障任务", problemStatement: "已有具体故障", confirmedIntent: "沿原任务恢复并验证", workspaceState, locale: "zh-CN", initiatorMemberId: "linghu-ancestor", preferredExecutorMemberId: "linghu-ancestor" });
    automationStore.updateRuntime("test.existing_task", (state) => { state.activeTaskId = seeded.taskId; });

    await facade.checkNow();
    collaborationStore.updateTask(facade.state().activeTaskId, "test.blocked", (task) => {
      task.state = "blocked";
      task.blockingReason = "固定基础设施故障";
    });
    await facade.checkNow();
    await facade.checkNow();
    await facade.checkNow();
    await facade.checkNow();
    assert.equal(recoveryRequests, 1);
    assert.equal(facade.state().enabled, true);
    assert.match(facade.state().blockingReason, /检测仍保持运行/);
    collaborationStore.updateTask(facade.state().activeTaskId, "test.phase_changed", (task) => {
      task.phase = "reviewing";
      task.workerGeneration += 1;
    });
    await facade.checkNow();
    assert.equal(recoveryRequests, 1, "阶段和执行代数变化不能重复派发同一故障");
    collaborationStore.updateTask(facade.state().activeTaskId, "test.new_failure", (task) => {
      task.blockingReason = "新的依赖文件缺失故障";
    });
    await facade.checkNow();
    assert.equal(recoveryRequests, 2, "新的失败事实应立即获得新的修复机会");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("统一测试失败即使日志引用用户规则也由令狐修复而不是误判为人工选择", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "linghu-test-repair-classification-"));
  try {
    const collaborationStore = new CollaborationStore(path.join(directory, "collaboration.json"));
    collaborationStore.setMode("collaboration");
    const submitted = collaborationStore.submitTask({
      title: "修复过期断言",
      problemStatement: "统一测试断言仍引用旧规则版本。",
      confirmedIntent: "令狐依据失败证据完成最小修复并重新统一测试。",
      workspaceState,
      locale: "zh-CN",
    });
    collaborationStore.updateTask(submitted.taskId, "test.failed", (task) => {
      task.state = "test-failed";
      task.blockingReason = "统一测试失败：规则正文包含用户明确选择；expected 5.100.0, actual 5.103.0";
      task.integrationFailure = { kind: "verification", detail: task.blockingReason, conflictFiles: [], baseSha: "base", resultSha: "result", generation: 1, occurredAt: new Date().toISOString() };
    });
    let repairRequests = 0;
    let retryOnlyRequests = 0;
    const collaboration = {
      state: () => collaborationStore.state(),
      setMode: (mode) => collaborationStore.setMode(mode),
      submitTask: (request) => { collaborationStore.submitTask(request); return collaborationStore.state(); },
      continueTask: () => { retryOnlyRequests += 1; return collaborationStore.state(); },
      repairTechnicalFailure: async (taskId) => {
        repairRequests += 1;
        collaborationStore.updateTask(taskId, "test.repaired", (task) => { task.state = "ready-for-integration"; task.blockingReason = null; });
        return true;
      },
    };
    const store = createTestLinghuStore(path.join(directory, "linghu.json"));
    store.setEnabled(true);
    const facade = new LinghuAutomationFacade({ store, collaboration, readWorkspaceState: () => workspaceState, locale: () => "zh-CN", recordEvent: () => undefined, readTestResourceState: idleTestResourceState, runUnifiedTestAndRestart: async () => undefined });
    await facade.checkNow();
    assert.equal(repairRequests, 1);
    assert.equal(retryOnlyRequests, 0);
    assert.equal(facade.state().flowSnapshots[0].blockingKind, "test");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("容量预检等待授权时令狐生成指导且不重复派发源码修复", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "linghu-capacity-waiting-"));
  try {
    const collaborationStore = new CollaborationStore(path.join(directory, "collaboration.json"));
    collaborationStore.setMode("collaboration");
    const submitted = collaborationStore.submitTask({ title: "等待开发包容量", problemStatement: "候选卷空间不足", confirmedIntent: "保留当前结果并等待授权处理空间", workspaceState, locale: "zh-CN" });
    collaborationStore.updateTask(submitted.taskId, "fixture.capacity_blocked", (task) => {
      task.state = "blocked";
      task.repairRequiresUserConfirmation = true;
      task.blockingReason = "开发包容量不足，等待保留策略授权";
      task.recoveryTargetState = "ready-for-integration";
      task.integrationFailure = {
        kind: "infrastructure", summary: "开发包容量不足，等待保留策略授权", impact: "容量预检在构建前停止；当前还缺少 346083328 字节可用空间。",
        recoveryAction: "由有保留策略权限的人员处理确认可释放的空间后重试。",
        capacity: { fileBytes: 1500782592, directoryBytes: 7880704, headroomBytes: 67108864, requiredBytes: 1575772160, availableBytes: 1229688832 },
        detail: "候选卷还缺少 346083328 字节可用空间", conflictFiles: [], baseSha: "base", resultSha: "result", generation: 174, occurredAt: new Date().toISOString(),
      };
    });
    let repairRequests = 0;
    let guidanceFacts = null;
    const collaboration = {
      state: () => collaborationStore.state(),
      setMode: (mode) => collaborationStore.setMode(mode),
      continueTask: () => collaborationStore.state(),
      recoverTask: () => collaborationStore.state(),
      repairTechnicalFailure: async () => { repairRequests += 1; throw new Error("容量等待不得进入源码修复"); },
      recordCustomerActionGuidance: (taskId, guidance) => collaborationStore.updateTask(taskId, "customer.capacity_action_required", (task) => { task.customerActionGuidance = guidance; }),
    };
    assert.throws(() => collaborationStore.continueTask(submitted.taskId), /客户前置条件/);
    const store = createTestLinghuStore(path.join(directory, "linghu.json"));
    store.setEnabled(true);
    const facade = new LinghuAutomationFacade({
      store, collaboration, readWorkspaceState: () => workspaceState, locale: () => "zh-CN", recordEvent: () => undefined,
      readTestResourceState: idleTestResourceState, runUnifiedTestAndRestart: async () => undefined,
      analyzeCustomerActionGuidance: async (facts) => {
        guidanceFacts = facts;
        return JSON.stringify({
        title: "等待保留策略授权", problem: "开发包容量预检已停止候选构建。", reasonCustomerMustAct: "只有具有保留策略权限的人员能确认哪些发布物可以处理。",
        steps: ["确认可处理的发布物范围。", "完成处理后重新执行统一测试。"], completionCriteria: ["容量预检通过。"],
        });
      },
    });
    await facade.checkNow();
    assert.equal(repairRequests, 0);
    assert.deepEqual(guidanceFacts.integrationFailure.capacity, { fileBytes: 1500782592, directoryBytes: 7880704, headroomBytes: 67108864, requiredBytes: 1575772160, availableBytes: 1229688832 });
    assert.match(guidanceFacts.integrationFailure.recoveryAction, /保留策略权限/);
    assert.equal(collaborationStore.state().tasks[0].customerActionGuidance?.title, "等待保留策略授权");
    assert.equal(facade.state().flowSnapshots[0].blockingKind, "business");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("同一统一测试故障只触发一次令狐源码修复", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "linghu-test-repair-limit-"));
  try {
    const collaborationStore = new CollaborationStore(path.join(directory, "collaboration.json"));
    collaborationStore.setMode("collaboration");
    const submitted = collaborationStore.submitTask({ title: "固定测试故障", problemStatement: "验证修复次数上限", confirmedIntent: "同一失败不得无限修改", workspaceState, locale: "zh-CN" });
    collaborationStore.updateTask(submitted.taskId, "fixture.test_failed", (task) => {
      task.state = "test-failed";
      task.blockingReason = "固定统一测试失败";
      task.integrationFailure = { kind: "verification", detail: task.blockingReason, conflictFiles: [], baseSha: "base", resultSha: "result", generation: 1, occurredAt: new Date().toISOString() };
    });
    let repairRequests = 0;
    const collaboration = {
      state: () => collaborationStore.state(),
      setMode: (mode) => collaborationStore.setMode(mode),
      submitTask: (request) => { collaborationStore.submitTask(request); return collaborationStore.state(); },
      repairTechnicalFailure: async () => { repairRequests += 1; return true; },
    };
    const store = createTestLinghuStore(path.join(directory, "linghu.json"));
    store.setEnabled(true);
    const facade = new LinghuAutomationFacade({ store, collaboration, readWorkspaceState: () => workspaceState, locale: () => "zh-CN", recordEvent: () => undefined, readTestResourceState: idleTestResourceState, runUnifiedTestAndRestart: async () => undefined });
    await facade.checkNow();
    await facade.checkNow();
    await facade.checkNow();
    await facade.checkNow();
    assert.equal(repairRequests, 1);
    assert.equal(facade.state().enabled, true);
    assert.match(facade.state().blockingReason, /不会重复派发相同操作/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("令狐为未登记本地修改直接生成客户处理步骤，不启动源码修复", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "linghu-local-change-ownership-"));
  try {
    const collaborationStore = new CollaborationStore(path.join(directory, "collaboration.json"));
    collaborationStore.setMode("collaboration");
    const submitted = collaborationStore.submitTask({
      title: "修正南宫婉截图入口的可用态辨识与忙碌反馈",
      problemStatement: "修复截图入口状态",
      confirmedIntent: "保持现有流程并完成集成",
      workspaceState,
      locale: "zh-CN",
      preferredExecutorMemberId: "mo-caihuan",
    });
    collaborationStore.updateTask(submitted.taskId, "fixture.integration_ownership_blocked", (task) => {
      task.state = "blocked";
      task.phase = "verifying";
      task.executorMemberId = "mo-caihuan";
      task.currentHandler = { memberId: "linghu-ancestor", displayName: "令狐老祖" };
      task.blockingReason = "合并前本地修改归属门禁阻塞：apps/ai-desktop/electron/main.ts 未登记到任何待集成任务";
      task.recoveryTargetState = "ready-for-integration";
      task.integrationFailure = { kind: "local-change-ownership", detail: task.blockingReason, workspaceRoot: projectRoot, conflictFiles: ["apps/ai-desktop/electron/main.ts"], baseSha: "base", resultSha: "result", generation: 1, occurredAt: new Date().toISOString() };
    });
    let continueRequests = 0;
    let repairRequests = 0;
    let guidanceAnalysisRequests = 0;
    let guidanceFacts = null;
    const events = [];
    const collaboration = {
      state: () => collaborationStore.state(),
      setMode: (mode) => collaborationStore.setMode(mode),
      continueTask: () => { continueRequests += 1; return collaborationStore.state(); },
      recoverTask: () => { continueRequests += 1; return collaborationStore.state(); },
      repairTechnicalFailure: async () => { repairRequests += 1; throw new Error("本地修改归属不得进入源码修复"); },
      recordCustomerActionGuidance: (taskId, guidance) => collaborationStore.updateTask(taskId, "customer.action_required", (task) => {
        task.customerActionGuidance = guidance;
        task.flowEvents.push({ eventId: guidance.guidanceId, type: "customer.action_required", stage: "recovery", status: "waiting", actor: guidance.generatedBy, summary: guidance.title, occurredAt: guidance.createdAt, error: false, details: { customerActionGuidance: guidance } });
      }),
    };
    const store = createTestLinghuStore(path.join(directory, "linghu.json"));
    store.setEnabled(true);
    const facade = new LinghuAutomationFacade({
      store, collaboration, readWorkspaceState: () => workspaceState, locale: () => "zh-CN",
      recordEvent: (type, details) => events.push({ type, details }), readTestResourceState: idleTestResourceState,
      runUnifiedTestAndRestart: async () => undefined,
      analyzeCustomerActionGuidance: async (facts) => {
        guidanceAnalysisRequests += 1;
        guidanceFacts = facts;
        return JSON.stringify({
          title: "等待客户提交本地修改",
          problem: "main.ts 的本地修改还没有归入可集成版本。",
          reasonCustomerMustAct: "只有客户能确认这份本地修改的归属并提交。",
          steps: ["确认 main.ts 属于当前专题。", "提交这份本地修改。"],
          completionCriteria: ["工作区中不再存在未提交的 main.ts 修改。"],
        });
      },
    });
    await facade.checkNow();
    await facade.checkNow();
    assert.equal(continueRequests, 0);
    assert.equal(repairRequests, 0);
    assert.equal(guidanceAnalysisRequests, 1);
    assert.equal(guidanceFacts.workspaceRoot, projectRoot);
    assert.deepEqual(guidanceFacts.uncommittedFiles, ["apps/ai-desktop/electron/main.ts"]);
    assert.deepEqual(guidanceFacts.absoluteFilePaths, [path.join(projectRoot, "apps/ai-desktop/electron/main.ts")]);
    assert.match(facade.state().blockingReason, /等待客户提交本地修改/);
    const blockedTask = collaborationStore.task(submitted.taskId);
    assert.equal(blockedTask.customerActionGuidance.generatedBy.memberId, "linghu-ancestor");
    assert.deepEqual(blockedTask.customerActionGuidance.steps, ["确认 main.ts 属于当前专题。", "提交这份本地修改。"]);
    assert.equal(blockedTask.customerActionGuidance.workspaceRoot, projectRoot);
    assert.deepEqual(blockedTask.customerActionGuidance.affectedFiles, ["apps/ai-desktop/electron/main.ts"]);
    assert.equal(blockedTask.customerActionGuidance.resumeLabel, "从卡点继续");
    assert.equal(events.filter((event) => event.type === "linghu.automation.customer_action_guidance_created").length, 1);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

// 从同一份隔离任务事实验证生成、持久化、继续门禁；模型输出是唯一替身。
function guidanceRecoveryFixture(directory, analyze, events) {
  const taskStore = new CollaborationStore(path.join(directory, "collaboration.json"));
  taskStore.setMode("collaboration");
  const task = taskStore.submitTask({ title: "恢复容量等待", problemStatement: "候选卷不足", confirmedIntent: "保留原提交恢复", workspaceState, locale: "zh-CN" });
  taskStore.updateTask(task.taskId, "fixture.blocked", (current) => {
    current.state = "blocked";
    current.repairRequiresUserConfirmation = true;
    current.blockingReason = "容量不足";
    current.integrationFailure = { kind: "infrastructure", detail: "还差108MB", conflictFiles: [], baseSha: "base", resultSha: "result", generation: 178, occurredAt: new Date().toISOString() };
  });
  const storePath = path.join(directory, "linghu.json");
  const createFacade = () => new LinghuAutomationFacade({
    store: createTestLinghuStore(storePath),
    collaboration: {
      state: () => taskStore.state(),
      recordCustomerActionGuidance: (id, guidance) => taskStore.updateTask(id, "customer.action_required", (current) => { current.customerActionGuidance = guidance; }),
    },
    readWorkspaceState: () => workspaceState, locale: () => "zh-CN",
    recordEvent: (type, details) => events.push({ type, details }),
    readTestResourceState: idleTestResourceState, runUnifiedTestAndRestart: async () => undefined,
    analyzeCustomerActionGuidance: analyze,
  });
  return { taskStore, taskId: task.taskId, createFacade };
}

const validRecoveryGuidance = {
  title: "确认可用空间", problem: "容量不足", reasonCustomerMustAct: "需要确认保留范围",
  steps: ["按已授权范围处理失效产物。"],
  completionCriteria: ["可用空间达到容量预检标准，所有权限和版本检查保持有效。"],
};

test("客户指导把现场否定句的具体拒绝原因交回令狐，修正后才保存恢复入口", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "guidance-feedback-"));
  try {
    const requests = [];
    const events = [];
    const fixture = guidanceRecoveryFixture(directory, async (facts) => {
      requests.push(facts);
      if (requests.length === 1) return JSON.stringify({ ...validRecoveryGuidance,
        completionCriteria: ["空间处理符合已确认的保留策略，且未自动删除内容、降低预检值、绕过权限或版本门禁。"] });
      assert.match(facts.generationFeedback.validationError, /completionCriteria\[0\]/);
      assert.match(facts.generationFeedback.validationError, /绕过权限/);
      return JSON.stringify(validRecoveryGuidance);
    }, events);
    const facade = fixture.createFacade();
    await facade.handleTaskCheckpoint(fixture.taskId);
    assert.equal(fixture.taskStore.task(fixture.taskId).customerActionGuidance, null);
    assert.throws(() => fixture.taskStore.continueTask(fixture.taskId), /客户前置条件/);
    // 新进程读取同一失败证据，不能退回无反馈的首次生成。
    const resumed = fixture.createFacade();
    await resumed.handleTaskCheckpoint(fixture.taskId);
    await resumed.handleTaskCheckpoint(fixture.taskId);
    assert.equal(requests.length, 2);
    assert.equal(requests[1].generationFeedback.attempt, 2);
    assert.deepEqual(fixture.taskStore.task(fixture.taskId).customerActionGuidance.completionCriteria, validRecoveryGuidance.completionCriteria);
    assert.equal(events.filter((event) => event.type === "linghu.automation.customer_action_guidance_created").length, 1);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("客户指导同一失败重启后不无限生成，新卡点证据允许继续", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "guidance-budget-"));
  try {
    let requests = 0;
    const events = [];
    const fixture = guidanceRecoveryFixture(directory, async () => {
      requests += 1;
      return JSON.stringify({ ...validRecoveryGuidance, steps: ["执行 git reset --hard"] });
    }, events);
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await fixture.createFacade().handleTaskCheckpoint(fixture.taskId);
    }
    assert.equal(requests, 3);
    assert.equal(events.filter((event) => event.type === "technical.exception").length, 1);
    assert.equal(fixture.taskStore.task(fixture.taskId).customerActionGuidance, null);
    assert.throws(() => fixture.taskStore.continueTask(fixture.taskId), /客户前置条件/);
    fixture.taskStore.updateTask(fixture.taskId, "fixture.new_evidence", (task) => {
      task.integrationFailure.detail = "容量已变化，新的失败原因";
    });
    await fixture.createFacade().handleTaskCheckpoint(fixture.taskId);
    assert.equal(requests, 4);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("指导分析期间故障已变化时，旧指导不能附加到新的等待节点", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "guidance-stale-"));
  try {
    const fixture = guidanceRecoveryFixture(directory, async () => {
      fixture.taskStore.updateTask(fixture.taskId, "fixture.replaced_failure", (task) => {
        task.integrationFailure.detail = "新的归属事实";
      });
      return JSON.stringify(validRecoveryGuidance);
    }, []);
    await fixture.createFacade().handleTaskCheckpoint(fixture.taskId);
    assert.equal(fixture.taskStore.task(fixture.taskId).customerActionGuidance, null);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("客户操作指导缺少步骤或包含破坏性操作时拒绝生成继续入口", () => {
  const linghu = { memberId: "linghu-ancestor", displayName: "令狐老祖" };
  assert.throws(() => parseCustomerActionGuidance(JSON.stringify({
    title: "等待客户处理", problem: "存在卡点", reasonCustomerMustAct: "需要客户决定", completionCriteria: ["已完成"],
  }), "fingerprint", linghu), /缺少 steps/);
  assert.throws(() => parseCustomerActionGuidance(JSON.stringify({
    title: "等待客户处理", problem: "存在卡点", reasonCustomerMustAct: "需要客户决定",
    steps: ["执行 git reset --hard"], completionCriteria: ["已完成"],
  }), "fingerprint", linghu), /危险或越权操作/);
});

test("令狐主动巡检关闭时仍自动修复在途任务的统一测试失败", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "linghu-test-repair-result-"));
  try {
    const store = new CollaborationStore(path.join(directory, "collaboration.json"));
    store.setMode("collaboration");
    const submitted = store.submitTask({ title: "修复统一测试", problemStatement: "修复过期断言", confirmedIntent: "只修复本次统一测试失败", workspaceState, locale: "zh-CN" });
    store.updateTask(submitted.taskId, "fixture.test_failed", (task) => {
      task.state = "test-failed";
      task.currentPlanVersion = 1;
      task.plans = [{ version: 1, ownerMemberId: "li-feiyu", ownerDisplayName: "厉飞雨", status: "approved", text: "保持原任务功能不变", contentHash: "plan", createdAt: new Date().toISOString() }];
      task.versionWorkspace = { workspaceId: "worktree:test", rootPath: directory, branchName: "codex/test", baseSha: "base-sha", resultSha: "old-result-sha", createdAt: new Date().toISOString(), retiredAt: null };
      task.blockingReason = "统一测试失败：expected 5.100.0, actual 5.103.0";
      task.integrationFailure = { kind: "verification", detail: task.blockingReason, conflictFiles: [], baseSha: "base-sha", resultSha: "old-result-sha", generation: 1, occurredAt: new Date().toISOString() };
    });
    let receivedRepairPlan = "";
    let investigatedFailure = "";
    let integrationSchedules = 0;
    const coordinator = new CollaborationCoordinator({
      store,
      durations: { startWait: () => "wait", finish: () => undefined, start: () => "span", instant: () => undefined, interruptOpenSpans: () => undefined },
      workspaces: { commitTaskResult: async () => "new-result-sha" },
      executor: new ExecutorFacade({ createExecutor: async () => ({ isAlive: () => true, analyze: async () => "", optimize: async () => "", execute: async () => { throw new Error("修复流程不得调用原专题 execute"); }, investigateRepair: async (_task, failure) => { investigatedFailure = failure; return "只修正失败断言并重跑原验证命令"; }, executeRepair: async (_task, diagnosis) => { receivedRepairPlan = diagnosis.repairInstruction; return { status: "code-verified", text: "断言已同步并完成代码级验证", pendingActions: [], changedFiles: ["tests/version.test.ts"], successfulCommands: ["npm test"] }; }, dispose: async () => undefined }) }),
      integrationPipeline: { finishWaitingTask: () => undefined, trackWaitingTask: () => undefined, schedule: () => { integrationSchedules += 1; }, dispose: () => undefined },
      emitState: () => undefined,
      emitStream: () => undefined,
    });
    await new Promise((resolve) => setImmediate(resolve));
    const repaired = store.task(submitted.taskId);
    assert.match(investigatedFailure, /expected 5\.100\.0, actual 5\.103\.0/);
    assert.match(receivedRepairPlan, /只修正失败断言/);
    assert.equal(repaired.state, "ready-for-integration");
    assert.equal(repaired.versionWorkspace.resultSha, "new-result-sha");
    assert.equal(repaired.integrationFailure, null);
    assert.equal(repaired.unifiedTest.status, "pending");
    assert.equal(repaired.flowEvents.some((event) => event.type === "unified_test.repair_completed"), true);
    assert.ok(integrationSchedules >= 1);
    await coordinator.dispose();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("执行修复单次未完成后由令狐保留恢复点且不错误归属原执行人", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "linghu-execution-recovery-"));
  try {
    const store = new CollaborationStore(path.join(directory, "collaboration.json"));
    store.setMode("collaboration");
    const workspace = { workspaceId: "worktree:recovery", rootPath: directory, branchName: "codex/recovery", baseSha: "base", resultSha: null, createdAt: new Date().toISOString(), retiredAt: null };
    const coordinator = new CollaborationCoordinator({
      store,
      durations: { startWait: () => "wait", finish: () => undefined, start: () => "span", instant: () => undefined, interruptOpenSpans: () => undefined },
      workspaces: { prepareTask: async () => workspace, resumeTask: async () => workspace, commitTaskResult: async () => "result" },
      executor: new ExecutorFacade({
        createExecutor: async (_task, member) => ({
          isAlive: () => true,
          analyze: async () => "只修改目标文件并完成代码级检查",
          optimize: async () => "",
          investigateRepair: async (_task, failure) => `调查结论：${failure}`,
          executeRepair: async () => ({ status: "incomplete", text: "等待权限", pendingActions: ["Codex requests command execution approval"], changedFiles: [], successfulCommands: [] }),
          execute: async () => member.memberId === "linghu-ancestor"
            ? { status: "partial", text: "等待权限", pendingActions: ["Codex requests command execution approval"] }
            : { status: "partial", text: "执行未完成", pendingActions: ["路径诊断失败"] },
          dispose: async () => undefined,
        }),
      }),
      integrationPipeline: { finishWaitingTask: () => undefined, trackWaitingTask: () => undefined, schedule: () => undefined, dispose: () => undefined },
      createTaskRuleContext: (taskRuleIds) => ({
        activeUserId: "XUNAN", role: "executor", ruleRevision: "revision-one",
        mandatoryRoleRuleIds: ["AI_DESKTOP_EXECUTOR_SOURCE_IMPLEMENTATION_RULES"], matchedTaskRuleIds: taskRuleIds,
        dependencyRuleIds: [], loadedRuleHashes: {}, loadedRuleContents: {}, agentsContent: "# AGENTS", indexCatalog: "# index", ruleReceipt: [],
      }),
      emitState: () => undefined,
      emitStream: () => undefined,
    });
    const { state: state } = coordinator.submitTask({ title: "权限恢复", problemStatement: "固定命令需要授权", confirmedIntent: "授权后继续原任务", workspaceState, locale: "zh-CN", preferredExecutorMemberId: "yuan-yao", taskRuleIds: ["WORKSPACE_RULE"] });
    const taskId = state.tasks.at(-1).taskId;
    assert.equal(store.task(taskId).snapshot.ruleContext.ruleRevision, "revision-one");
    assert.deepEqual(store.task(taskId).snapshot.ruleContext.matchedTaskRuleIds, ["WORKSPACE_RULE"]);
    for (let attempt = 0; attempt < 100 && store.task(taskId).state !== "recovering"; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 10));
    const task = store.task(taskId);
    assert.equal(task.state, "recovering");
    assert.equal(task.currentHandler.displayName, "令狐老祖");
    assert.equal(task.preferredExecutorMemberId, "linghu-ancestor");
    assert.match(task.blockingReason, /等待用户授权/);
    assert.equal(task.executionRecords[0].status, "blocked");
    assert.ok(task.executionRecords[0].completedAt);
    const waiting = task.flowEvents.find((event) => event.type === "execution.repair_waiting");
    assert.equal(waiting.actor.displayName, "令狐老祖");
    assert.equal(waiting.status, "waiting");
    assert.equal(task.flowEvents.some((event) => event.type === "task.blocked"), false);
    await coordinator.dispose();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("文件范围冲突立即等待用户确认且令狐不会排队等待自己", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "scope-confirmation-waiting-"));
  try {
    const store = new CollaborationStore(path.join(directory, "collaboration.json"));
    const result = {
      status: "incomplete",
      text: "真实 Git 发现新增契约文件",
      pendingActions: ["自动自修越过首次实施范围：contracts/acceptance.value.ts"],
      changedFiles: ["contracts/acceptance.value.ts", "acceptance.ts"],
      authorizedFiles: ["contracts/acceptance.value.ts", "acceptance.ts"],
      successfulCommands: [],
      failureKind: "scope-confirmation",
    };
    const coordinator = createExecutionResultCoordinator(directory, store, result);
    const { state: submitted } = coordinator.submitTask({
      title: "修复验收工具范围",
      problemStatement: "验收工具缺少拖拽契约",
      confirmedIntent: "保留现有修改并重新确认真实文件范围",
      workspaceState,
      locale: "zh-CN",
      preferredExecutorMemberId: "linghu-ancestor",
    });
    const taskId = submitted.tasks.at(-1).taskId;
    for (let attempt = 0; attempt < 100 && store.task(taskId).state !== "recovering"; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 10));
    const task = store.task(taskId);
    assert.equal(task.state, "recovering");
    assert.equal(task.repairRequiresUserConfirmation, true);
    assert.match(task.blockingReason, /需要用户重新确认本次真实文件范围/);
    assert.equal(task.flowEvents.some((event) => event.type === "execution.repair_queued"), false);
    assert.equal(store.state().members.find((member) => member.memberId === "linghu-ancestor").state, "idle");
    await coordinator.dispose();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("令狐自己的普通执行失败保留恢复点而不生成自等待任务", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "linghu-self-recovery-"));
  try {
    const store = new CollaborationStore(path.join(directory, "collaboration.json"));
    const result = {
      status: "incomplete",
      text: "当前修复仍未完成",
      pendingActions: ["固定测试仍然失败"],
      changedFiles: ["acceptance.ts"],
      authorizedFiles: ["acceptance.ts"],
      successfulCommands: [],
    };
    const coordinator = createExecutionResultCoordinator(directory, store, result);
    const { state: submitted } = coordinator.submitTask({
      title: "令狐继续修复",
      problemStatement: "固定测试仍然失败",
      confirmedIntent: "沿同一恢复点继续修复但禁止自等待",
      workspaceState,
      locale: "zh-CN",
      preferredExecutorMemberId: "linghu-ancestor",
    });
    const taskId = submitted.tasks.at(-1).taskId;
    for (let attempt = 0; attempt < 100 && store.task(taskId).state !== "recovering"; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 10));
    const task = store.task(taskId);
    assert.equal(task.state, "recovering");
    assert.equal(task.repairRequiresUserConfirmation, false);
    assert.match(task.blockingReason, /本次恢复未完成/);
    assert.equal(task.flowEvents.some((event) => event.type === "execution.repair_queued"), false);
    assert.doesNotMatch(task.blockingReason, /等待令狐老祖完成当前任务/);
    await coordinator.dispose();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("令狐活动任务记录缺失时保留恢复点且不在缺少故障证据时创建泛化任务", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "linghu-missing-task-"));
  try {
    const collaborationStore = new CollaborationStore(path.join(directory, "collaboration.json"));
    collaborationStore.setMode("collaboration");
    let hiddenTaskId = null;
    const collaboration = {
      state: () => {
        const state = collaborationStore.state();
        state.tasks = state.tasks.filter((task) => task.taskId !== hiddenTaskId);
        return state;
      },
      setMode: (mode) => collaborationStore.setMode(mode),
      submitTask: (request) => {
        collaborationStore.submitTask(request);
        return collaboration.state();
      },
      continueTask: (taskId) => collaborationStore.continueTask(taskId),
      recoverTask: () => { throw new Error("本场景不应进入停点恢复"); },
    };
    const automationStore = createTestLinghuStore(path.join(directory, "linghu.json"));
    const facade = new LinghuAutomationFacade({
      store: automationStore,
      collaboration,
      readWorkspaceState: () => workspaceState,
      locale: () => "zh-CN",
      recordEvent: () => undefined,
      readTestResourceState: idleTestResourceState,
      runUnifiedTestAndRestart: async () => undefined,
    });
    automationStore.setEnabled(true);
    const seeded = collaborationStore.submitTask({ title: "已授权保障任务", problemStatement: "已有具体故障", confirmedIntent: "沿原任务恢复并验证", workspaceState, locale: "zh-CN", initiatorMemberId: "linghu-ancestor", preferredExecutorMemberId: "linghu-ancestor" });
    automationStore.updateRuntime("test.existing_task", (state) => { state.activeTaskId = seeded.taskId; });

    await facade.checkNow();
    hiddenTaskId = facade.state().activeTaskId;
    await facade.checkNow();
    assert.equal(facade.state().activeTaskId, null);
    assert.match(facade.state().recoveryCheckpoint, /missing-task:/);
    assert.equal(collaborationStore.state().tasks.length, 1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("令狐活动任务被取消后释放失效指针且不重新创建已取消任务", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "linghu-cancelled-task-"));
  try {
    const collaborationStore = new CollaborationStore(path.join(directory, "collaboration.json"));
    collaborationStore.setMode("collaboration");
    const collaboration = {
      state: () => collaborationStore.state(),
      setMode: (mode) => collaborationStore.setMode(mode),
      submitTask: (request) => { collaborationStore.submitTask(request); return collaborationStore.state(); },
      continueTask: (taskId) => collaborationStore.continueTask(taskId),
      recoverTask: () => { throw new Error("本场景不应进入停点恢复"); },
    };
    const store = createTestLinghuStore(path.join(directory, "linghu.json"));
    const facade = new LinghuAutomationFacade({ store, collaboration, readWorkspaceState: () => workspaceState, locale: () => "zh-CN", recordEvent: () => undefined, readTestResourceState: idleTestResourceState, runUnifiedTestAndRestart: async () => undefined });
    store.setEnabled(true);
    const seeded = collaborationStore.submitTask({ title: "已授权保障任务", problemStatement: "已有具体故障", confirmedIntent: "沿原任务恢复并验证", workspaceState, locale: "zh-CN", initiatorMemberId: "linghu-ancestor", preferredExecutorMemberId: "linghu-ancestor" });
    store.updateRuntime("test.existing_task", (state) => { state.activeTaskId = seeded.taskId; });

    await facade.checkNow();
    const cancelledTaskId = facade.state().activeTaskId;
    collaborationStore.cancelTask(cancelledTaskId);
    await facade.checkNow();
    assert.notEqual(facade.state().activeTaskId, cancelledTaskId);
    assert.equal(facade.state().enabled, true);
    assert.equal(facade.state().flowSnapshots.some((snapshot) => snapshot.sourceTaskId === cancelledTaskId), false);
    assert.match(facade.state().recoveryCheckpoint, /cancelled-task:/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("令狐持续检测所有自动流程，并为非活动停点执行独立恢复", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "linghu-all-flows-"));
  try {
    const collaborationStore = new CollaborationStore(path.join(directory, "collaboration.json"));
    collaborationStore.setMode("collaboration");
    const recovered = [];
    const collaboration = {
      state: () => collaborationStore.state(),
      setMode: (mode) => collaborationStore.setMode(mode),
      submitTask: (request) => { collaborationStore.submitTask(request); return collaborationStore.state(); },
      continueTask: (taskId) => { recovered.push(taskId); return collaborationStore.continueTask(taskId); },
      recoverTask: async (taskId) => { recovered.push(taskId); },
    };
    const store = createTestLinghuStore(path.join(directory, "linghu.json"));
    const facade = new LinghuAutomationFacade({
      store,
      collaboration,
      readWorkspaceState: () => workspaceState,
      locale: () => "zh-CN",
      recordEvent: () => undefined,
      readTestResourceState: idleTestResourceState,
      runUnifiedTestAndRestart: async () => undefined,
    });
    store.setEnabled(true);
    const seeded = collaborationStore.submitTask({ title: "已授权保障任务", problemStatement: "已有具体故障", confirmedIntent: "沿原任务恢复并验证", workspaceState, locale: "zh-CN", initiatorMemberId: "linghu-ancestor", preferredExecutorMemberId: "linghu-ancestor" });
    store.updateRuntime("test.existing_task", (state) => { state.activeTaskId = seeded.taskId; });

    await facade.checkNow();
    const activeTaskId = facade.state().activeTaskId;
    const secondary = collaborationStore.submitTask({
      title: "另一条自动流程",
      problemStatement: "验证全量自动流程检测。",
      confirmedIntent: "流程停住时应由令狐自动恢复。",
      workspaceState,
      locale: "zh-CN",
      initiatorMemberId: "linghu-ancestor",
      preferredExecutorMemberId: "linghu-ancestor",
      automationSource: "linghu-safeguard",
    });
    collaborationStore.updateTask(secondary.taskId, "test.blocked", (task) => {
      task.state = "blocked";
      task.blockingReason = "基础设施连接中断";
    });
    await facade.checkNow();
    assert.deepEqual(recovered, [secondary.taskId]);
    assert.equal(facade.state().activeTaskId, activeTaskId);
    assert.equal(facade.state().flowSnapshots.length, 2);
    assert.equal(facade.state().recoveryAttemptsByFingerprint[facade.state().currentFaultFingerprint], 1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("令狐将依赖自动流程的修正任务纳入同一停点检测闭环", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "linghu-dependent-repair-"));
  try {
    const collaborationStore = new CollaborationStore(path.join(directory, "collaboration.json"));
    collaborationStore.setMode("collaboration");
    const recovered = [];
    const collaboration = {
      state: () => collaborationStore.state(),
      setMode: (mode) => collaborationStore.setMode(mode),
      submitTask: (request) => { collaborationStore.submitTask(request); return collaborationStore.state(); },
      continueTask: (taskId) => { recovered.push(taskId); return collaborationStore.continueTask(taskId); },
      recoverTask: async (taskId) => { recovered.push(taskId); },
    };
    const store = createTestLinghuStore(path.join(directory, "linghu.json"));
    const facade = new LinghuAutomationFacade({
      store,
      collaboration,
      readWorkspaceState: () => workspaceState,
      locale: () => "zh-CN",
      recordEvent: () => undefined,
      readTestResourceState: idleTestResourceState,
      runUnifiedTestAndRestart: async () => undefined,
    });
    store.setEnabled(true);
    await facade.checkNow();
    const sourceTaskId = facade.state().activeTaskId;
    const repair = collaborationStore.submitTask({
      title: "自动流程修正任务",
      problemStatement: "修正自动流程的已证实停点。",
      confirmedIntent: "本任务依赖令狐自动流程完成后恢复。",
      workspaceState,
      locale: "zh-CN",
      dependencyTaskIds: [sourceTaskId],
    });
    collaborationStore.updateTask(repair.taskId, "test.repair_blocked", (task) => {
      task.state = "blocked";
      task.phase = "implementing";
      task.blockingReason = "代码类型检查失败";
    });
    await facade.checkNow();
    assert.deepEqual(recovered, [repair.taskId]);
    assert.ok(facade.state().flowSnapshots.some((snapshot) => snapshot.sourceTaskId === repair.taskId));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("令狐测试漏点模块只运行固定统一测试并在恢复点持久化后受控重启", () => {
  const runner = readFileSync(new URL("../../../electron/services/support/capabilities/testing/internal/fixed-unified-test.runner.ts", import.meta.url), "utf8");
  const facade = readFileSync(new URL("../../../electron/services/personas/linghu/linghu-automation.facade.ts", import.meta.url), "utf8");
  const main = readFileSync(new URL("../../../electron/system/bootstrap/application-runtime.ts", import.meta.url), "utf8");
  const collaborationBootstrap = readFileSync(new URL("../../../electron/system/bootstrap/collaboration.bootstrap.ts", import.meta.url), "utf8");
  assert.doesNotMatch(runner, /confirmedIntent|prompt\.content/);
  assert.match(facade, /#completeModule[\s\S]*await this\.#runUnifiedTestAndRestart\(\(\) =>/);
  assert.match(facade, /automation\.unified_test_failed[\s\S]*currentModule = "flow-completion"/);
  assert.match(linghuRuntimeSource, /createFixedUnifiedTestRunner[\s\S]*await unifiedTests\.run\(\)[\s\S]*onVerified\(\)[\s\S]*options\.unifiedTest\.onVerified\(executable\)/);
  assert.match(main, /unifiedTest:[\s\S]*onVerified: \(executable\)[\s\S]*app\.relaunch\(\{ execPath: executable[\s\S]*app\.exit\(0\)/);
  assert.match(collaborationBootstrap, /IntegrationReleaseCoordinatorFacade[\s\S]*createReleaseBatchStore[\s\S]*createVersionIntegrationPipeline[\s\S]*acquireRelease[\s\S]*publishRelease/);
  assert.match(collaborationBootstrap, /runUnifiedTests\(rootPath\)[\s\S]*stageVerifiedDeveloperExecutable\(candidateExecutable, projectPaths\.buildRoot, releaseBatchId, candidate\.candidateSha\)/);
  assert.match(coordinatorSource, /integrationPipeline\.schedule\(\)/);
  assert.doesNotMatch(coordinatorSource, /createReleaseCandidate|promoteIntegrationCandidate|mergeIntoLocalBranch|releaseDocument\.state/);
  assert.match(integrationPipelineSource, /createReleaseCandidate[\s\S]*releaseDocument\.state = "testing"[\s\S]*promoteIntegrationCandidate[\s\S]*mergeIntoLocalBranch[\s\S]*releaseDocument\.state = "published"/);
  assert.doesNotMatch(integrationPipelineSource, /LINGHU_MEMBER_ID|linghu-ancestor|令狐老祖/);
  assert.match(releaseBatchStoreSource, /initiatorMemberId[\s\S]*state: "frozen", initiatorMemberId/);
  assert.doesNotMatch(releaseBatchStoreSource, /linghu-ancestor/);
  assert.match(facade, /automaticFlowSnapshots[\s\S]*faultFingerprint[\s\S]*moduleCompletionReport/);
  assert.match(collaborationBootstrap, /const testResources = new TestResourceCoordinatorFacade[\s\S]*createTaskWorktreeTestRunner\([\s\S]*verifyCandidate:[\s\S]*testResources\.run[\s\S]*runUnifiedTests\(rootPath\)/);
  assert.doesNotMatch(collaborationBootstrap, /TestExecutionGate|test-execution-gate/);
});

test("发布重启携带候选源码提交且只由同一运行版本完成健康验收", () => {
  const verifiedPackageSource = readFileSync(new URL("../../../electron/services/support/capabilities/release/internal/verified-package.release.ts", import.meta.url), "utf8");
  assert.match(startupContextSource, /--ai-desktop-runtime-sha=/);
  assert.match(startupContextSource, /resolvePublishedRuntimeSourceSha\(process\.resourcesPath, runtimeSourceShaArgument\)/);
  assert.match(verifiedPackageSource, /writePublishedRuntimeSourceManifest\(destinationRoot, runtimeSourceSha\)/);
  assert.match(applicationRuntimeSource, /publishRelease: \(executable, releaseBatchId, runtimeSourceSha\)/);
  assert.match(applicationRuntimeSource, /releaseRestartArguments\(projectRoot, runtimeSourceSha, process\.argv\)/);
  assert.match(applicationRuntimeSource, /resolveCleanRuntimeSourceSha\(projectRoot\)/);
  assert.match(applicationRuntimeSource, /源码尚未提交/);
  assert.match(integrationPipelineSource, /batch\.integrationSha === this\.#loadedRuntimeSha/);
  assert.match(integrationPipelineSource, /publishRelease\(publishedExecutable, releaseBatchId, candidate\.candidateSha\)/);
});

test("多个真实进程同时集成或发布时全局并发始终为一", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "integration-release-cross-process-"));
  try {
    const events = (await Promise.all([
      runReleaseWorker(directory, "release-1", 150),
      runReleaseWorker(directory, "release-2", 150),
      runReleaseWorker(directory, "release-3", 150),
    ])).flat();
    assert.equal(events.filter((event) => event.type === "integration.release.acquired").length, 3);
    assert.equal(events.filter((event) => event.type === "integration.release.released").length, 3);
    assert.ok(events.some((event) => event.type === "integration.release.contended"));
    const lifecycle = events.filter((event) => /\.(?:acquired|released)$/.test(event.type)).sort((left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt) || (left.type.endsWith("released") ? -1 : 1));
    let active = 0;
    let maximum = 0;
    for (const event of lifecycle) {
      active += event.type.endsWith("acquired") ? 1 : -1;
      maximum = Math.max(maximum, active);
      assert.ok(active >= 0);
    }
    assert.equal(active, 0);
    assert.equal(maximum, 1);
    assert.equal(new IntegrationReleaseCoordinatorFacade({ coordinationRoot: directory, recordEvent: () => undefined }).holder(), null);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("目标分支修改唯一属于待集成任务时转入任务分支并只生成一个提交", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "owned-local-change-"));
  const repositoryRoot = path.join(directory, "repository");
  const managedRoot = path.join(directory, "managed-worktrees");
  const taskRoot = path.join(managedRoot, "task-1");
  try {
    mkdirSync(path.join(repositoryRoot, "apps", "ai-desktop"), { recursive: true });
    writeFileSync(path.join(repositoryRoot, "apps", "ai-desktop", "owned.ts"), "export const value = 1;\n");
    git(repositoryRoot, "init");
    git(repositoryRoot, "config", "user.name", "AI Desktop Test");
    git(repositoryRoot, "config", "user.email", "ai-desktop-test@example.invalid");
    git(repositoryRoot, "add", "-A");
    git(repositoryRoot, "commit", "-m", "base");
    mkdirSync(managedRoot, { recursive: true });
    git(repositoryRoot, "worktree", "add", "-b", "codex/collab/task-1/worker/r1", taskRoot, "HEAD");
    writeFileSync(path.join(repositoryRoot, "apps", "ai-desktop", "owned.ts"), "export const value = 2;\n");
    const manager = new VersionWorkspaceManager(repositoryRoot, managedRoot);
    const beforeSha = git(taskRoot, "rev-parse", "HEAD");
    const result = await manager.transferOwnedLocalChanges([{
      taskId: "TASK-1",
      memberName: "紫灵",
      workspace: { workspaceId: "worktree:TASK-1:r1", rootPath: taskRoot, branchName: "codex/collab/task-1/worker/r1", baseSha: beforeSha, resultSha: beforeSha, createdAt: new Date().toISOString(), retiredAt: null },
      changedFiles: ["apps/ai-desktop/owned.ts"],
    }]);
    assert.equal(result.taskId, "TASK-1");
    assert.equal(git(taskRoot, "rev-list", "--count", `${beforeSha}..${result.resultSha}`), "1");
    assert.equal(git(repositoryRoot, "status", "--porcelain"), "");
    assert.equal(git(taskRoot, "status", "--porcelain"), "");
    assert.equal(readFileSync(path.join(taskRoot, "apps", "ai-desktop", "owned.ts"), "utf8"), "export const value = 2;\n");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("本地修改转交冲突时保留恢复快照且不污染活任务工作区", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "owned-local-change-conflict-"));
  const repositoryRoot = path.join(directory, "repository");
  const managedRoot = path.join(directory, "managed-worktrees");
  const taskRoot = path.join(managedRoot, "task-1");
  try {
    mkdirSync(path.join(repositoryRoot, "apps", "ai-desktop"), { recursive: true });
    writeFileSync(path.join(repositoryRoot, "apps", "ai-desktop", "owned.ts"), "export const value = 1;\n");
    git(repositoryRoot, "init");
    git(repositoryRoot, "config", "user.name", "AI Desktop Test");
    git(repositoryRoot, "config", "user.email", "ai-desktop-test@example.invalid");
    git(repositoryRoot, "add", "-A");
    git(repositoryRoot, "commit", "-m", "base");
    mkdirSync(managedRoot, { recursive: true });
    git(repositoryRoot, "worktree", "add", "-b", "codex/collab/task-1/worker/r1", taskRoot, "HEAD");
    writeFileSync(path.join(taskRoot, "apps", "ai-desktop", "owned.ts"), "export const value = 3;\n");
    git(taskRoot, "add", "-A");
    git(taskRoot, "commit", "-m", "task result");
    const resultSha = git(taskRoot, "rev-parse", "HEAD");
    writeFileSync(path.join(repositoryRoot, "apps", "ai-desktop", "owned.ts"), "export const value = 2;\n");
    const manager = new VersionWorkspaceManager(repositoryRoot, managedRoot);
    await assert.rejects(() => manager.transferOwnedLocalChanges([{
      taskId: "TASK-1", memberName: "紫灵",
      workspace: { workspaceId: "worktree:TASK-1:r1", rootPath: taskRoot, branchName: "codex/collab/task-1/worker/r1", baseSha: "base", resultSha, createdAt: new Date().toISOString(), retiredAt: null },
      changedFiles: ["apps/ai-desktop/owned.ts"],
    }]), LocalChangeOwnershipError);
    assert.equal(git(taskRoot, "status", "--porcelain"), "");
    assert.equal(git(taskRoot, "rev-parse", "HEAD"), resultSha);
    assert.equal(readFileSync(path.join(taskRoot, "apps", "ai-desktop", "owned.ts"), "utf8"), "export const value = 3;\n");
    assert.ok(git(repositoryRoot, "rev-parse", "-q", "--verify", "refs/stash"));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("目标分支修改无归属或多任务重叠时保持原状并阻止合并", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "unknown-local-change-"));
  const repositoryRoot = path.join(directory, "repository");
  try {
    mkdirSync(repositoryRoot, { recursive: true });
    writeFileSync(path.join(repositoryRoot, "unknown.txt"), "base\n");
    git(repositoryRoot, "init");
    git(repositoryRoot, "config", "user.name", "AI Desktop Test");
    git(repositoryRoot, "config", "user.email", "ai-desktop-test@example.invalid");
    git(repositoryRoot, "add", "-A");
    git(repositoryRoot, "commit", "-m", "base");
    writeFileSync(path.join(repositoryRoot, "unknown-a.txt"), "dirty\n");
    writeFileSync(path.join(repositoryRoot, "unknown-b.txt"), "dirty\n");
    writeFileSync(path.join(repositoryRoot, "unknown-c.txt"), "dirty\n");
    const manager = new VersionWorkspaceManager(repositoryRoot, path.join(directory, "managed-worktrees"));
    await assert.rejects(() => manager.transferOwnedLocalChanges([]), (error) => {
      assert.ok(error instanceof LocalChangeOwnershipError);
      assert.equal(error.workspaceRoot, repositoryRoot);
      assert.deepEqual(error.conflictFiles, ["unknown-a.txt", "unknown-b.txt", "unknown-c.txt"]);
      assert.match(error.message, /本批没有可核对的待集成任务/);
      assert.match(error.message, /unknown-a\.txt/u);
      assert.match(error.message, /unknown-b\.txt/u);
      assert.match(error.message, /unknown-c\.txt/u);
      assert.match(error.message, /本次观察到的本地修改/u);
      return true;
    });
    const status = git(repositoryRoot, "status", "--porcelain");
    assert.match(status, /unknown-a\.txt/u);
    assert.match(status, /unknown-b\.txt/u);
    assert.match(status, /unknown-c\.txt/u);
    assert.equal(readFileSync(path.join(repositoryRoot, "unknown-a.txt"), "utf8"), "dirty\n");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("同一版本已有首个发布候选时后续批次使用唯一代次分支", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "repeated-release-branch-"));
  const repositoryRoot = path.join(directory, "repository");
  const managedRoot = path.join(directory, "managed-worktrees");
  try {
    mkdirSync(repositoryRoot, { recursive: true });
    writeFileSync(path.join(repositoryRoot, "source.txt"), "base\n");
    git(repositoryRoot, "init");
    git(repositoryRoot, "config", "user.name", "AI Desktop Test");
    git(repositoryRoot, "config", "user.email", "ai-desktop-test@example.invalid");
    git(repositoryRoot, "add", "-A");
    git(repositoryRoot, "commit", "-m", "base");
    const oldIntegrationSha = git(repositoryRoot, "rev-parse", "HEAD");
    git(repositoryRoot, "branch", "codex/collab/integration", oldIntegrationSha);
    git(repositoryRoot, "branch", "release/0.1.1-rc");
    writeFileSync(path.join(repositoryRoot, "current.txt"), "current local head\n");
    git(repositoryRoot, "add", "-A");
    git(repositoryRoot, "commit", "-m", "current local head");
    const resultSha = git(repositoryRoot, "rev-parse", "HEAD");
    const manager = new VersionWorkspaceManager(repositoryRoot, managedRoot);
    const candidate = await manager.createReleaseCandidate("release-0.1.1-g7", "0.1.1", 7, [{ taskId: "TASK-7", versionWorkspace: { resultSha } }]);
    assert.equal(candidate.branchName, "release/0.1.1-rc-g7");
    assert.equal(candidate.baseSha, resultSha, "发布候选必须从当前干净本地分支开始，不能回退到旧集成指针");
    assert.equal(git(repositoryRoot, "rev-parse", candidate.branchName), candidate.candidateSha);
    await manager.retireCandidate(candidate);
    assert.equal(git(repositoryRoot, "rev-parse", "release/0.1.1-rc-g7"), candidate.candidateSha);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("发布候选拒绝任务工作区已有后续提交的过期结果快照", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "stale-task-result-"));
  const repositoryRoot = path.join(directory, "repository");
  const managedRoot = path.join(directory, "managed-worktrees");
  const taskRoot = path.join(managedRoot, "tasks", "task-stale", "r1");
  try {
    mkdirSync(repositoryRoot, { recursive: true });
    writeFileSync(path.join(repositoryRoot, "source.txt"), "base\n");
    git(repositoryRoot, "init");
    git(repositoryRoot, "config", "user.name", "AI Desktop Test");
    git(repositoryRoot, "config", "user.email", "ai-desktop-test@example.invalid");
    git(repositoryRoot, "add", "-A");
    git(repositoryRoot, "commit", "-m", "base");
    const baseSha = git(repositoryRoot, "rev-parse", "HEAD");
    mkdirSync(path.dirname(taskRoot), { recursive: true });
    git(repositoryRoot, "worktree", "add", "-b", "codex/collab/task-stale/worker/r1", taskRoot, "HEAD");
    writeFileSync(path.join(taskRoot, "source.txt"), "first repair\n");
    git(taskRoot, "add", "-A");
    git(taskRoot, "commit", "-m", "first repair");
    const resultSha = git(taskRoot, "rev-parse", "HEAD");
    writeFileSync(path.join(taskRoot, "source.txt"), "second repair\n");
    git(taskRoot, "add", "-A");
    git(taskRoot, "commit", "-m", "second repair");
    const workspaceHeadSha = git(taskRoot, "rev-parse", "HEAD");
    const manager = new VersionWorkspaceManager(repositoryRoot, managedRoot);
    await assert.rejects(
      () => manager.createReleaseCandidate("release-0.1.1-g11", "0.1.1", 11, [{
        taskId: "TASK-STALE",
        versionWorkspace: {
          workspaceId: "worktree:TASK-STALE:r1", rootPath: taskRoot, branchName: "codex/collab/task-stale/worker/r1",
          baseSha, resultSha, createdAt: new Date().toISOString(), retiredAt: null,
        },
      }]),
      (error) => {
        assert.ok(error instanceof StaleTaskResultError);
        assert.equal(error.taskId, "TASK-STALE");
        assert.equal(error.resultSha, resultSha);
        assert.equal(error.workspaceHeadSha, workspaceHeadSha);
        return true;
      },
    );
    assert.throws(() => git(repositoryRoot, "show-ref", "--verify", "refs/heads/release/0.1.1-rc-g11"));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("发布候选拒绝任务工作区中尚未冻结的修改", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "dirty-task-result-"));
  const repositoryRoot = path.join(directory, "repository");
  const managedRoot = path.join(directory, "managed-worktrees");
  const taskRoot = path.join(managedRoot, "tasks", "task-dirty", "r1");
  try {
    mkdirSync(repositoryRoot, { recursive: true });
    writeFileSync(path.join(repositoryRoot, "source.txt"), "base\n");
    git(repositoryRoot, "init");
    git(repositoryRoot, "config", "user.name", "AI Desktop Test");
    git(repositoryRoot, "config", "user.email", "ai-desktop-test@example.invalid");
    git(repositoryRoot, "add", "-A");
    git(repositoryRoot, "commit", "-m", "base");
    const baseSha = git(repositoryRoot, "rev-parse", "HEAD");
    mkdirSync(path.dirname(taskRoot), { recursive: true });
    git(repositoryRoot, "worktree", "add", "-b", "codex/collab/task-dirty/worker/r1", taskRoot, "HEAD");
    writeFileSync(path.join(taskRoot, "source.txt"), "uncommitted repair\n");
    const manager = new VersionWorkspaceManager(repositoryRoot, managedRoot);
    await assert.rejects(
      () => manager.createReleaseCandidate("release-0.1.1-g12", "0.1.1", 12, [{
        taskId: "TASK-DIRTY",
        versionWorkspace: {
          workspaceId: "worktree:TASK-DIRTY:r1", rootPath: taskRoot, branchName: "codex/collab/task-dirty/worker/r1",
          baseSha, resultSha: baseSha, createdAt: new Date().toISOString(), retiredAt: null,
        },
      }]),
      (error) => {
        assert.ok(error instanceof UncommittedTaskWorkspaceError);
        assert.equal(error.taskId, "TASK-DIRTY");
        assert.deepEqual(error.changedFiles, ["source.txt"]);
        return true;
      },
    );
    assert.throws(() => git(repositoryRoot, "show-ref", "--verify", "refs/heads/release/0.1.1-rc-g12"));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("失败候选清理保留成功证据、稳定集成指针和用户分支", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "clear-failed-candidates-"));
  const repositoryRoot = path.join(directory, "repository");
  const managedRoot = path.join(directory, "managed-worktrees");
  try {
    mkdirSync(repositoryRoot, { recursive: true });
    writeFileSync(path.join(repositoryRoot, "source.txt"), "base\n");
    git(repositoryRoot, "init");
    git(repositoryRoot, "config", "user.name", "AI Desktop Test");
    git(repositoryRoot, "config", "user.email", "ai-desktop-test@example.invalid");
    git(repositoryRoot, "add", "-A");
    git(repositoryRoot, "commit", "-m", "base");
    git(repositoryRoot, "branch", "release/0.1.1-rc");
    git(repositoryRoot, "branch", "release/0.1.1-rc-g9");
    git(repositoryRoot, "branch", "codex/collab/integration");
    git(repositoryRoot, "branch", "user-preserved");
    const failedWorktree = path.join(managedRoot, "release", "failed-g9");
    git(repositoryRoot, "worktree", "add", failedWorktree, "release/0.1.1-rc-g9");
    writeFileSync(path.join(failedWorktree, "untracked-test-evidence.txt"), "failed test artifact\n");
    const manager = new VersionWorkspaceManager(repositoryRoot, managedRoot);
    const result = await manager.clearFailedTestReleaseCandidates(["release/0.1.1-rc-g9"]);
    assert.deepEqual(result, { branchCount: 1, worktreeCount: 1, failures: [] });
    assert.equal(existsSync(failedWorktree), false);
    assert.throws(() => git(repositoryRoot, "show-ref", "--verify", "refs/heads/release/0.1.1-rc-g9"));
    assert.ok(git(repositoryRoot, "show-ref", "--verify", "refs/heads/release/0.1.1-rc"));
    assert.ok(git(repositoryRoot, "show-ref", "--verify", "refs/heads/codex/collab/integration"));
    assert.ok(git(repositoryRoot, "show-ref", "--verify", "refs/heads/user-preserved"));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("候选差异检查忽略基线前历史问题并完整显示本批错误", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "candidate-delta-check-"));
  try {
    git(directory, "init");
    git(directory, "config", "user.name", "AI Desktop Test");
    git(directory, "config", "user.email", "ai-desktop-test@example.invalid");
    writeFileSync(path.join(directory, "historical.txt"), "historical trailing space   \n");
    git(directory, "add", "-A");
    git(directory, "commit", "-m", "historical issue");
    writeFileSync(path.join(directory, "historical.txt"), "historical fixed\n");
    git(directory, "add", "-A");
    git(directory, "commit", "-m", "candidate baseline");
    const baseSha = git(directory, "rev-parse", "HEAD");
    writeFileSync(path.join(directory, "candidate.txt"), "candidate clean\n");
    git(directory, "add", "-A");
    git(directory, "commit", "-m", "clean candidate");
    const cleanCandidateSha = git(directory, "rev-parse", "HEAD");
    await verifyCandidateDelta(directory, { baseSha, candidateSha: cleanCandidateSha });

    writeFileSync(path.join(directory, "candidate.txt"), "candidate trailing space   \n");
    git(directory, "add", "-A");
    git(directory, "commit", "-m", "bad candidate");
    const badCandidateSha = git(directory, "rev-parse", "HEAD");
    await assert.rejects(
      verifyCandidateDelta(directory, { baseSha, candidateSha: badCandidateSha }),
      /candidate\.txt:1: trailing whitespace/,
    );
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("发布归档只把明确失败且建立过候选的分支交给测试清理", () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "failed-release-archive-"));
  try {
    const store = new ReleaseBatchStore(path.join(directory, "running"), path.join(directory, "archive"));
    const completedAt = "2026-08-30T01:00:00.000Z";
    const base = {
      version: "0.1.1", generation: 1, initiatorMemberId: "tester", candidateSha: "sha",
      localMergeSha: null, executable: null, tasks: [], startedAt: "2026-08-30T00:00:00.000Z", completedAt, failureReason: null,
    };
    store.write({ ...base, releaseBatchId: "failed", state: "failed", candidateBranch: "release/0.1.1-rc-g1", failureReason: "test failed" });
    store.write({ ...base, releaseBatchId: "published", state: "published", candidateBranch: "release/0.1.1-rc-g2" });
    store.write({ ...base, releaseBatchId: "prepare-failed", state: "failed", candidateBranch: null, candidateSha: null, failureReason: "candidate not created" });
    assert.deepEqual(store.failedCandidateBranches(), ["release/0.1.1-rc-g1"]);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("清空运行态后发布批次仍避让历史归档代次", () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "release-generation-reuse-"));
  try {
    const store = new ReleaseBatchStore(path.join(directory, "running"), path.join(directory, "archive"));
    store.write({
      releaseBatchId: "release-0.1.1-g2", version: "0.1.1", generation: 2, state: "failed", initiatorMemberId: "tester",
      candidateBranch: "release/0.1.1-rc-g2", candidateSha: "sha", localMergeSha: null, executable: null, tasks: [],
      startedAt: "2026-08-30T00:00:00.000Z", completedAt: "2026-08-30T01:00:00.000Z", failureReason: "historical failure",
    });
    assert.equal(store.nextAvailableGeneration("0.1.1", 2), 3);
    assert.match(integrationPipelineSource, /nextAvailableGeneration\(this\.#releaseVersion, state\.nextIntegrationGeneration\)/);
    assert.match(integrationPipelineSource, /mutable\.nextIntegrationGeneration = generation \+ 1/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("稳定发布应用缺少归档时仍占用批次代次，并按发布基础设施失败处理", () => {
  assert.match(releaseBatchStoreSource, /#hasStablePublishedApplication\(releaseBatchId: string\)/);
  assert.match(releaseBatchStoreSource, /#hasReleaseBatch\(`release-\$\{version\}-g\$\{generation\}`\) \|\| this\.#hasStablePublishedApplication/);
  assert.match(collaborationBootstrapSource, /createReleaseBatchStore\(projectPaths\.runningExecutionRoot, projectPaths\.archiveLogRoot, projectPaths\.buildRoot\)/);
  assert.match(verifiedPackageReleaseSource, /class StablePublishedApplicationCollisionError extends Error/);
  assert.match(integrationPipelineSource, /error instanceof StablePublishedApplicationCollisionError/);
});

test("一键清空把候选回收与数据库清理解耦并核对全部持久状态", () => {
  const main = readFileSync(new URL("../../../electron/system/bootstrap/application-runtime.ts", import.meta.url), "utf8");
  const resetService = readFileSync(new URL("../../../electron/services/support/application/test-data-reset.service.ts", import.meta.url), "utf8");
  assert.match(main, /releaseBatches\.failedCandidateBranches\(\)/);
  assert.match(main, /clearFailedTestReleaseCandidates/);
  assert.match(resetService, /cleanupCandidates\(\)[\s\S]*\.catch\(/);
  assert.match(main, /collaborationStore\.assertTestDataCleared\(\)/);
  assert.match(main, /evolutionStateStore\.assertTestDataCleared\(\)/);
  assert.match(main, /linghuRuntime!\.assertTestDataCleared\(\)/);
  assert.match(resetService, /candidateCleanupWarnings: candidateCleanup\.failures/);
});

test("已有同代候选工作树时分支与路径同步重试而不阻断统一测试", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "candidate-retry-branch-"));
  const repositoryRoot = path.join(directory, "repository");
  try {
    mkdirSync(repositoryRoot, { recursive: true });
    writeFileSync(path.join(repositoryRoot, "source.txt"), "base\n");
    git(repositoryRoot, "init");
    git(repositoryRoot, "config", "user.name", "AI Desktop Test");
    git(repositoryRoot, "config", "user.email", "ai-desktop-test@example.invalid");
    git(repositoryRoot, "add", "-A");
    git(repositoryRoot, "commit", "-m", "base");
    const resultSha = git(repositoryRoot, "rev-parse", "HEAD");
    git(repositoryRoot, "branch", "release/0.1.1-rc");
    git(repositoryRoot, "branch", "release/0.1.1-rc-g1");
    const managedRoot = path.join(directory, "managed-worktrees");
    const existingRoot = path.join(managedRoot, "release", "release-0.1.1-g1-retry");
    git(repositoryRoot, "worktree", "add", existingRoot, "release/0.1.1-rc-g1");
    const manager = new VersionWorkspaceManager(repositoryRoot, managedRoot);
    const candidate = await manager.createReleaseCandidate("release-0.1.1-g1-retry", "0.1.1", 1, [{ taskId: "TASK-RETRY", versionWorkspace: { resultSha } }]);
    assert.equal(candidate.branchName, "release/0.1.1-rc-g1-r2");
    assert.equal(path.basename(candidate.rootPath), "release-0.1.1-g1-retry-r2");
    assert.notEqual(candidate.rootPath, existingRoot);
    assert.equal(candidate.candidateSha, resultSha);
    await manager.retireCandidate(candidate);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("发布候选冲突在中止合并前保留冲突文件和非空诊断", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "merge-conflict-evidence-"));
  const repositoryRoot = path.join(directory, "repository");
  const managedRoot = path.join(directory, "managed-worktrees");
  try {
    mkdirSync(repositoryRoot, { recursive: true });
    writeFileSync(path.join(repositoryRoot, "shared.txt"), "base\n");
    git(repositoryRoot, "init");
    git(repositoryRoot, "config", "user.name", "AI Desktop Test");
    git(repositoryRoot, "config", "user.email", "ai-desktop-test@example.invalid");
    git(repositoryRoot, "add", "-A");
    git(repositoryRoot, "commit", "-m", "base");
    const baseSha = git(repositoryRoot, "rev-parse", "HEAD");
    git(repositoryRoot, "checkout", "-b", "task-result");
    writeFileSync(path.join(repositoryRoot, "shared.txt"), "task\n");
    git(repositoryRoot, "add", "-A");
    git(repositoryRoot, "commit", "-m", "task result");
    const resultSha = git(repositoryRoot, "rev-parse", "HEAD");
    git(repositoryRoot, "checkout", "-");
    writeFileSync(path.join(repositoryRoot, "shared.txt"), "main\n");
    git(repositoryRoot, "add", "-A");
    git(repositoryRoot, "commit", "-m", "main change");
    const manager = new VersionWorkspaceManager(repositoryRoot, managedRoot);
    await assert.rejects(
      () => manager.createReleaseCandidate("release-0.1.2-g8", "0.1.2", 8, [{ taskId: "TASK-CONFLICT", versionWorkspace: { resultSha } }]),
      (error) => {
        assert.ok(error instanceof MergeConflictError);
        assert.deepEqual(error.conflictFiles, ["shared.txt"]);
        assert.equal(error.baseSha, git(repositoryRoot, "rev-parse", "HEAD"));
        assert.equal(error.resultSha, resultSha);
        assert.match(error.message, /shared\.txt/);
        return true;
      },
    );
    assert.equal(git(repositoryRoot, "status", "--porcelain"), "");
    assert.notEqual(baseSha, resultSha);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("版本冲突恢复签发新修订而不重复集成旧 resultSha", () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "merge-conflict-correction-"));
  try {
    const store = new CollaborationStore(path.join(directory, "state.json"));
    const task = store.submitTask({ title: "冲突修正", problemStatement: "主线与任务同时修改文件", confirmedIntent: "必须以当前主线重新修正。", workspaceState, locale: "zh-CN" });
    store.updateTask(task.taskId, "test.merge_conflict", (current) => {
      current.state = "blocked";
      current.taskRevision = 1;
      current.workerGeneration = 2;
      current.versionWorkspace = { workspaceId: "old", rootPath: "/old", branchName: "codex/collab/old", baseSha: "base", resultSha: "old-result", createdAt: new Date().toISOString(), retiredAt: null };
      current.integrationFailure = { kind: "merge-conflict", detail: "conflict", conflictFiles: ["apps/ai-desktop/a.ts"], baseSha: "base", resultSha: "old-result", generation: 7, occurredAt: new Date().toISOString() };
    });
    const next = store.continueTask(task.taskId).tasks.find((candidate) => candidate.taskId === task.taskId);
    assert.equal(next.state, "queued-executor");
    assert.equal(next.taskRevision, 2);
    assert.equal(next.workerGeneration, 3);
    assert.equal(next.versionWorkspace, null);
    assert.equal(next.recoveryTargetState, "executing");
    assert.equal(next.preferredExecutorMemberId, "linghu-ancestor");
    assert.equal(next.currentHandler.displayName, "令狐老祖");
    assert.match(next.flowEvents.at(-1).summary, /禁止重复集成旧 resultSha/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("本地修改归属未形成客户操作指导时禁止进入虚假恢复", () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "ownership-recovery-gate-"));
  try {
    const store = new CollaborationStore(path.join(directory, "state.json"));
    const submitted = store.submitTask({ title: "本地修改归属", problemStatement: "等待客户提交本地修改", confirmedIntent: "客户完成后由令狐复查。", workspaceState, locale: "zh-CN" });
    store.updateTask(submitted.taskId, "fixture.ownership_blocked", (task) => {
      task.state = "blocked";
      task.integrationFailure = { kind: "local-change-ownership", detail: "main.ts 尚未提交", conflictFiles: ["main.ts"], baseSha: null, resultSha: null, generation: 1, occurredAt: new Date().toISOString() };
      task.blockingReason = "等待客户提交本地修改";
    });
    assert.throws(() => store.continueTask(submitted.taskId), /先按等待节点中的操作步骤/);
    const blocked = store.state().tasks.find((task) => task.taskId === submitted.taskId);
    assert.equal(blocked.state, "blocked");
    assert.equal(blocked.flowEvents.some((event) => event.type === "task.recovery_requested"), false);

    store.updateTask(submitted.taskId, "fixture.customer_guidance", (task) => {
      task.customerActionGuidance = {
        guidanceId: "customer-action:ownership", sourceFingerprint: "ownership", title: "请提交本地修改",
        problem: "本地文件尚未提交。", reasonCustomerMustAct: "只有客户能确认文件归属。", steps: ["提交本地文件。"],
        completionCriteria: ["工作区不再显示未提交文件。"], resumeLabel: "从卡点继续",
        generatedBy: { memberId: "linghu-ancestor", displayName: "令狐老祖" }, createdAt: new Date().toISOString(),
      };
    });
    const continued = store.continueTask(submitted.taskId, { memberId: "linghu-ancestor", displayName: "令狐老祖" }).tasks.find((task) => task.taskId === submitted.taskId);
    assert.equal(continued.state, "queued-executor");
    assert.equal(continued.customerActionGuidance, null);
    assert.match(continued.flowEvents.at(-1).summary, /令狐老祖正在复查客户处理结果/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("恢复旧版本地归属修复状态时只等待客户处理，不启动令狐源码修复", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "ownership-no-source-repair-"));
  let coordinator;
  try {
    const store = new CollaborationStore(path.join(directory, "state.json"));
    store.setMode("collaboration");
    const submitted = store.submitTask({ title: "本地修改归属", problemStatement: "主工作区有未登记文件", confirmedIntent: "等待文件所有者确认归属。", workspaceState, locale: "zh-CN" });
    store.updateTask(submitted.taskId, "fixture.legacy_ownership_repair", (task, state) => {
      task.state = "repairing-execution";
      task.phase = "analyzing";
      task.repairKind = "execution";
      task.repairFailureReason = "合并前无法确认本地修改归属";
      task.blockingReason = "合并前无法确认本地修改归属";
      task.versionWorkspace = { workspaceId: "legacy-worktree", rootPath: directory, branchName: "codex/legacy", baseSha: "base", resultSha: "result", createdAt: new Date().toISOString(), retiredAt: null };
      task.integrationFailure = { kind: "local-change-ownership", summary: "合并前无法确认本地修改归属", detail: "docs/问题.md 未登记", conflictFiles: ["docs/问题.md"], baseSha: "base", resultSha: "result", generation: 170, occurredAt: new Date().toISOString() };
      const linghu = state.members.find((member) => member.memberId === "linghu-ancestor");
      linghu.state = "working";
      linghu.role = "executor";
      linghu.phase = "analyzing";
      linghu.currentTaskId = task.taskId;
    });
    let executorCreated = false;
    coordinator = new CollaborationCoordinator({
      store,
      durations: { startWait: () => "wait", finish: () => undefined, start: () => "span", instant: () => undefined, interruptOpenSpans: () => undefined },
      workspaces: { commitTaskResult: async () => "unexpected-result" },
      executor: new ExecutorFacade({ createExecutor: async () => { executorCreated = true; throw new Error("本地归属等待不得创建源码修复会话"); } }),
      integrationPipeline: { finishWaitingTask: () => undefined, trackWaitingTask: () => undefined, schedule: () => undefined, dispose: () => undefined },
      emitState: () => undefined,
      emitStream: () => undefined,
    });

    coordinator.resumePendingWork();
    assert.equal(executorCreated, false);
    const blocked = store.task(submitted.taskId);
    assert.equal(blocked.state, "blocked");
    assert.equal(blocked.versionWorkspace.resultSha, "result");
    assert.equal(blocked.integrationFailure.kind, "local-change-ownership");
    assert.equal(store.state().members.find((member) => member.memberId === "linghu-ancestor").state, "idle");
    assert.equal(blocked.flowEvents.some((event) => event.type === "integration.local_change_ownership_wait_restored"), true);
    assert.equal(blocked.flowEvents.some((event) => event.type === "execution.repair_started"), false);
  } finally { await coordinator?.dispose(); rmSync(directory, { recursive: true, force: true }); }
});

test("重启后的恢复态合并冲突不依赖主动巡检或人工点击并自动交给令狐修正", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "merge-conflict-auto-correction-"));
  try {
    const store = new CollaborationStore(path.join(directory, "collaboration.json"));
    store.setMode("collaboration");
    const submitted = store.submitTask({ title: "自动修正冲突", problemStatement: "主线与任务结果修改同一文件", confirmedIntent: "令狐基于当前主线生成新结果", workspaceState, locale: "zh-CN" });
    store.updateTask(submitted.taskId, "fixture.merge_conflict", (task, state) => {
      task.state = "recovering";
      task.currentPlanVersion = 1;
      task.plans = [{ version: 1, ownerMemberId: "mo-caihuan", ownerDisplayName: "墨彩环", status: "approved", text: "保留双方有效修改并完成验证", contentHash: "plan", createdAt: new Date().toISOString() }];
      task.versionWorkspace = { workspaceId: "worktree:old", rootPath: "/old", branchName: "codex/old", baseSha: "old-base", resultSha: "old-result", createdAt: new Date().toISOString(), retiredAt: null };
      task.blockingReason = "版本候选合并发生冲突";
      task.integrationFailure = { kind: "merge-conflict", detail: "CONFLICT in shared.ts", conflictFiles: ["shared.ts"], baseSha: "current-main", resultSha: "old-result", generation: 5, occurredAt: new Date().toISOString() };
      for (const member of state.members.filter((candidate) => candidate.kind === "worker" && !["nangong-wan", "linghu-ancestor"].includes(candidate.memberId))) {
        member.state = "working";
        member.role = "executor";
        member.currentTaskId = `busy-${member.memberId}`;
      }
    });
    const workspace = { workspaceId: "worktree:fresh", rootPath: directory, branchName: "codex/fresh", baseSha: "current-main", resultSha: null, createdAt: new Date().toISOString(), retiredAt: null };
    let preparedFor = "";
    let executedBy = "";
    const coordinator = new CollaborationCoordinator({
      store,
      durations: { startWait: () => "wait", finish: () => undefined, start: () => "span", instant: () => undefined, interruptOpenSpans: () => undefined },
      workspaces: { prepareTask: async (_task, memberId) => { preparedFor = memberId; return workspace; }, resumeTask: async () => { throw new Error("冲突修正禁止复用旧工作区"); }, commitTaskResult: async () => "new-result" },
      executor: new ExecutorFacade({ createExecutor: async (_task, member) => ({ isAlive: () => true, analyze: async () => { throw new Error("已有方案时不得重新分析原专题"); }, optimize: async () => "", investigateRepair: async () => "", executeRepair: async () => { throw new Error("冲突修正走新工作区执行"); }, execute: async () => { executedBy = member.memberId; return { status: "code-verified", text: "冲突已修正", pendingActions: [], changedFiles: ["shared.ts"], successfulCommands: ["npm test"] }; }, dispose: async () => undefined }) }),
      integrationPipeline: { finishWaitingTask: () => undefined, trackWaitingTask: () => undefined, schedule: () => undefined, dispose: () => undefined },
      emitState: () => undefined,
      emitStream: () => undefined,
    });
    for (let attempt = 0; attempt < 100 && store.task(submitted.taskId).state !== "ready-for-integration"; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 10));
    const corrected = store.task(submitted.taskId);
    assert.equal(preparedFor, "linghu-ancestor");
    assert.equal(executedBy, "linghu-ancestor");
    assert.equal(corrected.versionWorkspace.baseSha, "current-main");
    assert.equal(corrected.versionWorkspace.resultSha, "new-result");
    assert.equal(corrected.state, "ready-for-integration");
    assert.equal(corrected.integrationFailure, null);
    assert.equal(corrected.flowEvents.filter((event) => event.type === "integration.conflict_correction_requested").length, 1);
    await coordinator.dispose();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("已验证候选应用先提升到稳定批次目录再允许回收候选", () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "verified-package-stage-"));
  const candidateRoot = path.join(directory, "candidate");
  const sourceExecutable = path.join(candidateRoot, "build", "ai-desktop", "package", "developer", "mac-arm64", "AI Desktop.app", "Contents", "MacOS", "AI Desktop");
  const stableBuildRoot = path.join(directory, "stable-build");
  try {
    mkdirSync(path.dirname(sourceExecutable), { recursive: true });
    writeFileSync(sourceExecutable, "verified candidate");
    const sourceFrameworkRoot = path.join(candidateRoot, "build", "ai-desktop", "package", "developer", "mac-arm64", "AI Desktop.app", "Contents", "Frameworks", "Electron Framework.framework");
    const sourceFrameworkBinary = path.join(sourceFrameworkRoot, "Versions", "A", "Electron Framework");
    mkdirSync(path.dirname(sourceFrameworkBinary), { recursive: true });
    writeFileSync(sourceFrameworkBinary, "verified framework");
    symlinkSync(sourceFrameworkBinary, path.join(sourceFrameworkRoot, "Versions", "Current"));
    symlinkSync(sourceFrameworkBinary, path.join(sourceFrameworkRoot, "Electron Framework"));
    const stagedExecutable = stageVerifiedDeveloperExecutable(sourceExecutable, stableBuildRoot, "release-0.1.1-g14", "a".repeat(40));
    const stagedApp = path.resolve(path.dirname(stagedExecutable), "../..");
    const stagedFrameworkLink = path.join(stagedApp, "Contents", "Frameworks", "Electron Framework.framework", "Electron Framework");
    assert.equal(readFileSync(stagedExecutable, "utf8"), "verified candidate");
    assert.equal(path.isAbsolute(readlinkSync(stagedFrameworkLink)), false, "稳定应用必须把候选绝对链接改写为应用包内相对链接");
    assert.match(stagedExecutable, /package\/published\/release-0\.1\.1-g14\/AI Desktop\.app\/Contents\/MacOS\/AI Desktop$/);
    rmSync(candidateRoot, { recursive: true, force: true });
    assert.equal(existsSync(sourceExecutable), false);
    assert.equal(readFileSync(stagedExecutable, "utf8"), "verified candidate", "候选回收后稳定发布程序必须继续存在");
    assert.equal(readFileSync(stagedFrameworkLink, "utf8"), "verified framework", "候选回收后稳定应用的框架链接必须仍可解析");
    assert.throws(() => stageVerifiedDeveloperExecutable(stagedExecutable, stableBuildRoot, "release-0.1.1-g14", "a".repeat(40)), /禁止覆盖/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("三个真实进程同时申请测试资源时全局并发始终为一并留下结构化事件", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "test-resource-cross-process-"));
  const coordinationRoot = path.join(directory, "运行中", "测试", "_资源协调");
  const buildRoot = path.join(directory, "build", "ai-desktop");
  try {
    const batches = await Promise.all([
      runCoordinatorWorker(coordinationRoot, "RUN-A", buildRoot, 160),
      runCoordinatorWorker(coordinationRoot, "RUN-B", buildRoot, 160),
      runCoordinatorWorker(coordinationRoot, "RUN-C", buildRoot, 160),
    ]);
    const events = batches.flat();
    assert.equal(events.filter((event) => event.type === "test.resource.queued").length, 3);
    assert.equal(events.filter((event) => event.type === "test.resource.acquired").length, 3);
    assert.equal(events.filter((event) => event.type === "test.resource.released").length, 3);
    assert.ok(events.some((event) => event.type === "test.resource.contended"), "并发申请必须记录真实冲突");

    const lifecycle = events
      .filter((event) => event.type === "test.resource.acquired" || event.type === "test.resource.released")
      .sort((left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt)
        || (left.type === "test.resource.released" ? -1 : 1));
    let active = 0;
    let maximumActive = 0;
    for (const event of lifecycle) {
      active += event.type === "test.resource.acquired" ? 1 : -1;
      maximumActive = Math.max(maximumActive, active);
      assert.ok(active >= 0, "释放事件不能早于对应占用事件");
    }
    assert.equal(active, 0);
    assert.equal(maximumActive, 1);
    assert.ok(events.every((event) => event.buildRoot === buildRoot && event.port === 4197));
    assert.ok(events.filter((event) => event.type === "test.resource.released").every((event) => event.executionDurationMs >= 150));
    const observer = new TestResourceCoordinatorFacade({ coordinationRoot, recordEvent: () => undefined });
    assert.equal(observer.state().holder, null);
    assert.equal(observer.state().waiters.length, 0);
    assert.equal(observer.state().lastEvent.type, "released");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("持有测试资源期间持续更新进程心跳并在释放事件记录性能", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "test-resource-heartbeat-"));
  const events = [];
  try {
    const coordinator = new TestResourceCoordinatorFacade({
      coordinationRoot: path.join(directory, "_资源协调"),
      recordEvent: (type, details) => events.push({ type, ...details }),
      heartbeatIntervalMs: 10,
      pollIntervalMs: 5,
    });
    let acquiredHeartbeat = "";
    let updatedHeartbeat = "";
    await coordinator.run({
      runId: "RUN-HEARTBEAT",
      taskId: "TASK-HEARTBEAT",
      initiatorMemberId: "test-heartbeat",
      kind: "task-validation",
      port: 4197,
      buildRoot: path.join(directory, "build"),
    }, async () => {
      acquiredHeartbeat = coordinator.state().holder.heartbeatAt;
      await new Promise((resolve) => setTimeout(resolve, 45));
      updatedHeartbeat = coordinator.state().holder.heartbeatAt;
    });
    assert.ok(Date.parse(updatedHeartbeat) > Date.parse(acquiredHeartbeat));
    const released = events.find((event) => event.type === "test.resource.released");
    assert.ok(released.executionDurationMs >= 40);
    assert.equal(coordinator.state().holder, null);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("活跃跨进程占用超过等待上限时记录超时而不破坏持有者锁", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "test-resource-timeout-"));
  const coordinationRoot = path.join(directory, "_资源协调");
  const lockRoot = path.join(coordinationRoot, "全局测试资源.lock");
  const events = [];
  try {
    mkdirSync(lockRoot, { recursive: true });
    const now = new Date().toISOString();
    writeFileSync(path.join(lockRoot, "owner.json"), JSON.stringify({
      leaseId: "LIVE-HOLDER",
      runId: "RUN-HOLDER",
      taskId: "TASK-HOLDER",
      initiatorMemberId: "test-holder",
      kind: "task-validation",
      port: 4197,
      buildRoot: path.join(directory, "build", "holder"),
      processId: process.pid,
      queuedAt: now,
      acquiredAt: now,
      heartbeatAt: now,
    }), "utf8");
    const coordinator = new TestResourceCoordinatorFacade({
      coordinationRoot,
      recordEvent: (type, details) => events.push({ type, ...details }),
      acquireTimeoutMs: 80,
      staleHeartbeatMs: 20,
      heartbeatIntervalMs: 10,
      pollIntervalMs: 10,
    });
    await assert.rejects(() => coordinator.run({
      runId: "RUN-WAITER",
      taskId: "TASK-WAITER",
      initiatorMemberId: "test-waiter",
      kind: "integration-validation",
      port: 4197,
      buildRoot: path.join(directory, "build", "waiter"),
    }, async () => undefined), /等待全局测试资源超时/);
    assert.ok(events.some((event) => event.type === "test.resource.contended"));
    assert.ok(events.some((event) => event.type === "test.resource.timeout"));
    assert.equal(JSON.parse(readFileSync(path.join(lockRoot, "owner.json"), "utf8")).leaseId, "LIVE-HOLDER");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("进程在写入持有者记录前退出时能够恢复孤儿锁", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "test-resource-orphan-"));
  const coordinationRoot = path.join(directory, "_资源协调");
  const lockRoot = path.join(coordinationRoot, "全局测试资源.lock");
  const events = [];
  try {
    mkdirSync(lockRoot, { recursive: true });
    await new Promise((resolve) => setTimeout(resolve, 35));
    const coordinator = new TestResourceCoordinatorFacade({
      coordinationRoot,
      recordEvent: (type, details) => events.push({ type, ...details }),
      acquireTimeoutMs: 1_000,
      staleHeartbeatMs: 20,
      heartbeatIntervalMs: 10,
      pollIntervalMs: 5,
    });
    let executed = false;
    await coordinator.run({
      runId: "RUN-ORPHAN-RECOVERY",
      taskId: "TASK-ORPHAN-RECOVERY",
      initiatorMemberId: "test-recovery",
      kind: "task-validation",
      port: 4197,
      buildRoot: path.join(directory, "build"),
    }, async () => { executed = true; });
    assert.equal(executed, true);
    assert.ok(events.some((event) => event.type === "test.resource.stale-recovered" && event.reason === "owner_record_missing"));
    assert.equal(coordinator.state().holder, null);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("令狐自动保障用户层规则登记全量检测、故障指纹、损坏恢复与固定报告", () => {
  const rule = [
    "RUL_AIDesktop官方Harness接入规则.md",
    "RUL_AIDesktop事件记忆与统一界面规则.md",
    "RUL_AIDesktopHarness工作区与运行时规则.md",
    "RUL_AIDesktop协作与自动化规则.md",
    "RUL_AIDesktop截图与输入规则.md",
    "RUL_AIDesktop演化持久化与发布规则.md",
    "RUL_AIDesktop韩立用户代理提问规则.md",
    "RUL_AIDesktop架构边界与客户规则交付规则.md",
  ].map((fileName) => readFileSync(new URL(`../../../ruleengine/rules/local/${activeStableUserId}/selplat/应用/ai-desktop/rule/${fileName}`, import.meta.url), "utf8")).join("\n");
  assert.match(rule, /^rule_version = \d+\.\d+\.\d+$/m);
  assert.match(rule, /ai_desktop_shared_conversation_component_contract = selConversation_registered_before_implementation \+ every_persona_uses_same_generic_contract_hook_and_persona_id_parameter/);
  assert.match(rule, /nangong_distribution_planning_contract = AI_read_only_investigation/);
  assert.match(rule, /linghu_exception_intake_loop_prevention_contract = single_event_center_entry/);
  assert.match(rule, /changed_lock_upgrade_uses_registered_worktree_owned_lock_hash_cache_without_shared_lease_identity/);
  assert.match(rule, /evolution_workspace_retirement_contract = no_evolution_workspace_window_route_tree_grid_dossier_topic_group_or_manual_console/);
  assert.match(rule, /ai_desktop_test_data_reset_contract = settings_danger_action_with_SELUI_confirm/);
  assert.match(rule, /evolution_workspace_hard_retirement_contract = remove_window_route_components_desktop_api_preload_IPC_query_preference_table_and_capability/);
  assert.match(rule, /respectful_listening_and_correction_are_nangong_personality/);
  assert.match(rule, /reflect_current_concern_not_mechanical_template/);
  assert.match(rule, /never_expand_user_intent/);
  assert.match(rule, /character_training_corpus_ingestion_contract = main_character_visible_conversation_only \+ unified_topic_and_message_tables_with_open_source_speaker_and_evidence_tier/);
  assert.match(rule, /persona_semantic_memory_human_trigger_contract = completed_user_with_nangong_or_user_with_hanli_round_only[\s\S]*real_user_message_required[\s\S]*persona_to_persona_business_archive_only[\s\S]*no_training_topic_message_or_semantic_refresh_for_internal_persona_exchange/);
  assert.match(rule, /hanli_deliberation_reactivation_boundary_contract = preserve_historical_query_and_audit[\s\S]*no_unconfirmed_legacy_background_flow[\s\S]*standalone_1_or_enabled_custody_with_ready_current_goal_starts_existing_unified_runtime[\s\S]*retired_four_automation_switches_never_restored[\s\S]*no_internal_training_corpus_write_or_semantic_refresh/);
  assert.match(rule, /hanli_nangong_continuous_deliberation_contract = hanli_conversation_maturity_invitation[\s\S]*standalone_1_starts_user_anchored_read_only_deliberation[\s\S]*continuous_switch_restarts_discovery_after_completion[\s\S]*no_new_evidence_waits_and_rechecks_without_inventing_problem/);
  assert.match(rule, /workflow_event_center_single_entry_contract = EventCenterFacade_to_archive_and_main_process_SQLite/);
  assert.match(rule, /opt_in_codex_work_desktop_current_workspace_task_complete_watch_plus_startup_backfill/);
  assert.match(rule, /codex_app_ingestion_default_off_and_user_toggleable/);
  assert.match(rule, /workflow_event_center_stall_contract = independent_30_second_supervisor_plus_120_second_timeout_plus_fault_fact_dedup_plus_linghu_handoff/);
  assert.match(rule, /nangong_next_evolution_launcher_contract = completed_and_accepted_plus_automatic_evolution_enabled_plus_reciprocal_topic_ids_plus_idempotent_restart/);
  assert.match(rule, /nangong_one_shot_complete_evolution_contract = AI_semantic_maturity_then_canonical_visible_invitation_creates_persisted_waiting_confirmation[^\n]*exact_standalone_1_consumes_confirmation_as_conversation_to_topic_authority_and_unified_continuous_runtime_start[^\n]*no_hidden_metadata_readiness_field[^\n]*no_parallel_approval_distribution_recovery_or_acceptance_route/);
  assert.match(rule, /blocked_task_records_one_unified_failure_and_never_directly_recovers_on_state_change/);
  assert.match(rule, /collaboration_member_self_upgrade_contract = all_registered_members_same_domain_flow[\s\S]*no_display_name_business_branch/);
  assert.match(rule, /linghu_integration_release_contract = IntegrationReleaseCoordinatorFacade_single_entry[\s\S]*unified_tests_package_and_verification_run_on_candidate_root/);
  assert.match(rule, /collaboration_clean_merge_contract = changed_task_worktree_creates_exactly_one_final_local_commit[\s\S]*unknown_overlap_multi_task_or_dirty_task_worktree_blocks_without_guessing/);
  assert.match(rule, /linghu_automation_module_cycle_contract = all_persons_flow_completion_first -> test_coverage_gap_and_capability_upgrade -> audit_log_completeness/);
  assert.match(rule, /linghu_test_capability_upgrade_contract = TestResourceCoordinatorFacade_single_entry/);
  assert.match(rule, /linghu_automation_flow_snapshot_contract = all_persons_non_terminal_tasks_only/);
  assert.match(rule, /collaboration_merge_conflict_correction_contract = capture_unmerged_files_stdout_stderr_baseSHA_resultSHA_and_generation_before_merge_abort/);
  assert.match(rule, /evolution_persona_conversation_ui_contract = shared_SELUI_conversation_and_theme_tokens_only/);
  assert.match(rule, /linghu_automation_recovery_fingerprint_contract = task_state_phase_generation_blocking_kind_reason_and_progress_fingerprint/);
  assert.match(rule, /local_change_ownership_enters_linghu_investigation_before_customer_wait/);
  assert.match(rule, /fault_report_names_person_task_stage_finding_and_action/);
  assert.match(rule, /stale_current_handler_never_overrides_active_executor/);
  assert.match(rule, /linghu_automation_state_recovery_contract/);
  assert.match(rule, /linghu_module_completion_report_contract/);
  assert.match(rule, /in_flight_verification_failure_directly_schedules_linghu_repair_independent_from_proactive_automation_switch/);
  assert.match(rule, /candidate_cleanup_partial_failure_is_reported_but_never_preserves_stale_database_tasks/);
  assert.match(rule, /managed_execution_activity_plan_and_diff_never_enter_business_body/);
  assert.match(rule, /candidate_diff_check_exact_baseSHA_to_candidateSHA_not_history_window/);
});

test("自动恢复保留令狐老祖负责人和回流说明", () => {
  const store = readFileSync(new URL("../../../electron/services/workflow/internal/collaboration/collaboration.store.ts", import.meta.url), "utf8");
  const facade = readFileSync(new URL("../../../electron/services/personas/linghu/linghu-automation.facade.ts", import.meta.url), "utf8");
  assert.match(store, /continueTask\(taskId: string, recoveryActor\?: Pick<CollaborationMemberOutDto/);
  assert.match(store, /正在处理流程中断，随后将任务退回原负责人重试/);
  assert.match(facade, /continueTask\(task\.taskId, linghu\)/);
});

test("进程中断后任务显式进入恢复态，继续时重新排队且不沿用旧连接租约", () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "collaboration-recovery-"));
  const filePath = path.join(directory, "state.json");
  try {
    const first = new CollaborationStore(filePath);
    const task = first.submitTask({
      title: "恢复任务",
      problemStatement: "模拟执行中关闭应用",
      confirmedIntent: "恢复后显示继续执行，并使用保存的版本工作区重新分配 Codex。",
      workspaceState,
      locale: "zh-CN",
    });
    assert.equal(task.initiator.displayName, "韩立");
    assert.equal(task.startedAt, task.createdAt);
    assert.equal(task.flowEvents[0].type, "task.submitted");
    first.updateTask(task.taskId, "test.executing", (current, state) => {
      const member = state.members.find((candidate) => candidate.memberId === "song-yu");
      member.state = "working";
      member.role = "executor";
      member.currentTaskId = task.taskId;
      current.state = "executing";
      current.executorMemberId = member.memberId;
      current.assignmentId = "expired-assignment";
    });

    const restored = new CollaborationStore(filePath);
    assert.equal(restored.task(task.taskId).state, "recovering");
    assert.equal(restored.task(task.taskId).flowEvents.filter((event) => event.type === "task.interrupted").length, 1);
    // 再次启动仍处于同一恢复点时不得生成第二条重复恢复节点。
    const restoredAgain = new CollaborationStore(filePath);
    assert.equal(restoredAgain.task(task.taskId).flowEvents.filter((event) => event.type === "task.interrupted").length, 1);
    const continued = restoredAgain.continueTask(task.taskId);
    const continuedTask = continued.tasks.find((candidate) => candidate.taskId === task.taskId);
    assert.equal(continuedTask.state, "queued-executor");
    assert.equal(continuedTask.executorMemberId, "song-yu");
    assert.equal(continuedTask.assignmentId, null);
    assert.equal(continued.members.find((candidate) => candidate.memberId === "song-yu").state, "idle");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("应用重启释放令狐旧会话占用并从统一恢复入口接续修复", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "linghu-recovery-restart-"));
  const statePath = path.join(directory, "state.json");
  let coordinator;
  try {
    const first = new CollaborationStore(statePath);
    const submitted = first.submitTask({
      title: "继续令狐恢复任务",
      problemStatement: "令狐修复会话随应用重建中断。",
      confirmedIntent: "保留原任务和失败证据，由新进程从同一恢复点继续。",
      workspaceState,
      locale: "zh-CN",
      preferredExecutorMemberId: "linghu-ancestor",
    });
    first.updateTask(submitted.taskId, "fixture.linghu_recovering", (task, state) => {
      const linghu = state.members.find((member) => member.memberId === "linghu-ancestor");
      task.state = "recovering";
      task.phase = "blocked";
      task.executorMemberId = linghu.memberId;
      task.preferredExecutorMemberId = linghu.memberId;
      task.currentHandler = { memberId: linghu.memberId, displayName: linghu.displayName };
      task.repairKind = "execution";
      task.repairFailureReason = "执行会话没有生成文件修改";
      task.recoveryTargetState = "executing";
      task.blockingReason = "等待下一次安全恢复";
      linghu.state = "recovering";
      linghu.role = "executor";
      linghu.phase = "blocked";
      linghu.currentTaskId = task.taskId;
      linghu.blockingReason = task.blockingReason;
    });

    const restored = new CollaborationStore(statePath);
    const restoredLinghu = restored.state().members.find((member) => member.memberId === "linghu-ancestor");
    assert.equal(restored.task(submitted.taskId).state, "recovering");
    assert.equal(restoredLinghu.state, "idle");
    assert.equal(restoredLinghu.currentTaskId, null);

    coordinator = createExecutionResultCoordinator(directory, restored, {
      status: "incomplete",
      text: "保留恢复点",
      pendingActions: ["仍需继续修复"],
      changedFiles: [],
      authorizedFiles: [],
      successfulCommands: [],
    });
    coordinator.resumePendingWork();
    for (let attempt = 0; attempt < 100 && !restored.task(submitted.taskId).flowEvents.some((event) => event.type === "execution.repair_started"); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(restored.task(submitted.taskId).flowEvents.some((event) => event.type === "execution.repair_started"), true);
  } finally {
    await coordinator?.dispose();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("应用重启保留活动任务恢复点并释放全部跨进程人物租约", () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "active-task-restart-"));
  try {
    const statePath = path.join(directory, "state.json");
    const store = new CollaborationStore(statePath);
    const submitted = store.submitTask({
      title: "重启后继续活动任务",
      problemStatement: "应用重建中断当前执行连接。",
      confirmedIntent: "保留任务恢复点，由新进程重新建立执行租约。",
      workspaceState,
      locale: "zh-CN",
      preferredExecutorMemberId: "linghu-ancestor",
    });
    store.updateTask(submitted.taskId, "fixture.active_linghu_task", (task, state) => {
      const linghu = state.members.find((member) => member.memberId === "linghu-ancestor");
      task.state = "executing";
      task.phase = "executing";
      task.executorMemberId = linghu.memberId;
      task.currentHandler = { memberId: linghu.memberId, displayName: linghu.displayName };
      linghu.state = "working";
      linghu.role = "executor";
      linghu.phase = "executing";
      linghu.currentTaskId = task.taskId;
      linghu.blockingReason = null;
    });

    const restored = new CollaborationStore(statePath).state();
    const task = restored.tasks.find((candidate) => candidate.taskId === submitted.taskId);
    const linghu = restored.members.find((candidate) => candidate.memberId === "linghu-ancestor");
    assert.equal(task.state, "recovering");
    assert.equal(task.recoveryTargetState, "executing");
    assert.equal(task.flowEvents.filter((event) => event.type === "task.interrupted").length, 1);
    assert.equal(linghu.state, "idle");
    assert.equal(linghu.role, null);
    assert.equal(linghu.currentTaskId, null);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("应用重启保留客户等待状态并释放人物，不把卡点改成恢复中", () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "blocked-restart-preserved-"));
  try {
    const statePath = path.join(directory, "state.json");
    const store = new CollaborationStore(statePath);
    const submitted = store.submitTask({ title: "等待客户提交", problemStatement: "本地文件未提交", confirmedIntent: "等待客户处理后复查。", workspaceState, locale: "zh-CN" });
    store.updateTask(submitted.taskId, "fixture.customer_wait", (task, state) => {
      task.state = "blocked";
      task.blockingReason = "等待客户提交本地文件";
      task.integrationFailure = { kind: "local-change-ownership", detail: "main.ts 未提交", conflictFiles: ["main.ts"], baseSha: null, resultSha: null, generation: 1, occurredAt: new Date().toISOString() };
      const member = state.members.find((candidate) => candidate.memberId === "mo-caihuan");
      member.state = "working";
      member.currentTaskId = task.taskId;
    });
    const restored = new CollaborationStore(statePath).state();
    const task = restored.tasks.find((candidate) => candidate.taskId === submitted.taskId);
    const member = restored.members.find((candidate) => candidate.memberId === "mo-caihuan");
    assert.equal(task.state, "blocked");
    assert.equal(task.flowEvents.some((event) => event.type === "task.interrupted"), false);
    assert.equal(member.state, "idle");
    assert.equal(member.currentTaskId, null);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("协同任务冻结真实发起人快照，两类自动发起都不回退成韩立", () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "collaboration-initiator-"));
  try {
    const store = new CollaborationStore(path.join(directory, "state.json"));
    const task = store.submitTask({
      title: "自动发起任务",
      problemStatement: "自动流程需要显示真实发起人物",
      confirmedIntent: "由南宫婉发起并保留发起人快照。",
      workspaceState,
      locale: "zh-CN",
      initiatorMemberId: "nangong-wan",
    });
    assert.deepEqual(task.initiator, { memberId: "nangong-wan", displayName: "南宫婉" });
    assert.deepEqual(task.flowEvents[0].actor, task.initiator);
    const repairTask = store.submitTask({
      title: "自动错误修复任务",
      problemStatement: "自动修复流程需要显示真实发起人物",
      confirmedIntent: "由令狐老祖发起并保留发起人快照。",
      workspaceState,
      locale: "zh-CN",
      initiatorMemberId: "linghu-ancestor",
    });
    assert.deepEqual(repairTask.initiator, { memberId: "linghu-ancestor", displayName: "令狐老祖" });
    assert.deepEqual(repairTask.flowEvents[0].actor, repairTask.initiator);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("人物页按阶段标注真实操作者并在阻塞后保留执行证据与恢复入口", () => {
  assert.match(developerSource, /node.actor.displayName/);
  assert.doesNotMatch(developerSource, /task\.reviewAttempts\.map|attempt\.reviewerDisplayName/);
  assert.match(developerSource, /node.recipients/);
  assert.match(developerSource, /node.detail/);
  assert.match(developerSource, /onContinueTask/);
  assert.doesNotMatch(developerSource, /member-task-detail|task-progress-stage/);
  assert.match(coordinatorSource, /execution\.diff_updated/);
  assert.match(coordinatorSource, /execution\.changedFiles = changedFiles/);
});

test("执行结果标题被转换为可直接归档的结构化摘要", () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "collaboration-summary-"));
  try {
    const store = new CollaborationStore(path.join(directory, "state.json"));
    const task = store.submitTask({ title: "结果摘要", problemStatement: "旧结果只能翻日志查看", confirmedIntent: "执行列表首先展示任务价值。", workspaceState, locale: "zh-CN" });
    const summary = createCollaborationResultSummary(task, [
      "## 最终执行结果", "新增独立执行列表。", "## 原来存在的问题", "完成记录散落在人物页。",
      "## 本次解决的问题", "完成任务统一归档。", "## 具体修正或改变", "增加结构化结果与流转记录。",
      "## 完成状态", "代码级验证完成。", "## 遗留内容", "无",
    ].join("\n"));
    assert.equal(summary.finalResult, "新增独立执行列表。");
    assert.equal(summary.originalProblem, "完成记录散落在人物页。");
    assert.equal(summary.solvedProblem, "完成任务统一归档。");
    assert.equal(summary.changes, "增加结构化结果与流转记录。");
    assert.equal(summary.remaining, "无");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("耗时日志按等待原因生成集成批次瓶颈报告", () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "collaboration-log-"));
  try {
    const log = new CollaborationDurationLog(directory);
    const queue = log.startWait("task-a", "executor-queue", "system-wait", "no-idle-executor", "executor-capacity", null);
    log.finish(queue, "completed", { releaseEvent: "executor.assigned" });
    const report = log.writeGenerationReport(1, ["task-a"]);
    assert.equal(report.generation, 1);
    assert.equal(report.taskIds[0], "task-a");
    assert.equal(typeof report.waitDurationMs["system-wait"], "number");
    assert.match(readFileSync(path.join(directory, new Date().toISOString().slice(0, 7), "system", "集成报告", "integration-generation-1.json"), "utf8"), /no-idle-executor/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("执行人物只做技术分析并直接进入实施，不再创建内部审核连接", () => {
  const coordinator = readFileSync(new URL("../../../electron/services/workflow/collaboration-workflow.facade.ts", import.meta.url), "utf8");
  const sessions = readFileSync(new URL("../../../electron/services/support/capabilities/conversation/internal/collaboration-codex-sessions.ts", import.meta.url), "utf8");
  const technicalAnalysisPrompt = readFileSync(new URL("../../../prompts/execution/executor-technical-analysis.md", import.meta.url), "utf8");
  assert.match(coordinator, /status: "ready-for-execution"/);
  assert.match(coordinator, /await this\.#execute\(taskId\)/);
  assert.doesNotMatch(coordinator, /createReviewer|scheduleReviewers|beginReview/);
  assert.match(sessions, /prompts\.render\("executor\.technical-analysis"/);
  assert.match(technicalAnalysisPrompt, /执行人物技术分析/);
  assert.match(technicalAnalysisPrompt, /不要重新解释客户为什么要做/);
  assert.doesNotMatch(sessions, /CodexReviewerSession|review_decision/);
});

test("固定人物会话同人物串行且不同人物互不阻塞", async () => {
  const queue = new PersonaSessionWriterQueue();
  const events = [];
  const releaseFirst = await queue.acquire("linghu-ancestor", "task-1", (state, activeTaskId) => events.push({ state, activeTaskId }));
  let secondAcquired = false;
  const second = queue.acquire("linghu-ancestor", "task-2", (state, activeTaskId) => events.push({ state, activeTaskId })).then((release) => {
    secondAcquired = true;
    return release;
  });
  const releaseOther = await queue.acquire("nangong-wan", "task-3");
  await Promise.resolve();
  assert.equal(secondAcquired, false, "同一人物的后续任务必须等待当前 writer 释放");
  releaseOther();
  releaseFirst();
  const releaseSecond = await second;
  assert.equal(secondAcquired, true);
  releaseSecond();
  assert.deepEqual(events.map((event) => event.state), ["acquired", "queued", "released", "acquired", "released"]);
});

test("固定人物取得写入权后依赖挂载失败也会释放写入权", () => {
  // 只截取执行器创建方法，避免其他方法中的异常处理让本门禁产生误判。
  const createExecutorSource = collaborationSessionsSource.slice(
    collaborationSessionsSource.indexOf("async createExecutor"),
    collaborationSessionsSource.indexOf("\n  #createConnection("),
  );
  // 依赖挂载必须位于 try 内，确保挂载阶段抛错也会进入统一清理分支。
  assert.match(createExecutorSource, /try \{[\s\S]*await acquireManagedDependencyLease/);
  // 清理分支必须释放人物写入权，后续恢复才能取得同一人物的执行资格。
  assert.match(createExecutorSource, /catch \(error\) \{[\s\S]*releasePersonaWriter\?\.\(\)/);
});

test("令狐忙碌时执行故障进入等待节点而不是覆盖人物或记为修复失败", () => {
  assert.match(coordinatorSource, /execution\.repair_queued/);
  assert.match(coordinatorSource, /等待令狐老祖完成当前任务/);
  assert.match(coordinatorSource, /#scheduleExecutionRepairs/);
  assert.match(coordinatorSource, /current\.currentHandler = null/);
  assert.doesNotMatch(coordinatorSource, /令狐老祖当前正在处理其他任务/);
});

test("集成工作区锁文件一致时自动复用主工作区依赖", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "collaboration-dependencies-"));
  const candidate = path.join(directory, "candidate-project", "apps", "ai-desktop");
  const source = path.join(directory, "source");
  try {
    mkdirSync(path.join(candidate), { recursive: true });
    mkdirSync(path.join(source, "node_modules", ".bin"), { recursive: true });
    mkdirSync(path.join(source, "node_modules", "electron", "dist"), { recursive: true });
    writeFileSync(path.join(candidate, "package-lock.json"), "same-lock", "utf8");
    writeFileSync(path.join(source, "package-lock.json"), "same-lock", "utf8");
    writeFileSync(path.join(source, "node_modules", ".bin", process.platform === "win32" ? "tsc.cmd" : "tsc"), "ready", "utf8");
    const electronExecutable = process.platform === "win32" ? "electron.exe" : "Electron";
    writeFileSync(path.join(source, "node_modules", "electron", "path.txt"), electronExecutable, "utf8");
    writeFileSync(path.join(source, "node_modules", "electron", "dist", electronExecutable), "ready", "utf8");
    assert.equal(await ensureIntegrationDependencies(candidate, path.join(source, "node_modules"), path.join(source, "package-lock.json")), "linked");
    assert.equal(readFileSync(path.join(candidate, "node_modules", ".bin", process.platform === "win32" ? "tsc.cmd" : "tsc"), "utf8"), "ready");
    const buildModules = path.join(directory, "candidate-project", "build", "ai-desktop", "node_modules");
    assert.equal(readFileSync(path.join(buildModules, ".bin", process.platform === "win32" ? "tsc.cmd" : "tsc"), "utf8"), "ready");
    cleanupIntegrationDependencyLinks(candidate, [path.join(candidate, "node_modules"), buildModules]);
    assert.equal(existsSync(path.join(candidate, "node_modules")), false);
    assert.equal(existsSync(buildModules), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("开发人物工作树共享第三方依赖但把仓库内本地包连接回自己的源码", async () => {
  const repository = mkdtempSync(path.join(controlledTempRoot, "collaboration-dependency-lease-"));
  const worktree = path.join(controlledTempRoot, `collaboration-dependency-lease-worktree-${Date.now()}`);
  const desktopRoot = path.join(repository, "apps", "ai-desktop");
  const lockContent = JSON.stringify({ packages: {
    "": {},
    "node_modules/@selplat/sel-ui": { resolved: "../../shared/frontend/sel-ui", link: true },
  } });
  try {
    mkdirSync(desktopRoot, { recursive: true });
    mkdirSync(path.join(desktopRoot, "scripts"), { recursive: true });
    mkdirSync(path.join(repository, "shared", "frontend", "sel-ui"), { recursive: true });
    writeFileSync(path.join(desktopRoot, "package-lock.json"), lockContent, "utf8");
    writeFileSync(path.join(desktopRoot, "package.json"), JSON.stringify({ name: "ai-desktop" }), "utf8");
    writeFileSync(path.join(repository, "shared", "frontend", "sel-ui", "package.json"), JSON.stringify({ name: "@selplat/sel-ui" }), "utf8");
    const electronExecutable = process.platform === "win32" ? "electron.exe" : "Electron";
    writeFileSync(
      path.join(desktopRoot, "scripts", "dependency-cache.mjs"),
      readFileSync(new URL("../../../scripts/dependency-cache.mjs", import.meta.url), "utf8"),
      "utf8",
    );
    git(repository, "init");
    git(repository, "config", "user.email", "lease-test@example.com");
    git(repository, "config", "user.name", "Lease Test");
    git(repository, "add", ".");
    git(repository, "commit", "-m", "lease fixture");
    git(repository, "worktree", "add", "-b", "lease-worker", worktree, "HEAD");

    const lockHash = createHash("sha256").update(lockContent).digest("hex");
    const sourceModules = path.join(repository, "cache", "ai-desktop", "dependencies", lockHash, "node_modules");
    mkdirSync(path.join(sourceModules, ".bin"), { recursive: true });
    mkdirSync(path.join(sourceModules, "electron", "dist"), { recursive: true });
    mkdirSync(path.join(sourceModules, "@selplat"), { recursive: true });
    writeFileSync(path.join(sourceModules, ".bin", process.platform === "win32" ? "tsc.cmd" : "tsc"), "ready", "utf8");
    writeFileSync(path.join(sourceModules, "electron", "path.txt"), electronExecutable, "utf8");
    writeFileSync(path.join(sourceModules, "electron", "dist", electronExecutable), "ready", "utf8");
    symlinkSync(path.join(repository, "shared", "frontend", "sel-ui"), path.join(sourceModules, "@selplat", "sel-ui"), process.platform === "win32" ? "junction" : "dir");

    const readiness = await inspectManagedDependencyRecovery(worktree, repository, "ai-desktop");
    assert.equal(readiness.ready, true);
    assert.equal(existsSync(path.join(worktree, "apps", "ai-desktop", "node_modules")), false);
    assert.deepEqual(await inspectManagedDependencyRecovery(worktree, repository, "ai-desktop"), readiness);
    const runtimeFile = path.join(sourceModules, "electron", "dist", electronExecutable);
    rmSync(runtimeFile);
    assert.equal((await inspectManagedDependencyRecovery(worktree, repository, "ai-desktop")).ready, false);
    writeFileSync(runtimeFile, "changed-runtime");
    assert.notEqual((await inspectManagedDependencyRecovery(worktree, repository, "ai-desktop")).revision, readiness.revision);
    const residualModules = path.join(worktree, "apps", "ai-desktop", "node_modules");
    mkdirSync(residualModules);
    writeFileSync(path.join(residualModules, "evidence.txt"), "preserve");
    assert.equal((await inspectManagedDependencyRecovery(worktree, repository, "ai-desktop")).ready, false);
    assert.equal(readFileSync(path.join(residualModules, "evidence.txt"), "utf8"), "preserve");
    rmSync(residualModules, { recursive: true });
    assert.equal((await inspectManagedDependencyRecovery(repository, repository, "ai-desktop")).ready, false);
    const lease = await acquireManagedDependencyLease(worktree, repository, "ai-desktop", "executor-song-yu-g1");
    const validationLease = await acquireManagedDependencyLease(worktree, repository, "ai-desktop", "task-validation-1");
    assert.deepEqual(lease.environment, { AI_DESKTOP_DEPENDENCY_LEASE_ID: "executor-song-yu-g1" });
    assert.notEqual(realpathSync(path.join(worktree, "apps", "ai-desktop", "node_modules")), realpathSync(sourceModules));
    assert.equal(realpathSync(path.join(worktree, "apps", "ai-desktop", "node_modules", "@selplat", "sel-ui")), realpathSync(path.join(worktree, "shared", "frontend", "sel-ui")));
    assert.equal(realpathSync(path.join(worktree, "apps", "ai-desktop", "node_modules", "electron")), realpathSync(path.join(sourceModules, "electron")));
    const probeModule = pathToFileURL(path.join(worktree, "apps", "ai-desktop", "scripts", "dependency-cache.mjs")).href;
    const probe = JSON.parse(execFileSync(process.execPath, [
      "--input-type=module",
      "-e",
      `const module = await import(${JSON.stringify(probeModule)}); process.stdout.write(JSON.stringify(module.resolveDependencyCache()));`,
    ], { encoding: "utf8", env: { ...process.env, ...lease.environment } }));
    assert.equal(probe.projectRoot, worktree);
    assert.equal(probe.cacheProjectRoot, repository);
    assert.equal(probe.dependencyCacheRoot, path.join(repository, "cache", "ai-desktop", "dependencies"));
    assert.equal(probe.sharedDependencyRoot, sourceModules);
    assert.equal(probe.dependencyRoot, realpathSync(path.join(worktree, "apps", "ai-desktop", "node_modules")));
    assert.equal(probe.dependencyLeaseId, "executor-song-yu-g1");
    releaseManagedDependencyLease(lease);
    assert.equal(existsSync(path.join(worktree, "apps", "ai-desktop", "node_modules")), true);
    releaseManagedDependencyLease(validationLease);
    assert.equal(existsSync(path.join(worktree, "apps", "ai-desktop", "node_modules")), false);
    assert.equal(git(worktree, "status", "--porcelain"), "");
    assert.equal(existsSync(path.join(worktree, "build", "ai-desktop", "node_modules")), false);
    assert.equal(existsSync(sourceModules), true);

    // 模拟任务把 Codex 等依赖升级到新锁文件，并已经在自己的工作树安装完成。
    const upgradedLockContent = JSON.stringify({ packages: {
      "": {},
      "node_modules/@selplat/sel-ui": { resolved: "../../shared/frontend/sel-ui", link: true },
      "node_modules/example-upgrade": { version: "2.0.0" },
    } });
    const worktreeDesktopRoot = path.join(worktree, "apps", "ai-desktop");
    const upgradedModules = path.join(worktreeDesktopRoot, "node_modules");
    writeFileSync(path.join(worktreeDesktopRoot, "package-lock.json"), upgradedLockContent, "utf8");
    mkdirSync(path.join(upgradedModules, ".bin"), { recursive: true });
    mkdirSync(path.join(upgradedModules, "electron", "dist"), { recursive: true });
    mkdirSync(path.join(upgradedModules, "@selplat"), { recursive: true });
    writeFileSync(path.join(upgradedModules, ".bin", process.platform === "win32" ? "tsc.cmd" : "tsc"), "upgraded", "utf8");
    writeFileSync(path.join(upgradedModules, "electron", "path.txt"), electronExecutable, "utf8");
    writeFileSync(path.join(upgradedModules, "electron", "dist", electronExecutable), "upgraded", "utf8");
    // npm 的本地包链接通常是相对路径；node_modules 移入缓存后，这个旧基准会失效。
    symlinkSync("../../../../shared/frontend/sel-ui", path.join(upgradedModules, "@selplat", "sel-ui"), process.platform === "win32" ? "junction" : "dir");

    const upgradedLease = await acquireManagedDependencyLease(worktree, repository, "ai-desktop", "executor-upgrade-g2");
    const upgradedLockHash = createHash("sha256").update(upgradedLockContent).digest("hex");
    const upgradedCacheModules = path.join(worktree, "cache", "ai-desktop", "dependencies", upgradedLockHash, "node_modules");
    // 新锁不能冒充主工程共享租约；它使用工作树自身的受控锁哈希缓存。
    assert.deepEqual(upgradedLease.environment, {});
    assert.equal(realpathSync(upgradedModules), realpathSync(upgradedCacheModules));
    assert.equal(realpathSync(path.join(upgradedModules, "@selplat", "sel-ui")), realpathSync(path.join(worktree, "shared", "frontend", "sel-ui")));
    releaseManagedDependencyLease(upgradedLease);
    assert.equal(existsSync(upgradedModules), false);
    assert.equal(existsSync(upgradedCacheModules), true);
  } finally {
    try { git(repository, "worktree", "remove", "--force", worktree); } catch {}
    rmSync(repository, { recursive: true, force: true });
    rmSync(worktree, { recursive: true, force: true });
  }
});

test("执行人物只有任务工作树和当前测试记录目录可写", () => {
  const sourceRoot = path.join(controlledTempRoot, "source-workspace");
  const worktreeRoot = path.join(controlledTempRoot, "task-worktree");
  const task = {
    taskId: "task-write-boundary",
    versionWorkspace: { workspaceId: "task-worktree", rootPath: worktreeRoot },
    snapshot: { workspaceState: { primaryId: "source", roots: [{ id: "source", name: "source", path: sourceRoot, permission: "workspace-write" }] } },
  };
  const state = collaborationWorkspaceState(task, task.snapshot.workspaceState);
  assert.equal(state.primaryId, "task-worktree");
  assert.equal(state.roots.find((root) => root.path === worktreeRoot)?.permission, "workspace-write");
  assert.equal(state.roots.find((root) => root.path === sourceRoot)?.permission, "read-only");
  assert.deepEqual(
    state.roots.filter((root) => root.permission === "workspace-write").map((root) => root.path),
    [worktreeRoot, path.join(sourceRoot, "OPTION", "temp", "ai-desktop", "执行日志", "待执行", "测试", "task-write-boundary")],
  );
});

test("令狐候选统一测试把外层受控依赖链接传给全部固定脚本", () => {
  assert.match(unifiedTestRunnerSource, /AI_DESKTOP_TEST_TASK_ID: runId/);
  assert.match(unifiedTestRunnerSource, /acquireManagedDependencyLease/);
  assert.match(unifiedTestRunnerSource, /dependencyLease\?\.environment/);
  assert.match(unifiedTestRunnerSource, /runNpmScript\(desktopRoot, script, environment\)/);
  assert.match(unifiedTestRunnerSource, /delete environment\.ELECTRON_RUN_AS_NODE/);
  assert.match(integrationVerifierSource, /AI_DESKTOP_DEPENDENCY_LEASE_ID/);
  assert.match(integrationVerifierSource, /verifyRegisteredWorktree/);
});

test("协同执行人修改源码后由桌面内部验证分支而不再发起 Codex Playwright 回合", async () => {
  const executor = new ManagedTaskExecutor(prompts);
  let turnCount = 0;
  let desktopValidationCount = 0;
  const events = [];
  const result = await executor.run({
    mode: "task-managed",
    message: "修改当前任务分支",
    restartRequired: false,
    emit: (event) => events.push(event),
    runTurn: async (_message, emit) => {
      turnCount += 1;
      emit({
        type: "activity",
        turnId: "task-turn",
        activity: {
          id: "change-1",
          itemType: "fileChange",
          phase: "completed",
          status: "completed",
          summary: "apps/ai-desktop/src/example.ts",
          detail: null,
        },
      });
      return { text: "源码修改完成", itemCount: 1 };
    },
    readChangedFiles: async () => [
      "apps/ai-desktop/contracts/example.ts",
      "apps/ai-desktop/src/example.ts",
    ],
    runCodeValidation: async (authorizedFiles) => {
      desktopValidationCount += 1;
      assert.deepEqual(authorizedFiles, [
        "apps/ai-desktop/contracts/example.ts",
        "apps/ai-desktop/src/example.ts",
      ]);
    },
  });
  assert.equal(turnCount, 1);
  assert.equal(desktopValidationCount, 1);
  assert.equal(result.managedStatus, "code-verified");
  assert.deepEqual(result.authorizedFiles, [
    "apps/ai-desktop/contracts/example.ts",
    "apps/ai-desktop/src/example.ts",
  ]);
  assert.equal(events.some((event) => event.managedExecution?.message.includes("当前任务分支隔离 Playwright 已通过")), true);
});

test("首次文件范围使用真实 Git 快照且范围冲突立即等待确认", async () => {
  const executor = new ManagedTaskExecutor(prompts);
  let turnCount = 0;
  let validationCount = 0;
  const result = await executor.run({
    mode: "task-managed",
    message: "修改当前任务分支",
    restartRequired: false,
    emit: () => undefined,
    runTurn: async (_message, emit) => {
      turnCount += 1;
      emit({ type: "diff-updated", turnId: "task-turn", changedFiles: ["reported.ts"] });
      return { text: "已完成实现", itemCount: 1 };
    },
    readChangedFiles: async () => ["actual-contract.ts", "reported.ts"],
    runCodeValidation: async (authorizedFiles) => {
      validationCount += 1;
      assert.deepEqual(authorizedFiles, ["actual-contract.ts", "reported.ts"]);
      throw new TaskRepairScopeViolationError(["late-file.ts"]);
    },
  });
  assert.equal(turnCount, 1, "范围确认类失败不能继续调用执行人物重复自修");
  assert.equal(validationCount, 1, "确定性范围冲突只允许检查一次");
  assert.equal(result.managedStatus, "incomplete");
  assert.equal(result.failureKind, "scope-confirmation");
  assert.deepEqual(result.authorizedFiles, ["actual-contract.ts", "reported.ts"]);
});

test("自动自修只能继续修改首次实施已经冻结的文件", () => {
  const scope = TaskRepairScopeAggregate.freeze([
    "apps/ai-desktop/src/features/settings/SettingsPanel.tsx",
    "apps/ai-desktop/tests/settings-panel.test.mjs",
  ]);
  const accepted = scope.check([
    "apps/ai-desktop/tests/settings-panel.test.mjs",
    "apps/ai-desktop/src/features/settings/SettingsPanel.tsx",
  ]);
  assert.equal(accepted.accepted, true);
  assert.deepEqual(accepted.unexpectedFiles, []);
  assert.throws(() => scope.assertContainsOnlyAuthorizedFiles([
    "apps/ai-desktop/src/features/settings/SettingsPanel.tsx",
    "apps/ai-desktop/scripts/build-prompt-bundle.mjs",
  ]), (error) => {
    assert.ok(error instanceof TaskRepairScopeViolationError);
    assert.deepEqual(error.unexpectedFiles, ["apps/ai-desktop/scripts/build-prompt-bundle.mjs"]);
    return true;
  });
});

test("令狐可把当前签发工程内的新技术文件纳入同一修复范围", () => {
  const scope = TaskRepairScopeAggregate.freeze(["apps/ai-desktop/original.ts"]);
  assert.deepEqual(scope.includeTechnicalFiles([
    "apps/ai-desktop/original.ts",
    "apps/ai-desktop/electron/services/dependency-repair.ts",
  ]), [
    "apps/ai-desktop/electron/services/dependency-repair.ts",
    "apps/ai-desktop/original.ts",
  ]);
  assert.equal(scope.check([
    "apps/ai-desktop/original.ts",
    "apps/ai-desktop/electron/services/dependency-repair.ts",
  ]).accepted, true);
});

test("令狐技术修复有新文件证据时不受五轮固定上限", async () => {
  const executor = new ManagedTaskExecutor(prompts);
  const changedFiles = ["apps/ai-desktop/original.ts"];
  let validationCount = 0;
  let turnCount = 0;
  const result = await executor.run({
    mode: "task-managed",
    message: "修复当前工程内的全部技术根因",
    restartRequired: false,
    allowProjectTechnicalRepair: true,
    emit: () => undefined,
    readChangedFiles: async () => [...changedFiles],
    runTurn: async (_message, emit) => {
      turnCount += 1;
      if (turnCount === 1) {
        emit({ type: "diff-updated", turnId: "initial", changedFiles: [...changedFiles] });
      } else {
        const nextFile = `apps/ai-desktop/repair-${turnCount}.ts`;
        changedFiles.push(nextFile);
        emit({ type: "activity", turnId: `repair-${turnCount}`, activity: {
          id: `repair-${turnCount}`,
          itemType: "fileChange",
          phase: "completed",
          status: "completed",
          summary: nextFile,
        } });
      }
      return { text: "已依据新证据继续修复", itemCount: 1 };
    },
    runCodeValidation: async () => {
      validationCount += 1;
      if (validationCount <= 6) throw new Error(`第 ${validationCount} 个技术根因仍待修复`);
    },
  });
  assert.equal(validationCount, 7, "令狐应跨过普通执行人的五轮固定上限");
  assert.equal(result.managedStatus, "code-verified");
  assert.deepEqual(result.authorizedFiles, [...changedFiles].sort());
});

test("令狐一轮没有新增修复证据时停止同内容盲目重试", async () => {
  const executor = new ManagedTaskExecutor(prompts);
  let turnCount = 0;
  let validationCount = 0;
  const result = await executor.run({
    mode: "task-managed",
    message: "修复当前工程内的技术根因",
    restartRequired: false,
    allowProjectTechnicalRepair: true,
    emit: () => undefined,
    readChangedFiles: async () => ["apps/ai-desktop/original.ts"],
    runTurn: async (_message, emit) => {
      turnCount += 1;
      if (turnCount === 1) emit({ type: "diff-updated", turnId: "initial", changedFiles: ["apps/ai-desktop/original.ts"] });
      return { text: "本轮没有修改", itemCount: 1 };
    },
    runCodeValidation: async () => {
      validationCount += 1;
      throw new Error("同一失败证据");
    },
  });
  assert.equal(turnCount, 2);
  assert.equal(validationCount, 1);
  assert.equal(result.managedStatus, "incomplete");
  assert.match(result.pendingActions[0], /没有产生新的代码或文件范围证据/);
});

test("任务结果提交前通过真实 Git 状态阻断自修新增的范围外文件", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "repair-scope-"));
  const repositoryRoot = path.join(directory, "repository");
  const managedRoot = path.join(directory, "managed-worktrees");
  const taskRoot = path.join(managedRoot, "task-scope");
  try {
    mkdirSync(repositoryRoot, { recursive: true });
    writeFileSync(path.join(repositoryRoot, "allowed.ts"), "export const allowed = 1;\n");
    writeFileSync(path.join(repositoryRoot, "outside.ts"), "export const outside = 1;\n");
    git(repositoryRoot, "init");
    git(repositoryRoot, "config", "user.name", "AI Desktop Test");
    git(repositoryRoot, "config", "user.email", "ai-desktop-test@example.invalid");
    git(repositoryRoot, "add", "-A");
    git(repositoryRoot, "commit", "-m", "base");
    mkdirSync(managedRoot, { recursive: true });
    git(repositoryRoot, "worktree", "add", "-b", "codex/collab/task-scope/worker/r1", taskRoot, "HEAD");
    writeFileSync(path.join(taskRoot, "allowed.ts"), "export const allowed = 2;\n");
    writeFileSync(path.join(taskRoot, "outside.ts"), "export const outside = 2;\n");
    const baseSha = git(taskRoot, "rev-parse", "HEAD");
    const task = {
      taskId: "TASK-SCOPE",
      versionWorkspace: {
        workspaceId: "worktree:TASK-SCOPE:r1",
        rootPath: taskRoot,
        branchName: "codex/collab/task-scope/worker/r1",
        baseSha,
        resultSha: null,
        createdAt: new Date().toISOString(),
        retiredAt: null,
      },
    };
    const manager = new VersionWorkspaceManager(repositoryRoot, managedRoot);
    await assert.rejects(
      () => manager.commitTaskResult(task, "张铁", ["allowed.ts"]),
      (error) => {
        assert.ok(error instanceof TaskRepairScopeViolationError);
        assert.deepEqual(error.unexpectedFiles, ["outside.ts"]);
        return true;
      },
    );
    assert.equal(git(taskRoot, "rev-parse", "HEAD"), baseSha, "越界任务不得生成结果提交");
    assert.match(git(taskRoot, "status", "--porcelain"), /outside\.ts/u);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("已提交且工作树干净的任务实现仍是执行门禁的变更证据", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "committed-task-change-"));
  const repositoryRoot = path.join(directory, "repository");
  const managedRoot = path.join(directory, "managed-worktrees");
  const taskRoot = path.join(managedRoot, "task-committed-change");
  try {
    mkdirSync(repositoryRoot, { recursive: true });
    writeFileSync(path.join(repositoryRoot, "implementation.ts"), "export const implementation = 1;\n");
    git(repositoryRoot, "init");
    git(repositoryRoot, "config", "user.name", "AI Desktop Test");
    git(repositoryRoot, "config", "user.email", "ai-desktop-test@example.invalid");
    git(repositoryRoot, "add", "-A");
    git(repositoryRoot, "commit", "-m", "base");
    mkdirSync(managedRoot, { recursive: true });
    git(repositoryRoot, "worktree", "add", "-b", "codex/collab/task-committed-change/worker/r1", taskRoot, "HEAD");
    const baseSha = git(taskRoot, "rev-parse", "HEAD");
    const task = {
      taskId: "TASK-COMMITTED-CHANGE",
      versionWorkspace: {
        workspaceId: "worktree:TASK-COMMITTED-CHANGE:r1",
        rootPath: taskRoot,
        branchName: "codex/collab/task-committed-change/worker/r1",
        baseSha,
        resultSha: null,
        createdAt: new Date().toISOString(),
        retiredAt: null,
      },
    };
    writeFileSync(path.join(taskRoot, "implementation.ts"), "export const implementation = 2;\n");
    git(taskRoot, "add", "-A");
    git(taskRoot, "commit", "-m", "implementation");
    const manager = new VersionWorkspaceManager(repositoryRoot, managedRoot);
    assert.equal(git(taskRoot, "status", "--porcelain"), "", "结果提交后工作树应保持干净");
    assert.deepEqual(await manager.readTaskChangedFiles(task), ["implementation.ts"]);
    assert.deepEqual(await manager.readTaskUncommittedFiles(task), []);
    assert.deepEqual(await manager.validateTaskChangeScope(task, ["implementation.ts"]), []);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("协同固定测试按签发 worktree 执行并隔离任务缓存和输出", () => {
  const runner = readFileSync(new URL("../../../electron/services/support/capabilities/testing/internal/task-worktree-test.runner.ts", import.meta.url), "utf8");
  const manifest = JSON.parse(readFileSync(new URL("../../../package.json", import.meta.url), "utf8"));
  const dependencyVerifier = readFileSync(new URL("../../../electron/services/support/capabilities/release/internal/integration.verifier.ts", import.meta.url), "utf8");
  const sessions = readFileSync(new URL("../../../electron/services/support/capabilities/conversation/internal/collaboration-codex-sessions.ts", import.meta.url), "utf8");
  const codex = readFileSync(new URL("../../../electron/services/support/platform/codex/codex.facade.ts", import.meta.url), "utf8");
  const config = readFileSync(new URL("../../../playwright.interaction.config.ts", import.meta.url), "utf8");
  assert.match(runner, /worktreeRoot/);
  assert.match(runner, /test-cache|PLAYWRIGHT_BROWSERS_PATH/);
  assert.match(runner, /AI_DESKTOP_TEST_TASK_ID/);
  assert.match(runner, /SELPLAT_ROOT: this\.#sourceProjectRoot/);
  assert.match(runner, /acquireManagedDependencyLease/);
  assert.match(runner, /dependencyLease\.environment/);
  assert.match(runner, /npm run/);
  assert.match(runner, /releaseManagedDependencyLease\(dependencyLease\)/);
  assert.equal(manifest.scripts["test:interaction"], "npm run build:developer && node scripts/run-with-dependencies.mjs node scripts/run-interaction-tests.mjs");
  assert.match(runner, /expected: "npm run build:developer && node scripts\/run-with-dependencies\.mjs node scripts\/run-interaction-tests\.mjs"/);
  assert.match(dependencyVerifier, /hasElectronRuntime/);
  assert.doesNotMatch(dependencyVerifier, /"ci", "--ignore-scripts"/);
  assert.match(sessions, /runCodeValidation/);
  assert.match(sessions, /validationOwner: "desktop"/);
  assert.match(sessions, /dependencyLeaseId: dependencyLease\?\.environment\.AI_DESKTOP_DEPENDENCY_LEASE_ID/);
  assert.match(codex, /isDesktopOwnedValidationCommand/);
  assert.match(codex, /无需 Agent 申请 Playwright 权限/);
  assert.match(config, /AI_DESKTOP_TEST_TASK_ID/);
});

test("协同编排保持独立执行连接、心跳和整轮封存集成契约", () => {
  const coordinator = readFileSync(new URL("../../../electron/services/workflow/collaboration-workflow.facade.ts", import.meta.url), "utf8");
  const sessions = readFileSync(new URL("../../../electron/services/support/capabilities/conversation/internal/collaboration-codex-sessions.ts", import.meta.url), "utf8");
  const workspaces = readFileSync(new URL("../../../electron/services/support/capabilities/release/internal/version-workspace.manager.ts", import.meta.url), "utf8");
  const integrationVerifier = readFileSync(new URL("../../../electron/services/support/capabilities/release/internal/integration.verifier.ts", import.meta.url), "utf8");
  const ui = rendererCollaborationSources.map((source) => readFileSync(new URL(source, import.meta.url), "utf8")).join("\n");
  assert.match(sessions, /new CodexService/);
  assert.match(sessions, /codexHome: this\.#options\.codexHome/);
  assert.match(sessions, /serviceName: "selplat_ai_desktop_collaboration"/);
  assert.match(sessions, /migrateLegacySession: true/);
  assert.match(sessions, /role: "executor"/);
  assert.doesNotMatch(sessions, /role: "executor" \| "reviewer"/);
  assert.doesNotMatch(coordinator, /optimize-and-execute|queued-reviewer/);
  assert.match(coordinator, /member\.heartbeat/);
  assert.match(coordinator, /state === "ready-for-integration"/);
  assert.doesNotMatch(coordinator, /setTimeout\([^)]*integration/i);
  assert.match(workspaces, /codex\/collab/);
  assert.match(workspaces, /codex\/collab\/integration-g\$\{generation\}/);
  assert.doesNotMatch(workspaces, /codex\/collab\/integration\/g\$\{generation\}/);
  assert.match(workspaces, /resultSha/);
  assert.match(workspaces, /validateTaskChangeScope/);
  assert.match(workspaces, /TaskRepairScopeAggregate/);
  assert.match(integrationVerifier, /ensureBuildDependencyLink\(candidateDesktopRoot, sourceModules\)/);
  assert.match(integrationVerifier, /releaseManagedDependencyLease\(dependencyLease\)/);
  assert.doesNotMatch(ui, /reviewAttempts\.some|decision-unrecognized/);
  const memberPageSource = ui.slice(ui.indexOf("function CollaborationMemberPage"), ui.indexOf("function collaborationMemberDisplayModel"));
  assert.doesNotMatch(memberPageSource, /durationMs|总耗时/);
  assert.doesNotMatch(ui, /CollaborationExecutionList/);
  assert.match(ui, /TaskCollaborationGroup/);
  assert.doesNotMatch(ui, /任务完整记录/);
  assert.match(ui, /SelUiConversation/);
});


test("初始化卡点核查环境变化后恢复同一任务，重启和心跳不重置相同证据预算", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "linghu-preparation-recovery-"));
  try {
    const collaborationStore = new CollaborationStore(path.join(directory, "collaboration.json"));
    collaborationStore.setMode("collaboration");
    const task = collaborationStore.submitTask({ title: "初始化恢复", problemStatement: "缓存缺失",
      confirmedIntent: "修复后继续原任务", workspaceState, locale: "zh-CN" });
    const block = () => collaborationStore.updateTask(task.taskId, "test.blocked", (current) => {
      current.state = "blocked"; current.phase = "blocked";
      current.recoveryTargetState = "preparing-worktree"; current.blockingReason = "执行人初始化失败：依赖未就绪";
    });
    block();
    let evidence = { ready: false, revision: "", detail: "缓存缺失" };
    let inspected = 0;
    const resumed = [];
    const storePath = path.join(directory, "linghu.json");
    const makeFacade = () => new LinghuAutomationFacade({
      store: createTestLinghuStore(storePath),
      collaboration: { state: () => collaborationStore.state(),
        continueTask: (id) => { resumed.push(id); return collaborationStore.continueTask(id); } },
      inspectPreparationRecovery: async () => { inspected += 1; return evidence; },
      readWorkspaceState: () => workspaceState, locale: () => "zh-CN",
      recordEvent: () => undefined, readTestResourceState: idleTestResourceState,
      runUnifiedTestAndRestart: async () => undefined,
    });
    let facade = makeFacade();
    await facade.handleTaskCheckpoint(task.taskId);
    assert.equal(resumed.length, 0);
    assert.match(facade.state().blockingReason, /缓存缺失/);
    evidence = { ready: true, revision: "dependency-a", detail: "就绪" };
    await facade.handleTaskCheckpoint(task.taskId);
    assert.deepEqual(resumed, [task.taskId]);
    block();
    facade = makeFacade();
    await facade.handleTaskCheckpoint(task.taskId);
    collaborationStore.updateTask(task.taskId, "test.heartbeat", (current) => { current.workerGeneration += 1; });
    await facade.handleTaskCheckpoint(task.taskId);
    assert.equal(resumed.length, 1);
    evidence = { ...evidence, revision: "dependency-b" };
    await facade.handleTaskCheckpoint(task.taskId);
    assert.deepEqual(resumed, [task.taskId, task.taskId]);
    assert.equal(collaborationStore.state().tasks.length, 1);
    block();
    collaborationStore.cancelTask(task.taskId);
    const prior = inspected;
    await facade.handleTaskCheckpoint(task.taskId);
    assert.equal(inspected, prior);
    assert.equal(resumed.length, 2);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});


test("令狐活跃调查期间晚到恢复不得重排旧结果，真实进展属于令狐", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "repair-ownership-"));
  let finishDiagnosis;
  const diagnosis = new Promise((resolve) => { finishDiagnosis = resolve; });
  let entered;
  const started = new Promise((resolve) => { entered = resolve; });
  let coordinator;
  try {
    const store = new CollaborationStore(path.join(directory, "state.json"));
    const task = store.submitTask({ title: "原任务", problemStatement: "打包失败", confirmedIntent: "修复同一任务", workspaceState, locale: "zh-CN" });
    store.updateTask(task.taskId, "fixture.failed", (current) => {
      current.state = "test-failed";
      current.executorMemberId = "song-yu";
      current.versionWorkspace = { workspaceId: "test", rootPath: directory, branchName: "codex/test", baseSha: "base", resultSha: "old", createdAt: new Date().toISOString(), retiredAt: null };
      current.integrationFailure = { kind: "verification", detail: "missing entry", conflictFiles: [], baseSha: "base", resultSha: "old", generation: 2, occurredAt: new Date().toISOString() };
    });
    let schedules = 0;
    coordinator = new CollaborationCoordinator({
      store,
      durations: { startWait: () => "wait", finish: () => {}, start: () => "span", instant: () => {}, interruptOpenSpans: () => {} },
      workspaces: { commitTaskResult: async () => "new" },
      executor: new ExecutorFacade({ createExecutor: async () => ({
        isAlive: () => true,
        investigateRepair: async (_task, _failure, emit) => { emit({ type: "activity", text: "真实调查" }); entered(); return diagnosis; },
        executeRepair: async () => ({ status: "code-verified", text: "已修复", pendingActions: [], changedFiles: [], authorizedFiles: [], successfulCommands: ["test"] }),
        dispose: async () => {},
      }) }),
      integrationPipeline: { finishWaitingTask: () => {}, trackWaitingTask: () => {}, schedule: () => { schedules += 1; }, dispose: () => {} },
      emitState: () => {}, emitStream: () => {},
    });
    const running = coordinator.repairTechnicalFailure(task.taskId);
    await started;
    await coordinator.recoverTask(task.taskId, "晚到的原执行人超时");
    coordinator.continueTask(task.taskId);
    assert.equal(store.task(task.taskId).state, "repairing-execution");
    assert.equal(store.task(task.taskId).versionWorkspace.resultSha, "old");
    assert.equal(schedules, 0);
    assert.ok(store.state().members.find((member) => member.memberId === "linghu-ancestor").lastProtocolProgressAt);
    finishDiagnosis("核对候选版本后统一修复");
    await running;
    assert.equal(store.task(task.taskId).versionWorkspace.resultSha, "new");
    assert.equal(store.task(task.taskId).state, "ready-for-integration");
    assert.ok(schedules > 0);
    store.updateTask(task.taskId, "fixture.awaiting_restart", (current) => { current.state = "awaiting-restart"; });
    await coordinator.recoverTask(task.taskId, "重启前晚到超时");
    assert.equal(store.task(task.taskId).state, "awaiting-restart");
  } finally { finishDiagnosis?.("结束"); await coordinator?.dispose(); rmSync(directory, { recursive: true, force: true }); }
});

test("容量等待的直接技术修复入口不绕过客户确认", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "capacity-repair-entry-"));
  let coordinator;
  try {
    const store = new CollaborationStore(path.join(directory, "state.json"));
    const task = store.submitTask({ title: "容量等待", problemStatement: "预检容量不足", confirmedIntent: "等待授权后重新验证", workspaceState, locale: "zh-CN" });
    store.updateTask(task.taskId, "fixture.capacity_waiting", (current) => {
      current.state = "blocked";
      current.repairRequiresUserConfirmation = true;
      current.blockingReason = "开发包容量不足，等待保留策略授权";
      current.integrationFailure = { kind: "infrastructure", detail: "候选卷空间不足", conflictFiles: [], baseSha: "base", resultSha: "result", generation: 174, occurredAt: new Date().toISOString() };
    });
    let executorCreated = 0;
    coordinator = new CollaborationCoordinator({
      store,
      durations: { startWait: () => "wait", finish: () => {}, start: () => "span", instant: () => {}, interruptOpenSpans: () => {} },
      workspaces: { commitTaskResult: async () => "new" },
      executor: new ExecutorFacade({ createExecutor: async () => { executorCreated += 1; throw new Error("容量等待不得创建修复执行者"); } }),
      integrationPipeline: { finishWaitingTask: () => {}, trackWaitingTask: () => {}, schedule: () => {}, dispose: () => {} },
      emitState: () => {}, emitStream: () => {},
    });
    assert.equal(await coordinator.repairTechnicalFailure(task.taskId), false);
    assert.equal(executorCreated, 0);
    assert.equal(store.task(task.taskId).state, "blocked");
    assert.equal(store.task(task.taskId).versionWorkspace, null);
  } finally { await coordinator?.dispose(); rmSync(directory, { recursive: true, force: true }); }
});


test("新故障接续保留原任务与客户等待，缺少完成指导时拒绝排队", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "failure-evidence-"));
  try {
    const store = new CollaborationStore(path.join(directory, "collaboration.json"));
    const seeded = store.submitTask({
      title: "原修复", problemStatement: "旧故障", confirmedIntent: "旧调查",
      constraints: ["卡点标识：run-1:proposal:proposal-1:round:1"], workspaceState, locale: "zh-CN",
      initiatorMemberId: "han-li", preferredExecutorMemberId: "linghu-ancestor",
      automationSource: "linghu-safeguard", evolutionProposalId: "proposal-1",
    });
    store.updateTask(seeded.taskId, "test.wait", task => {
      task.state = "blocked";
      task.repairRequiresUserConfirmation = true;
      task.blockingReason = "等待客户处理";
    });
    const coordinator = createExecutionResultCoordinator(directory, store,
      { status: "code-verified", text: "", pendingActions: [], authorizedFiles: [] });
    await coordinator.dispose();
    const request = {
      title: "原修复", problemStatement: "最新验收故障", confirmedIntent: "按新增证据重新调查",
      constraints: ["卡点标识：run-1:proposal:proposal-1:round:1", "卡点故障事实：failure-2"],
      acceptanceCriteria: ["原条件保持不变"], workspaceState, locale: "zh-CN", evolutionProposalId: "proposal-1",
    };
    await coordinator.refreshCheckpointRepair(seeded.taskId, request);
    const revised = store.task(seeded.taskId);
    assert.equal(revised.state, "blocked");
    assert.equal(revised.repairRequiresUserConfirmation, true);
    assert.equal(revised.blockingReason, "等待客户处理");
    assert.equal(revised.snapshot.problemStatement, "最新验收故障");
    assert.equal(revised.taskRevision, 2);
    assert.equal(store.state().tasks.length, 1);
    assert.throws(() => store.continueTask(seeded.taskId), /请先按等待节点/);
    await coordinator.refreshCheckpointRepair(seeded.taskId, request);
    assert.equal(store.task(seeded.taskId).taskRevision, 2);
    const restored = new CollaborationStore(path.join(directory, "collaboration.json"));
    assert.equal(restored.task(seeded.taskId).state, "blocked");
    assert.equal(restored.task(seeded.taskId).snapshot.problemStatement, "最新验收故障");
    await assert.rejects(() => coordinator.refreshCheckpointRepair(seeded.taskId, {
      ...request, constraints: ["卡点标识：other-run:proposal:proposal-1:round:1", "卡点故障事实：other"]
    }), /原运行恢复点/);
    await assert.rejects(() => coordinator.refreshCheckpointRepair(seeded.taskId, { ...request, evolutionProposalId: "other" }), /归属/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("本地修改已经提交后新验收证据解除历史归属等待并继续原任务", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "ownership-wait-satisfied-"));
  let coordinator;
  try {
    const store = new CollaborationStore(path.join(directory, "collaboration.json"));
    const seeded = store.submitTask({
      title: "原修复", problemStatement: "旧故障", confirmedIntent: "旧调查",
      constraints: ["卡点标识：run-1:proposal:proposal-1:round:1"], workspaceState, locale: "zh-CN",
      initiatorMemberId: "han-li", preferredExecutorMemberId: "linghu-ancestor",
      automationSource: "linghu-safeguard", evolutionProposalId: "proposal-1",
    });
    store.updateTask(seeded.taskId, "test.ownership_wait", (task, state) => {
      for (const member of state.members) member.enabled = false;
      task.state = "blocked";
      task.blockingReason = "合并前无法确认本地修改归属";
      task.customerActionGuidance = {
        guidanceId: "ownership-guidance", sourceFingerprint: "ownership", title: "等待客户完成的事项",
        problem: "存在未提交文件", reasonCustomerMustAct: "需要确认归属", steps: ["提交文件"], completionCriteria: ["工作区干净"],
        generatedBy: { memberId: "linghu-ancestor", displayName: "令狐老祖" }, createdAt: new Date().toISOString(),
      };
      task.integrationFailure = {
        kind: "local-change-ownership", summary: "合并前无法确认本地修改归属", detail: "规则文件未登记",
        conflictFiles: ["规则文件.md"], baseSha: "base", resultSha: "result", generation: 1, occurredAt: new Date().toISOString(),
      };
    });
    coordinator = new CollaborationCoordinator({
      store,
      durations: { startWait: () => "wait", finish: () => {}, start: () => "span", instant: () => {}, interruptOpenSpans: () => {} },
      workspaces: { readLocalUncommittedFiles: async () => [], commitTaskResult: async () => "new" },
      executor: new ExecutorFacade({ createExecutor: async () => ({
        isAlive: () => true,
        analyze: async () => new Promise(() => {}),
        dispose: async () => {},
      }) }),
      integrationPipeline: { finishWaitingTask: () => {}, trackWaitingTask: () => {}, invalidateTask: () => {}, schedule: () => {}, dispose: () => {} },
      emitState: () => {}, emitStream: () => {},
    });
    await coordinator.refreshCheckpointRepair(seeded.taskId, {
      title: "原修复", problemStatement: "最新验收故障", confirmedIntent: "按新增证据重新调查",
      constraints: ["卡点标识：run-1:proposal:proposal-1:round:1", "卡点故障事实：failure-2"],
      acceptanceCriteria: ["原条件保持不变"], workspaceState, locale: "zh-CN", evolutionProposalId: "proposal-1",
    });
    const revised = store.task(seeded.taskId);
    assert.notEqual(revised.state, "blocked");
    assert.equal(revised.integrationFailure, null);
    assert.equal(revised.customerActionGuidance, null);
    assert.equal(revised.blockingReason, "已收到新证据，正在重新调查同一任务");
    assert.match(revised.flowEvents.at(-1).summary, /干净工作区证据解除/);
  } finally { await coordinator?.dispose(); rmSync(directory, { recursive: true, force: true }); }
});
