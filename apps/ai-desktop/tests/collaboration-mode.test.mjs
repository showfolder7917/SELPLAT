import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { CollaborationDurationLog } from "../../../build/ai-desktop/electron/electron/services/workflow/internal/collaboration-duration.log.js";
import { CollaborationCoordinator } from "../../../build/ai-desktop/electron/electron/services/workflow/collaboration-workflow.facade.js";
import { PersonaSessionWriterQueue } from "../../../build/ai-desktop/electron/electron/services/capabilities/conversation/internal/collaboration-codex-sessions.js";
import { createCollaborationResultSummary } from "../../../build/ai-desktop/electron/electron/services/workflow/internal/result/result-summary.js";
import { acquireManagedDependencyLease, cleanupIntegrationDependencyLinks, ensureIntegrationDependencies, releaseManagedDependencyLease, verifyCandidateDelta } from "../../../build/ai-desktop/electron/electron/services/capabilities/release/internal/integration.verifier.js";
import { stageVerifiedDeveloperExecutable } from "../../../build/ai-desktop/electron/electron/services/capabilities/release/internal/verified-package.release.js";
import { CollaborationStore } from "../../../build/ai-desktop/electron/electron/services/workflow/internal/collaboration.store.js";
import { LinghuAutomationFacade } from "../../../build/ai-desktop/electron/electron/services/personas/linghu/index.js";
import { ExecutorFacade } from "../../../build/ai-desktop/electron/electron/services/personas/executor/index.js";
import { LinghuAutomationStore } from "../../../build/ai-desktop/electron/electron/services/personas/linghu/internal/linghu-automation.store.js";
import { TestResourceCoordinatorFacade } from "../../../build/ai-desktop/electron/electron/services/capabilities/testing/test-resource-coordinator.facade.js";
import { IntegrationReleaseCoordinatorFacade } from "../../../build/ai-desktop/electron/electron/services/capabilities/release/integration-release.facade.js";
import { ReleaseBatchStore } from "../../../build/ai-desktop/electron/electron/services/capabilities/release/internal/release-batch.store.js";
import { LocalChangeOwnershipError, MergeConflictError, VersionWorkspaceManager } from "../../../build/ai-desktop/electron/electron/services/capabilities/release/internal/version-workspace.manager.js";
import { ManagedTaskExecutor } from "../../../build/ai-desktop/electron/electron/services/capabilities/execution/internal/managed-task.executor.js";
import { createAtomicJsonPersistence } from "../../../build/ai-desktop/electron/electron/services/platform/persistence/index.js";
import { controlledTestRoot, projectRoot } from "./test-paths.mjs";

const controlledTempRoot = controlledTestRoot;
mkdirSync(controlledTempRoot, { recursive: true });
const developerSource = readFileSync(new URL("../src/variants/developer/DeveloperApp.tsx", import.meta.url), "utf8");
const coordinatorSource = readFileSync(new URL("../electron/services/workflow/collaboration-workflow.facade.ts", import.meta.url), "utf8");
const integrationPipelineSource = readFileSync(new URL("../electron/services/capabilities/release/internal/version-integration.pipeline.ts", import.meta.url), "utf8");
const releaseBatchStoreSource = readFileSync(new URL("../electron/services/capabilities/release/internal/release-batch.store.ts", import.meta.url), "utf8");
// 入口存在性由边界测试负责；这里读取任务事实 DTO 验证完整状态枚举。
const collaborationContractSource = readFileSync(new URL("../contracts/collaboration/workflow/dto/collaboration-task.out.dto.ts", import.meta.url), "utf8");
const unifiedTestRunnerSource = readFileSync(new URL("../electron/services/capabilities/testing/internal/fixed-unified-test.runner.ts", import.meta.url), "utf8");
const linghuRuntimeSource = readFileSync(new URL("../electron/services/personas/linghu/internal/create-linghu-runtime.ts", import.meta.url), "utf8");
const integrationVerifierSource = readFileSync(new URL("../electron/services/capabilities/release/internal/integration.verifier.ts", import.meta.url), "utf8");
const idleTestResourceState = () => ({ holder: null, waiters: [], localQueueDepth: 0, lastEvent: null });

// 测试也经 Platform Port 创建人物 Store，避免用例重新引入文件路径耦合。
function createTestLinghuStore(filePath) {
  return new LinghuAutomationStore(createAtomicJsonPersistence(filePath));
}

function runCoordinatorWorker(coordinationRoot, runId, buildRoot, holdMilliseconds) {
  const worker = new URL("./fixtures/test-resource-coordinator-worker.mjs", import.meta.url);
  const moduleUrl = new URL("../../../build/ai-desktop/electron/electron/services/capabilities/testing/test-resource-coordinator.facade.js", import.meta.url).href;
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
  const worker = new URL("./fixtures/integration-release-coordinator-worker.mjs", import.meta.url);
  const moduleUrl = new URL("../../../build/ai-desktop/electron/electron/services/capabilities/release/integration-release.facade.js", import.meta.url).href;
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

test("会话卡片绑定真实协作任务并完整显示修复回流与统一测试状态", () => {
  assert.match(developerSource, /collaborationTaskId/);
  assert.match(developerSource, /CollaborationStatusChain/);
  assert.match(developerSource, /task-fact-strip.*task\.initiator\?\.displayName/s);
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
  assert.match(coordinatorSource, /ORCHESTRATOR_MEMBER_IDS/);
  assert.match(integrationPipelineSource, /release\.awaiting_restart/);
  assert.match(integrationPipelineSource, /release\.restart_healthy/);
  assert.match(integrationPipelineSource, /unified_test\.passed/);
  assert.match(integrationPipelineSource, /unified_test\.failed/);
});

const workspaceState = {
  primaryId: "root",
  roots: [{ id: "root", name: "SELPLAT", path: projectRoot, permission: "workspace-write" }],
};

test("默认人物稳定列出且韩立不能被删除", () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "collaboration-store-"));
  try {
    const store = new CollaborationStore(path.join(directory, "state.json"));
    assert.deepEqual(store.state().members.map((member) => member.displayName), [
      "韩立", "南宫婉", "令狐老祖", "紫灵", "元瑶", "宋玉", "冰魄仙子", "墨彩环", "墨大夫", "厉飞雨", "张铁", "李化元",
    ]);
    assert.throws(() => store.deleteMember("han-li"), /不能删除/);
    assert.throws(() => store.deleteMember("linghu-ancestor"), /不能删除/);
    const created = store.createMember({ displayName: "银月" });
    const member = created.members.find((candidate) => candidate.displayName === "银月");
    assert.ok(member);
    assert.equal(store.updateMember(member.memberId, { displayName: "银月仙子" }).members.some((candidate) => candidate.displayName === "银月仙子"), true);
    assert.equal(store.deleteMember(member.memberId).members.some((candidate) => candidate.memberId === member.memberId), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("清空测试数据保留人物配置与令狐文案并重置全部运行态", () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "clear-test-data-"));
  try {
    const collaborationStore = new CollaborationStore(path.join(directory, "collaboration.json"));
    collaborationStore.setMode("collaboration");
    const custom = collaborationStore.createMember({ displayName: "银月" }).members.find((member) => member.displayName === "银月");
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
    const prompt = linghuStore.createPrompt({ title: "保留的启动文案", content: "这是用户配置，不属于测试运行历史。" });
    linghuStore.setEnabled(true);
    linghuStore.updateRuntime("test.runtime", (state) => { state.flowSnapshots.push({ sourceTaskId: "task-1", taskTitle: "旧任务", taskState: "executing", sourceGeneration: 1, sourceStage: "execution", sourceStatus: "started", sourceResultSha: null, completionConditions: [], observedAt: new Date().toISOString() }); });
    assert.ok(linghuStore.clearTestData() > 0);
    const linghuState = createTestLinghuStore(linghuPath).state();
    assert.equal(linghuState.enabled, false);
    assert.equal(linghuState.flowSnapshots.length, 0);
    assert.ok(linghuState.prompts.some((item) => item.promptId === prompt.prompts.at(-1).promptId));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("令狐老祖自动保障通过单一 Facade 发起任务并持久恢复启动文案", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "linghu-automation-"));
  try {
    const collaborationStore = new CollaborationStore(path.join(directory, "collaboration.json"));
    collaborationStore.setMode("collaboration");
    const submitted = [];
    const collaboration = {
      state: () => collaborationStore.state(),
      setMode: (mode) => collaborationStore.setMode(mode),
      submitTask: (request) => {
        submitted.push(request);
        collaborationStore.submitTask(request);
        return collaborationStore.state();
      },
      continueTask: (taskId) => collaborationStore.continueTask(taskId),
    };
    const storePath = path.join(directory, "linghu.json");
    const automationStore = createTestLinghuStore(storePath);
    let restartCount = 0;
    const facade = new LinghuAutomationFacade({
      store: automationStore,
      collaboration,
      readWorkspaceState: () => workspaceState,
      locale: () => "zh-CN",
      recordEvent: () => undefined,
      readTestResourceState: idleTestResourceState,
      runUnifiedTestAndRestart: async (onVerified) => { restartCount += 1; onVerified(); },
    });
    automationStore.setEnabled(true);
    await facade.checkNow();
    assert.equal(submitted.length, 1);
    assert.equal(submitted[0].initiatorMemberId, "linghu-ancestor");
    assert.equal(submitted[0].preferredExecutorMemberId, "linghu-ancestor");
    assert.equal(submitted[0].automationSource, "linghu-safeguard");
    assert.match(submitted[0].confirmedIntent, /最后一道屏障/);
    assert.match(submitted[0].confirmedIntent, /当前独立模块/);
    assert.match(submitted[0].confirmedIntent, /测试漏点/);
    assert.match(submitted[0].confirmedIntent, /日志审计/);
    assert.match(submitted[0].confirmedIntent, /测试资源结构化事实/);
    assert.doesNotMatch(submitted[0].confirmedIntent, /页面审核以客户易用为第一目标/);
    assert.equal(facade.state().activeTaskId, collaborationStore.state().tasks[0].taskId);
    await facade.checkNow();
    assert.equal(submitted.length, 1, "活动模块尚未完成时30秒检测不得重复派发");
    assert.equal(facade.state().flowSnapshots.length, 1);
    assert.equal(facade.state().flowSnapshots[0].sourceTaskId, facade.state().activeTaskId);
    assert.deepEqual(facade.state().flowSnapshots[0].completionConditions, ["任务完成代码级验证", "集成候选验证通过", "结果进入 integrated 终态"]);
    assert.ok(facade.state().detectionCursor);

    const created = facade.createPrompt({ title: "客户易用性巡检", content: "从客户一看就懂的角度持续检查页面。" });
    const prompt = created.prompts.find((candidate) => candidate.title === "客户易用性巡检");
    assert.ok(prompt);
    facade.updatePrompt(prompt.promptId, { enabled: false });
    assert.equal(facade.state().prompts.find((candidate) => candidate.promptId === prompt.promptId).enabled, false);
    const restored = createTestLinghuStore(storePath).state();
    assert.equal(restored.enabled, true);
    assert.equal(restored.activeTaskId, facade.state().activeTaskId);
    assert.equal(restored.pollIntervalMs, 30_000);
    facade.deletePrompt(prompt.promptId);
    assert.equal(facade.state().prompts.some((candidate) => candidate.promptId === prompt.promptId), false);

    const expectedModules = ["test-coverage", "audit-completeness", "flow-completion"];
    for (const expectedModule of expectedModules) {
      const activeTaskId = facade.state().activeTaskId;
      collaborationStore.updateTask(activeTaskId, "test.integrated", (task) => {
        task.state = "integrated";
        task.completedAt = new Date().toISOString();
        task.finalResult = "模块完成反馈";
      });
      await facade.checkNow();
      assert.equal(facade.state().currentModule, expectedModule);
      if (expectedModule === "audit-completeness") {
        assert.equal(facade.state().lastModuleReport.module, "test-coverage");
        assert.equal(facade.state().lastModuleReport.tests.status, "passed");
        assert.equal(facade.state().lastModuleReport.restartRecovery.status, "passed");
      }
    }
    assert.equal(facade.state().cycle, 2);
    assert.equal(restartCount, 1);
    assert.equal(submitted.length, 4, "每个模块完成后只派发一个下一模块任务");
    assert.equal(facade.state().lastModuleReport.module, "audit-completeness");
    assert.equal(facade.state().lastModuleReport.tasks[0].executorMemberId, "linghu-ancestor");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("令狐没有具体故障时只报告检查结果，已有具体修正仍沿韩立审批返还执行", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "linghu-evolution-approval-"));
  try {
    const collaborationStore = new CollaborationStore(path.join(directory, "collaboration.json"));
    collaborationStore.setMode("collaboration");
    const collaboration = {
      state: () => collaborationStore.state(),
      setMode: (mode) => collaborationStore.setMode(mode),
      submitTask: (request) => { collaborationStore.submitTask(request); return collaborationStore.state(); },
    };
    const automationStore = createTestLinghuStore(path.join(directory, "linghu.json"));
    automationStore.setEnabled(true);
    let proposalState = { proposals: [] };
    const facade = new LinghuAutomationFacade({
      store: automationStore, collaboration, readWorkspaceState: () => workspaceState, locale: () => "zh-CN",
      recordEvent: () => undefined, readTestResourceState: idleTestResourceState, runUnifiedTestAndRestart: async () => undefined,
      submitRepairProposal: (request) => {
        proposalState = { proposals: [{ proposalId: "linghu-proposal-1", status: "pending-approval", ...request }] };
        return proposalState;
      },
      readEvolutionState: () => proposalState,
      reviseReturnedProposal: (proposalId) => {
        const original = proposalState.proposals.find((proposal) => proposal.proposalId === proposalId);
        proposalState.proposals.push({ ...original, proposalId: "linghu-proposal-2", version: 2, status: "pending-approval", supersedesProposalId: proposalId, approvals: [] });
        return proposalState;
      },
    });
    await facade.checkNow();
    assert.equal(proposalState.proposals.length, 0);
    assert.equal(facade.state().pendingRepairProposalId, null);
    assert.match(facade.state().blockingReason, /没有未完成任务/);
    assert.match(facade.state().blockingReason, /不生成泛化修正方案/);
    assert.equal(collaborationStore.state().tasks.length, 0, "审批前不得创建修正执行任务");
    proposalState = { proposals: [{ proposalId: "linghu-proposal-1", version: 1, status: "pending-approval", approvals: [] }] };
    automationStore.updateRuntime("test.concrete_repair_proposal", (state) => {
      state.pendingRepairProposalId = "linghu-proposal-1";
      state.recoveryCheckpoint = "repair-proposal:linghu-proposal-1:flow-completion";
      state.blockingReason = "墨彩环负责的任务停在版本集成阶段；发现：已登记的本地修改归属不明确。";
    });
    proposalState.proposals[0].status = "supplement-required";
    proposalState.proposals[0].approvals = [{ advice: "补充修改位置和预期结果" }];
    await facade.checkNow();
    assert.equal(facade.state().pendingRepairProposalId, "linghu-proposal-2");
    assert.match(facade.state().blockingReason, /已依据审批意见提交 v2/);
    proposalState.proposals[1].status = "approved";
    collaborationStore.submitTask({ title: "令狐审批后修正", problemStatement: "修正持续运行 Bug", confirmedIntent: "按审批方向修正", constraints: [], acceptanceCriteria: ["稳定运行"], workspaceState, locale: "zh-CN", mergeStrategy: "INDEPENDENT", initiatorMemberId: "linghu-ancestor", preferredExecutorMemberId: "linghu-ancestor", evolutionProposalId: "linghu-proposal-2" });
    await facade.checkNow();
    assert.equal(facade.state().pendingRepairProposalId, null);
    assert.equal(facade.state().activeTaskId, collaborationStore.state().tasks[0].taskId);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("令狐旧四模块默认文案升级后收敛为三项职责且不覆盖用户自建文案", () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "linghu-prompt-v2-migration-"));
  const storePath = path.join(directory, "linghu.json");
  try {
    const original = createTestLinghuStore(storePath);
    original.createPrompt({ title: "用户自建", content: "保留用户自己维护的具体执行约束。" });
    const legacy = JSON.parse(readFileSync(storePath, "utf8"));
    legacy.version = 1;
    legacy.currentModule = "architecture-recovery";
    legacy.prompts.find((prompt) => prompt.promptId === "linghu-default-flow-guardian").content = "页面审核以客户易用为第一目标，执行四个模块。";
    writeFileSync(storePath, JSON.stringify(legacy), "utf8");
    rmSync(`${storePath}.bak`, { force: true });

    const migrated = createTestLinghuStore(storePath).state();
    assert.equal(migrated.version, 2);
    assert.equal(migrated.currentModule, "flow-completion");
    assert.match(migrated.prompts.find((prompt) => prompt.promptId === "linghu-default-flow-guardian").content, /第二职责是检查测试漏点/);
    assert.match(migrated.prompts.find((prompt) => prompt.promptId === "linghu-default-flow-guardian").content, /第三职责是检查日志审计完整性/);
    assert.equal(migrated.prompts.find((prompt) => prompt.title === "用户自建").content, "保留用户自己维护的具体执行约束。");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
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

test("令狐对同一故障指纹最多执行三次恢复副作用但继续检测", async () => {
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
    await facade.checkNow();
    collaborationStore.updateTask(facade.state().activeTaskId, "test.blocked", (task) => {
      task.state = "blocked";
      task.blockingReason = "固定基础设施故障";
    });
    await facade.checkNow();
    await facade.checkNow();
    await facade.checkNow();
    await facade.checkNow();
    assert.equal(recoveryRequests, 3);
    assert.equal(facade.state().enabled, true);
    assert.match(facade.state().blockingReason, /检测仍保持运行/);
    collaborationStore.updateTask(facade.state().activeTaskId, "test.phase_changed", (task) => {
      task.phase = "reviewing";
    });
    await facade.checkNow();
    assert.equal(recoveryRequests, 4);
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
      repairFailedUnifiedTest: async (taskId) => {
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

test("同一统一测试故障最多触发三次令狐源码修复", async () => {
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
      repairFailedUnifiedTest: async () => { repairRequests += 1; return true; },
    };
    const store = createTestLinghuStore(path.join(directory, "linghu.json"));
    store.setEnabled(true);
    const facade = new LinghuAutomationFacade({ store, collaboration, readWorkspaceState: () => workspaceState, locale: () => "zh-CN", recordEvent: () => undefined, readTestResourceState: idleTestResourceState, runUnifiedTestAndRestart: async () => undefined });
    await facade.checkNow();
    await facade.checkNow();
    await facade.checkNow();
    await facade.checkNow();
    assert.equal(repairRequests, 3);
    assert.equal(facade.state().enabled, true);
    assert.match(facade.state().blockingReason, /安全恢复三次/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("令狐遇到本地修改归属门禁时报告真实人物与阶段且不重复恢复", async () => {
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
      task.integrationFailure = { kind: "local-change-ownership", detail: task.blockingReason, conflictFiles: ["apps/ai-desktop/electron/main.ts"], baseSha: "base", resultSha: "result", generation: 1, occurredAt: new Date().toISOString() };
    });
    let continueRequests = 0;
    const events = [];
    const collaboration = {
      state: () => collaborationStore.state(),
      setMode: (mode) => collaborationStore.setMode(mode),
      continueTask: () => { continueRequests += 1; return collaborationStore.state(); },
      recoverTask: () => { continueRequests += 1; return collaborationStore.state(); },
    };
    const store = createTestLinghuStore(path.join(directory, "linghu.json"));
    store.setEnabled(true);
    const facade = new LinghuAutomationFacade({
      store, collaboration, readWorkspaceState: () => workspaceState, locale: () => "zh-CN",
      recordEvent: (type, details) => events.push({ type, details }), readTestResourceState: idleTestResourceState,
      runUnifiedTestAndRestart: async () => undefined,
    });
    await facade.checkNow();
    await facade.checkNow();
    assert.equal(continueRequests, 0);
    assert.match(facade.state().blockingReason, /墨彩环负责/);
    assert.match(facade.state().blockingReason, /版本集成阶段/);
    assert.match(facade.state().blockingReason, /main\.ts 未登记/);
    assert.match(facade.state().blockingReason, /不会把同一份本地修改反复送回集成/);
    assert.equal(events.filter((event) => event.type === "linghu.automation.local_change_ownership_waiting").length, 1);
  } finally { rmSync(directory, { recursive: true, force: true }); }
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
      emitState: () => undefined,
      emitStream: () => undefined,
    });
    const state = coordinator.submitTask({ title: "权限恢复", problemStatement: "固定命令需要授权", confirmedIntent: "授权后继续原任务", workspaceState, locale: "zh-CN", preferredExecutorMemberId: "yuan-yao" });
    const taskId = state.tasks.at(-1).taskId;
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

test("令狐活动任务记录缺失时保留恢复点并派发同模块替代任务", async () => {
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
    await facade.checkNow();
    hiddenTaskId = facade.state().activeTaskId;
    await facade.checkNow();
    assert.notEqual(facade.state().activeTaskId, hiddenTaskId);
    assert.match(facade.state().recoveryCheckpoint, /replacement-task:missing-task:/);
    assert.equal(collaborationStore.state().tasks.length, 2);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("令狐活动任务被取消后释放失效指针并继续派发同模块替代任务", async () => {
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
    await facade.checkNow();
    const cancelledTaskId = facade.state().activeTaskId;
    collaborationStore.cancelTask(cancelledTaskId);
    await facade.checkNow();
    assert.notEqual(facade.state().activeTaskId, cancelledTaskId);
    assert.equal(facade.state().enabled, true);
    assert.equal(facade.state().flowSnapshots.some((snapshot) => snapshot.sourceTaskId === cancelledTaskId), false);
    assert.match(facade.state().recoveryCheckpoint, /active-task:|replacement-task:/);
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
  const runner = readFileSync(new URL("../electron/services/capabilities/testing/internal/fixed-unified-test.runner.ts", import.meta.url), "utf8");
  const facade = readFileSync(new URL("../electron/services/personas/linghu/linghu-automation.facade.ts", import.meta.url), "utf8");
  const main = readFileSync(new URL("../electron/main.ts", import.meta.url), "utf8");
  assert.match(runner, /\["test:interaction", "test:collaboration", "test:managed", "package:mac:developer", "verify:mac:developer"\]/);
  assert.doesNotMatch(runner, /confirmedIntent|prompt\.content/);
  assert.match(facade, /#completeModule[\s\S]*await this\.#runUnifiedTestAndRestart\(\(\) =>/);
  assert.match(facade, /automation\.unified_test_failed[\s\S]*currentModule = "flow-completion"/);
  assert.match(linghuRuntimeSource, /createFixedUnifiedTestRunner[\s\S]*await unifiedTests\.run\(\)[\s\S]*onVerified\(\)[\s\S]*options\.unifiedTest\.onVerified\(executable\)/);
  assert.match(main, /unifiedTest:[\s\S]*onVerified: \(executable\)[\s\S]*app\.relaunch\(\{ execPath: executable[\s\S]*app\.exit\(0\)/);
  assert.match(main, /IntegrationReleaseCoordinatorFacade[\s\S]*createReleaseBatchStore[\s\S]*createVersionIntegrationPipeline[\s\S]*acquireRelease[\s\S]*publishRelease/);
  assert.match(main, /linghuRuntime!\.runUnifiedTests\(rootPath\)[\s\S]*stageVerifiedDeveloperExecutable\(candidateExecutable, projectPaths\.buildRoot, releaseBatchId\)/);
  assert.match(coordinatorSource, /integrationPipeline\.schedule\(\)/);
  assert.doesNotMatch(coordinatorSource, /createReleaseCandidate|promoteIntegrationCandidate|mergeIntoLocalBranch|releaseDocument\.state/);
  assert.match(integrationPipelineSource, /createReleaseCandidate[\s\S]*releaseDocument\.state = "testing"[\s\S]*promoteIntegrationCandidate[\s\S]*mergeIntoLocalBranch[\s\S]*releaseDocument\.state = "published"/);
  assert.doesNotMatch(integrationPipelineSource, /LINGHU_MEMBER_ID|linghu-ancestor|令狐老祖/);
  assert.match(releaseBatchStoreSource, /initiatorMemberId[\s\S]*state: "frozen", initiatorMemberId/);
  assert.doesNotMatch(releaseBatchStoreSource, /linghu-ancestor/);
  assert.match(facade, /automaticFlowSnapshots[\s\S]*faultFingerprint[\s\S]*moduleCompletionReport/);
  assert.match(main, /const testResources = new TestResourceCoordinatorFacade[\s\S]*createTaskWorktreeTestRunner\([\s\S]*verifyCandidate:[\s\S]*testResources\.run[\s\S]*linghuRuntime!\.runUnifiedTests\(rootPath\)/);
  assert.doesNotMatch(main, /TestExecutionGate|test-execution-gate/);
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
    writeFileSync(path.join(repositoryRoot, "unknown.txt"), "dirty\n");
    const manager = new VersionWorkspaceManager(repositoryRoot, path.join(directory, "managed-worktrees"));
    await assert.rejects(() => manager.transferOwnedLocalChanges([]), LocalChangeOwnershipError);
    assert.match(git(repositoryRoot, "status", "--porcelain"), /unknown\.txt/);
    assert.equal(readFileSync(path.join(repositoryRoot, "unknown.txt"), "utf8"), "dirty\n");
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

test("一键清空把候选回收与数据库清理解耦并核对全部持久状态", () => {
  const main = readFileSync(new URL("../electron/main.ts", import.meta.url), "utf8");
  assert.match(main, /releaseBatches\.failedCandidateBranches\(\)/);
  assert.match(main, /clearFailedTestReleaseCandidates[\s\S]*\.catch\(/);
  assert.match(main, /collaborationStore\.assertTestDataCleared\(\)/);
  assert.match(main, /nangongStore\.assertTestDataCleared\(\)/);
  assert.match(main, /linghuRuntime!\.assertTestDataCleared\(\)/);
  assert.match(main, /candidateCleanupWarnings: candidateCleanup\.failures/);
});

test("已有同代成功候选时自动分配重试分支而不阻断统一测试", async () => {
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
    const manager = new VersionWorkspaceManager(repositoryRoot, path.join(directory, "managed-worktrees"));
    const candidate = await manager.createReleaseCandidate("release-0.1.1-g1-retry", "0.1.1", 1, [{ taskId: "TASK-RETRY", versionWorkspace: { resultSha } }]);
    assert.equal(candidate.branchName, "release/0.1.1-rc-g1-r2");
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
    assert.match(next.flowEvents.at(-1).summary, /禁止重复集成旧 resultSha/);
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
    const stagedExecutable = stageVerifiedDeveloperExecutable(sourceExecutable, stableBuildRoot, "release-0.1.1-g14");
    const stagedApp = path.resolve(path.dirname(stagedExecutable), "../..");
    const stagedFrameworkLink = path.join(stagedApp, "Contents", "Frameworks", "Electron Framework.framework", "Electron Framework");
    assert.equal(readFileSync(stagedExecutable, "utf8"), "verified candidate");
    assert.equal(path.isAbsolute(readlinkSync(stagedFrameworkLink)), false, "稳定应用必须把候选绝对链接改写为应用包内相对链接");
    assert.match(stagedExecutable, /package\/published\/release-0\.1\.1-g14\/AI Desktop\.app\/Contents\/MacOS\/AI Desktop$/);
    rmSync(candidateRoot, { recursive: true, force: true });
    assert.equal(existsSync(sourceExecutable), false);
    assert.equal(readFileSync(stagedExecutable, "utf8"), "verified candidate", "候选回收后稳定发布程序必须继续存在");
    assert.equal(readFileSync(stagedFrameworkLink, "utf8"), "verified framework", "候选回收后稳定应用的框架链接必须仍可解析");
    assert.throws(() => stageVerifiedDeveloperExecutable(stagedExecutable, stableBuildRoot, "release-0.1.1-g14"), /禁止覆盖/);
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
  ].map((fileName) => readFileSync(new URL(`../ruleengine/rules/local/XUNAN/selplat/应用/ai-desktop/rule/${fileName}`, import.meta.url), "utf8")).join("\n");
  assert.match(rule, /^rule_version = \d+\.\d+\.\d+$/m);
  assert.match(rule, /ai_desktop_shared_conversation_component_contract = selConversation_registered_before_implementation \+ hanli_and_nangong_same_formal_exports/);
  assert.match(rule, /nangong_distribution_planning_contract = AI_read_only_investigation/);
  assert.match(rule, /linghu_exception_intake_loop_prevention_contract = single_event_center_entry/);
  assert.match(rule, /evolution_workspace_information_architecture_contract = one_expandable_tree_people_evolution_audit_with_groups_and_leaves/);
  assert.match(rule, /ai_desktop_test_data_reset_contract = settings_danger_action_with_SELUI_confirm/);
  assert.match(rule, /evolution_workspace_window_contract = main_window_conversation_only/);
  assert.match(rule, /respectful_listening_and_correction_are_nangong_personality/);
  assert.match(rule, /reflect_current_concern_not_mechanical_template/);
  assert.match(rule, /never_expand_user_intent/);
  assert.match(rule, /codex_conversation_backfill_contract = one_training_corpus_table_with_codex_nangong_hanli_source/);
  assert.match(rule, /workflow_event_center_single_entry_contract = EventCenterFacade_to_archive_and_main_process_SQLite/);
  assert.match(rule, /opt_in_codex_work_desktop_current_workspace_task_complete_watch_plus_startup_backfill/);
  assert.match(rule, /codex_app_ingestion_default_off_and_user_toggleable/);
  assert.match(rule, /workflow_event_center_stall_contract = independent_30_second_supervisor_plus_120_second_timeout_plus_fault_fact_dedup_plus_linghu_handoff/);
  assert.match(rule, /nangong_next_evolution_launcher_contract = completed_and_accepted_plus_automatic_evolution_enabled_plus_reciprocal_topic_ids_plus_idempotent_restart/);
  assert.match(rule, /nangong_one_shot_complete_evolution_contract = AI_semantic_maturity_then_canonical_visible_invitation_creates_persisted_waiting_confirmation[\s\S]*no_hidden_metadata_readiness_field[\s\S]*preserve_all_long_term_automation_switches[\s\S]*no_parallel_approval_distribution_recovery_or_acceptance_route/);
  assert.match(rule, /blocked_task_records_one_unified_failure_and_never_directly_recovers_on_state_change/);
  assert.match(rule, /collaboration_member_self_upgrade_contract = all_registered_members_same_domain_flow[\s\S]*no_display_name_business_branch/);
  assert.match(rule, /linghu_integration_release_contract = IntegrationReleaseCoordinatorFacade_single_entry[\s\S]*unified_tests_package_and_verification_run_on_candidate_root/);
  assert.match(rule, /collaboration_clean_merge_contract = changed_task_worktree_creates_exactly_one_final_local_commit[\s\S]*unknown_overlap_multi_task_or_dirty_task_worktree_blocks_without_guessing/);
  assert.match(rule, /linghu_automation_module_cycle_contract = all_persons_flow_completion_first -> test_coverage_gap_and_capability_upgrade -> audit_log_completeness/);
  assert.match(rule, /linghu_test_capability_upgrade_contract = TestResourceCoordinatorFacade_single_entry/);
  assert.match(rule, /linghu_automation_flow_snapshot_contract = all_persons_non_terminal_tasks_only/);
  assert.match(rule, /collaboration_merge_conflict_correction_contract = capture_unmerged_files_stdout_stderr_baseSHA_resultSHA_and_generation_before_merge_abort/);
  assert.match(rule, /evolution_person_workspace_ui_contract = selui_formal_exports_and_theme_tokens_only/);
  assert.match(rule, /linghu_automation_recovery_fingerprint_contract = task_state_phase_generation_blocking_kind_reason_and_progress_fingerprint/);
  assert.match(rule, /local_change_ownership_blocks_without_automatic_retry_until_ownership_fact_changes_or_human_continue/);
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
  const store = readFileSync(new URL("../electron/services/workflow/internal/collaboration.store.ts", import.meta.url), "utf8");
  const facade = readFileSync(new URL("../electron/services/personas/linghu/linghu-automation.facade.ts", import.meta.url), "utf8");
  assert.match(store, /continueTask\(taskId: string, recoveryActor\?: Pick<CollaborationMember/);
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
    const continued = restored.continueTask(task.taskId);
    const continuedTask = continued.tasks.find((candidate) => candidate.taskId === task.taskId);
    assert.equal(continuedTask.state, "queued-executor");
    assert.equal(continuedTask.executorMemberId, "song-yu");
    assert.equal(continuedTask.assignmentId, null);
    assert.equal(continued.members.find((candidate) => candidate.memberId === "song-yu").state, "idle");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
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
  assert.match(developerSource, /task\.plans\.map[\s\S]*plan\.ownerDisplayName/);
  assert.doesNotMatch(developerSource, /task\.reviewAttempts\.map|attempt\.reviewerDisplayName/);
  assert.match(developerSource, /task\.executionRecords\.map[\s\S]*record\.executor\.displayName/);
  assert.match(developerSource, /task-fact-strip[\s\S]*task\.initiator\?\.displayName/);
  assert.match(developerSource, /\["recovering", "blocked", "test-failed"\]\.includes\(currentTask\.state\)/);
  assert.match(developerSource, /record\.changedFiles/);
  assert.match(developerSource, /currentTask\?\.initiator\?\.displayName/);
  assert.match(developerSource, /<details key=\{currentTask\.taskId\} className="member-task-detail">/);
  assert.match(developerSource, /任务详细 · \$\{taskInitiatorName\}/);
  assert.doesNotMatch(developerSource, /<details[^>]*className="member-task-detail"[^>]*\sopen(?:\s|=|>)/);
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
  const coordinator = readFileSync(new URL("../electron/services/workflow/collaboration-workflow.facade.ts", import.meta.url), "utf8");
  const sessions = readFileSync(new URL("../electron/services/capabilities/conversation/internal/collaboration-codex-sessions.ts", import.meta.url), "utf8");
  assert.match(coordinator, /status: "ready-for-execution"/);
  assert.match(coordinator, /await this\.#execute\(taskId\)/);
  assert.doesNotMatch(coordinator, /createReviewer|scheduleReviewers|beginReview/);
  assert.match(sessions, /执行人物技术分析/);
  assert.match(sessions, /不要重新解释客户为什么要做/);
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
    cleanupIntegrationDependencyLinks(candidate);
    assert.equal(existsSync(path.join(candidate, "node_modules")), false);
    assert.equal(existsSync(buildModules), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("开发人物工作树通过 Git 登记签发共享依赖租约并在结束时只解除链接", async () => {
  const repository = mkdtempSync(path.join(controlledTempRoot, "collaboration-dependency-lease-"));
  const worktree = path.join(controlledTempRoot, `collaboration-dependency-lease-worktree-${Date.now()}`);
  const desktopRoot = path.join(repository, "apps", "ai-desktop");
  const lockContent = "managed-shared-lock";
  try {
    mkdirSync(desktopRoot, { recursive: true });
    mkdirSync(path.join(desktopRoot, "scripts"), { recursive: true });
    writeFileSync(path.join(desktopRoot, "package-lock.json"), lockContent, "utf8");
    writeFileSync(path.join(desktopRoot, "package.json"), JSON.stringify({ name: "ai-desktop" }), "utf8");
    writeFileSync(
      path.join(desktopRoot, "scripts", "dependency-cache.mjs"),
      readFileSync(new URL("../scripts/dependency-cache.mjs", import.meta.url), "utf8"),
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
    writeFileSync(path.join(sourceModules, ".bin", process.platform === "win32" ? "tsc.cmd" : "tsc"), "ready", "utf8");
    const electronExecutable = process.platform === "win32" ? "electron.exe" : "Electron";
    writeFileSync(path.join(sourceModules, "electron", "path.txt"), electronExecutable, "utf8");
    writeFileSync(path.join(sourceModules, "electron", "dist", electronExecutable), "ready", "utf8");

    const lease = await acquireManagedDependencyLease(worktree, repository, "ai-desktop", "executor-song-yu-g1");
    const validationLease = await acquireManagedDependencyLease(worktree, repository, "ai-desktop", "task-validation-1");
    assert.deepEqual(lease.environment, { AI_DESKTOP_DEPENDENCY_LEASE_ID: "executor-song-yu-g1" });
    assert.equal(realpathSync(path.join(worktree, "apps", "ai-desktop", "node_modules")), realpathSync(sourceModules));
    const probeModule = pathToFileURL(path.join(worktree, "apps", "ai-desktop", "scripts", "dependency-cache.mjs")).href;
    const probe = JSON.parse(execFileSync(process.execPath, [
      "--input-type=module",
      "-e",
      `const module = await import(${JSON.stringify(probeModule)}); process.stdout.write(JSON.stringify(module.resolveDependencyCache()));`,
    ], { encoding: "utf8", env: { ...process.env, ...lease.environment } }));
    assert.equal(probe.projectRoot, worktree);
    assert.equal(probe.cacheProjectRoot, repository);
    assert.equal(probe.dependencyCacheRoot, path.join(repository, "cache", "ai-desktop", "dependencies"));
    assert.equal(probe.dependencyLeaseId, "executor-song-yu-g1");
    releaseManagedDependencyLease(validationLease);
    assert.equal(existsSync(path.join(worktree, "apps", "ai-desktop", "node_modules")), true);
    releaseManagedDependencyLease(lease);
    assert.equal(existsSync(path.join(worktree, "apps", "ai-desktop", "node_modules")), false);
    assert.equal(existsSync(sourceModules), true);
  } finally {
    try { git(repository, "worktree", "remove", "--force", worktree); } catch {}
    rmSync(repository, { recursive: true, force: true });
    rmSync(worktree, { recursive: true, force: true });
  }
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
  const executor = new ManagedTaskExecutor();
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
    runCodeValidation: async () => { desktopValidationCount += 1; },
  });
  assert.equal(turnCount, 1);
  assert.equal(desktopValidationCount, 1);
  assert.equal(result.managedStatus, "code-verified");
  assert.equal(events.some((event) => event.managedExecution?.message.includes("当前任务分支隔离 Playwright 已通过")), true);
});

test("协同固定测试按签发 worktree 执行并隔离任务缓存和输出", () => {
  const runner = readFileSync(new URL("../electron/services/capabilities/testing/internal/task-worktree-test.runner.ts", import.meta.url), "utf8");
  const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const dependencyVerifier = readFileSync(new URL("../electron/services/capabilities/release/internal/integration.verifier.ts", import.meta.url), "utf8");
  const sessions = readFileSync(new URL("../electron/services/capabilities/conversation/internal/collaboration-codex-sessions.ts", import.meta.url), "utf8");
  const codex = readFileSync(new URL("../electron/services/platform/codex/codex.facade.ts", import.meta.url), "utf8");
  const config = readFileSync(new URL("../playwright.interaction.config.ts", import.meta.url), "utf8");
  assert.match(runner, /worktreeRoot/);
  assert.match(runner, /test-cache|PLAYWRIGHT_BROWSERS_PATH/);
  assert.match(runner, /AI_DESKTOP_TEST_TASK_ID/);
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
  assert.match(sessions, /dependencyLeaseId: dependencyLease\?\.leaseId/);
  assert.match(codex, /isDesktopOwnedValidationCommand/);
  assert.match(codex, /无需 Agent 申请 Playwright 权限/);
  assert.match(config, /AI_DESKTOP_TEST_TASK_ID/);
});

test("协同编排保持独立执行连接、心跳和整轮封存集成契约", () => {
  const coordinator = readFileSync(new URL("../electron/services/workflow/collaboration-workflow.facade.ts", import.meta.url), "utf8");
  const sessions = readFileSync(new URL("../electron/services/capabilities/conversation/internal/collaboration-codex-sessions.ts", import.meta.url), "utf8");
  const workspaces = readFileSync(new URL("../electron/services/capabilities/release/internal/version-workspace.manager.ts", import.meta.url), "utf8");
  const integrationVerifier = readFileSync(new URL("../electron/services/capabilities/release/internal/integration.verifier.ts", import.meta.url), "utf8");
  const ui = readFileSync(new URL("../src/variants/developer/DeveloperApp.tsx", import.meta.url), "utf8");
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
  assert.match(integrationVerifier, /ensureBuildDependencyLink\(candidateDesktopRoot, sourceModules\)/);
  assert.match(integrationVerifier, /releaseManagedDependencyLease\(dependencyLease\)/);
  assert.doesNotMatch(ui, /reviewAttempts\.some|decision-unrecognized/);
  const memberPageSource = ui.slice(ui.indexOf("function CollaborationMemberPage"), ui.indexOf("function collaborationMemberStateLabel"));
  assert.doesNotMatch(memberPageSource, /durationMs|总耗时/);
  assert.match(ui, /CollaborationExecutionList/);
  assert.match(ui, /任务结果摘要/);
});
