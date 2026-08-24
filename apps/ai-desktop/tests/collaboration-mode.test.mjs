import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { CollaborationDurationLog } from "../../../build/ai-desktop/electron/electron/services/collaboration/collaboration-duration-log.js";
import { nextReviewAction } from "../../../build/ai-desktop/electron/electron/services/collaboration/collaboration-coordinator.js";
import { createCollaborationResultSummary } from "../../../build/ai-desktop/electron/electron/services/collaboration/result/result-summary.js";
import { parseCollaborationReviewDecision, resolveCollaborationReviewDecision } from "../../../build/ai-desktop/electron/electron/services/collaboration/review/review-decision-parser.js";
import { cleanupIntegrationDependencyLinks, ensureIntegrationDependencies } from "../../../build/ai-desktop/electron/electron/services/collaboration/integration-verifier.js";
import { stageVerifiedDeveloperExecutable } from "../../../build/ai-desktop/electron/electron/services/collaboration/verified-package-release.js";
import { CollaborationStore } from "../../../build/ai-desktop/electron/electron/services/collaboration/collaboration-store.js";
import { LinghuAutomationFacade } from "../../../build/ai-desktop/electron/electron/services/collaboration/linghu-automation-facade.js";
import { LinghuAutomationStore } from "../../../build/ai-desktop/electron/electron/services/collaboration/linghu-automation-store.js";
import { TestResourceCoordinatorFacade } from "../../../build/ai-desktop/electron/electron/services/collaboration/test-resource-coordinator-facade.js";
import { IntegrationReleaseCoordinatorFacade } from "../../../build/ai-desktop/electron/electron/services/collaboration/integration-release-coordinator-facade.js";
import { LocalChangeOwnershipError, MergeConflictError, VersionWorkspaceManager } from "../../../build/ai-desktop/electron/electron/services/collaboration/version-workspace-manager.js";
import { ManagedTaskExecutor } from "../../../build/ai-desktop/electron/electron/services/managed-task-executor.js";
import { controlledTestRoot, projectRoot } from "./test-paths.mjs";

const controlledTempRoot = controlledTestRoot;
mkdirSync(controlledTempRoot, { recursive: true });
const developerSource = readFileSync(new URL("../src/variants/developer/DeveloperApp.tsx", import.meta.url), "utf8");
const coordinatorSource = readFileSync(new URL("../electron/services/collaboration/collaboration-coordinator.ts", import.meta.url), "utf8");
const collaborationContractSource = readFileSync(new URL("../contracts/collaboration.ts", import.meta.url), "utf8");
const unifiedTestRunnerSource = readFileSync(new URL("../electron/services/collaboration/linghu-unified-test-runner.ts", import.meta.url), "utf8");
const integrationVerifierSource = readFileSync(new URL("../electron/services/collaboration/integration-verifier.ts", import.meta.url), "utf8");
const idleTestResourceState = () => ({ holder: null, waiters: [], localQueueDepth: 0, lastEvent: null });

function runCoordinatorWorker(coordinationRoot, runId, buildRoot, holdMilliseconds) {
  const worker = new URL("./fixtures/test-resource-coordinator-worker.mjs", import.meta.url);
  const moduleUrl = new URL("../../../build/ai-desktop/electron/electron/services/collaboration/test-resource-coordinator-facade.js", import.meta.url).href;
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
  const moduleUrl = new URL("../../../build/ai-desktop/electron/electron/services/collaboration/integration-release-coordinator-facade.js", import.meta.url).href;
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
  assert.match(developerSource, /review-failed[\s\S]*重新审批/);
  assert.match(developerSource, /test-failed[\s\S]*重新测试/);
  assert.match(collaborationContractSource, /repairing-review/);
  assert.match(collaborationContractSource, /repairing-execution/);
  assert.match(collaborationContractSource, /unified-testing/);
  assert.match(coordinatorSource, /review\.repair_completed[\s\S]*preferredReviewerMemberId/);
  assert.match(coordinatorSource, /execution\.repair_completed[\s\S]*preferredExecutorMemberId/);
  assert.match(coordinatorSource, /令狐老祖正在统一测试/);
  assert.match(coordinatorSource, /unified_test\.passed/);
  assert.match(coordinatorSource, /unified_test\.failed/);
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
    const automationStore = new LinghuAutomationStore(storePath);
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
    const restored = new LinghuAutomationStore(storePath).state();
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

test("令狐生产修正先提交韩立审批并在返还任务后恢复持续执行", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "linghu-evolution-approval-"));
  try {
    const collaborationStore = new CollaborationStore(path.join(directory, "collaboration.json"));
    collaborationStore.setMode("collaboration");
    const collaboration = {
      state: () => collaborationStore.state(),
      setMode: (mode) => collaborationStore.setMode(mode),
      submitTask: (request) => { collaborationStore.submitTask(request); return collaborationStore.state(); },
    };
    const automationStore = new LinghuAutomationStore(path.join(directory, "linghu.json"));
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
    assert.equal(facade.state().pendingRepairProposalId, "linghu-proposal-1");
    assert.equal(collaborationStore.state().tasks.length, 0, "审批前不得创建修正执行任务");
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
    const original = new LinghuAutomationStore(storePath);
    original.createPrompt({ title: "用户自建", content: "保留用户自己维护的具体执行约束。" });
    const legacy = JSON.parse(readFileSync(storePath, "utf8"));
    legacy.version = 1;
    legacy.currentModule = "architecture-recovery";
    legacy.prompts.find((prompt) => prompt.promptId === "linghu-default-flow-guardian").content = "页面审核以客户易用为第一目标，执行四个模块。";
    writeFileSync(storePath, JSON.stringify(legacy), "utf8");
    rmSync(`${storePath}.bak`, { force: true });

    const migrated = new LinghuAutomationStore(storePath).state();
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
    const store = new LinghuAutomationStore(storePath);
    store.setEnabled(true);
    store.updateRuntime("test.checkpoint", (state) => {
      state.detectionCursor = "2026-08-23T10:00:00.000Z";
      state.recoveryCheckpoint = "active-task:TASK-1:flow-completion";
    });
    writeFileSync(storePath, "{损坏状态", "utf8");
    const restored = new LinghuAutomationStore(storePath).state();
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
    const store = new LinghuAutomationStore(storePath);
    store.setEnabled(true);
    writeFileSync(storePath, "{主文件损坏", "utf8");
    writeFileSync(`${storePath}.bak`, "{备份损坏", "utf8");
    const rebuilt = new LinghuAutomationStore(storePath).state();
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
    const automationStore = new LinghuAutomationStore(path.join(directory, "linghu.json"));
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
    const automationStore = new LinghuAutomationStore(path.join(directory, "linghu.json"));
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
    const store = new LinghuAutomationStore(path.join(directory, "linghu.json"));
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
    const store = new LinghuAutomationStore(path.join(directory, "linghu.json"));
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
    const store = new LinghuAutomationStore(path.join(directory, "linghu.json"));
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
  const runner = readFileSync(new URL("../electron/services/collaboration/linghu-unified-test-runner.ts", import.meta.url), "utf8");
  const facade = readFileSync(new URL("../electron/services/collaboration/linghu-automation-facade.ts", import.meta.url), "utf8");
  const main = readFileSync(new URL("../electron/main.ts", import.meta.url), "utf8");
  assert.match(runner, /\["test:interaction", "test:collaboration", "test:managed", "package:mac:developer", "verify:mac:developer"\]/);
  assert.doesNotMatch(runner, /confirmedIntent|prompt\.content/);
  assert.match(facade, /#completeModule[\s\S]*await this\.#runUnifiedTestAndRestart\(\(\) =>/);
  assert.match(facade, /automation\.unified_test_failed[\s\S]*currentModule = "flow-completion"/);
  assert.match(main, /await linghuUnifiedTests\.run\(\)[\s\S]*onVerified\(\)[\s\S]*resolveVerifiedDeveloperExecutable[\s\S]*app\.relaunch\(\{ execPath: executable[\s\S]*app\.exit\(0\)/);
  assert.match(main, /IntegrationReleaseCoordinatorFacade[\s\S]*ReleaseBatchStore[\s\S]*acquireIntegrationRelease[\s\S]*publishIntegration/);
  assert.match(main, /linghuUnifiedTests\.run\(rootPath\)[\s\S]*stageVerifiedDeveloperExecutable\(candidateExecutable, projectPaths\.buildRoot, releaseBatchId\)/);
  assert.match(coordinatorSource, /#verifyIntegration\(candidate\.rootPath, taskIds, releaseBatchId\)[\s\S]*retireCandidate[\s\S]*#publishIntegration\(publishedExecutable, releaseBatchId\)/);
  assert.match(coordinatorSource, /createReleaseCandidate[\s\S]*releaseDocument\.state = "testing"[\s\S]*releaseDocument\.state = "published"/);
  assert.match(facade, /automaticFlowSnapshots[\s\S]*faultFingerprint[\s\S]*moduleCompletionReport/);
  assert.match(main, /const testResources = new TestResourceCoordinatorFacade[\s\S]*new LinghuUnifiedTestRunner\([\s\S]*new TaskWorktreeTestRunner\([\s\S]*verifyIntegration:[\s\S]*testResources\.run[\s\S]*linghuUnifiedTests\.run\(rootPath\)/);
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
    assert.equal(next.recoveryTargetState, "approved");
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
  const rule = readFileSync(new URL("../../rule-engine/backend/src/main/resources/local/XUNAN/selplat/应用/ai-desktop/rule/RUL_AIDesktop官方Harness接入规则.md", import.meta.url), "utf8");
  assert.match(rule, /rule_version = 5\.83\.0/);
  assert.match(rule, /upgrade_record_5_83 = [^\n]*所有登记人物共用原提交人校验和不可覆盖修订版本/);
  assert.match(rule, /collaboration_member_self_upgrade_contract = all_registered_members_same_domain_flow[\s\S]*no_display_name_business_branch/);
  assert.match(rule, /linghu_integration_release_contract = IntegrationReleaseCoordinatorFacade_single_entry[\s\S]*unified_tests_package_and_verification_run_on_candidate_root/);
  assert.match(rule, /collaboration_clean_merge_contract = changed_task_worktree_creates_exactly_one_final_local_commit[\s\S]*unknown_overlap_multi_task_or_dirty_task_worktree_blocks_without_guessing/);
  assert.match(rule, /linghu_automation_module_cycle_contract = all_persons_flow_completion_first -> test_coverage_gap_and_capability_upgrade -> audit_log_completeness/);
  assert.match(rule, /linghu_test_capability_upgrade_contract = TestResourceCoordinatorFacade_single_entry/);
  assert.match(rule, /linghu_automation_flow_snapshot_contract = all_persons_non_terminal_tasks_only/);
  assert.match(rule, /collaboration_merge_conflict_correction_contract = capture_unmerged_files_stdout_stderr_baseSHA_resultSHA_and_generation_before_merge_abort/);
  assert.match(rule, /evolution_person_workspace_ui_contract = selui_formal_exports_and_theme_tokens_only/);
  assert.match(rule, /linghu_automation_recovery_fingerprint_contract = task_state_phase_generation_blocking_kind_reason_and_progress_fingerprint/);
  assert.match(rule, /linghu_automation_state_recovery_contract/);
  assert.match(rule, /linghu_module_completion_report_contract/);
});

test("自动恢复保留令狐老祖负责人和回流说明", () => {
  const store = readFileSync(new URL("../electron/services/collaboration/collaboration-store.ts", import.meta.url), "utf8");
  const facade = readFileSync(new URL("../electron/services/collaboration/linghu-automation-facade.ts", import.meta.url), "utf8");
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
  assert.match(developerSource, /task\.reviewAttempts\.map[\s\S]*attempt\.reviewerDisplayName/);
  assert.match(developerSource, /task\.executionRecords\.map[\s\S]*record\.executor\.displayName/);
  assert.match(developerSource, /task-fact-strip[\s\S]*task\.initiator\?\.displayName/);
  assert.match(developerSource, /\["recovering", "blocked", "review-failed", "test-failed"\]\.includes\(currentTask\.state\)/);
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

test("审核结论兼容标签、Markdown 旧格式和明确中文表达，但拒绝冲突或正文猜测", () => {
  assert.deepEqual(parseCollaborationReviewDecision("审核完成。\n<review_decision>PASSED</review_decision>"), {
    decision: "passed",
    decisionSource: "tag",
  });
  assert.deepEqual(parseCollaborationReviewDecision("```text\n**DECISION: REJECTED**\n```"), {
    decision: "rejected",
    decisionSource: "legacy-marker",
  });
  assert.deepEqual(parseCollaborationReviewDecision("### 审核意见\n审核结论：通过"), {
    decision: "passed",
    decisionSource: "explicit-chinese",
  });
  assert.equal(parseCollaborationReviewDecision("方案通过类型检查，但仍需补测试。"), null);
  assert.equal(parseCollaborationReviewDecision("<review_decision>PASSED</review_decision>\n<review_decision>REJECTED</review_decision>"), null);
});

test("审核正文无法识别时只补取一次结论并保留原正文", async () => {
  let clarificationCount = 0;
  const clarified = await resolveCollaborationReviewDecision("方案覆盖完整，建议通过。", async () => {
    clarificationCount += 1;
    return "<review_decision>PASSED</review_decision>";
  });
  assert.equal(clarificationCount, 1);
  assert.equal(clarified.outcome, "decided");
  assert.equal(clarified.decision, "passed");
  assert.equal(clarified.decisionSource, "clarification");
  assert.equal(clarified.feedback, "方案覆盖完整，建议通过。");

  const unresolved = await resolveCollaborationReviewDecision("已有完整审核正文。", async () => "仍然没有结构化结论");
  assert.equal(unresolved.outcome, "decision-unrecognized");
  assert.equal(unresolved.rawOutput, "已有完整审核正文。");
  assert.match(unresolved.error, /正文已生成/);
});

test("审核满足最低需求即通过且第三次驳回先最终修正再强制执行", () => {
  assert.equal(nextReviewAction("passed", 0), "execute");
  assert.equal(nextReviewAction("rejected", 1), "optimize-and-review");
  assert.equal(nextReviewAction("rejected", 2), "optimize-and-review");
  assert.equal(nextReviewAction("rejected", 3), "optimize-and-execute");
  const sessions = readFileSync(new URL("../electron/services/collaboration/collaboration-codex-sessions.ts", import.meta.url), "utf8");
  assert.match(sessions, /满足最低需求必须通过/);
  assert.match(sessions, /禁止据此扩大问题或驳回/);
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

test("令狐候选统一测试把外层受控依赖链接传给全部固定脚本", () => {
  assert.match(unifiedTestRunnerSource, /AI_DESKTOP_TEST_TASK_ID: runId/);
  assert.match(unifiedTestRunnerSource, /runNpmScript\(desktopRoot, script, environment\)/);
  assert.match(unifiedTestRunnerSource, /delete environment\.ELECTRON_RUN_AS_NODE/);
  assert.match(integrationVerifierSource, /AI_DESKTOP_TEST_TASK_ID: `integration-/);
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
  const runner = readFileSync(new URL("../electron/services/collaboration/task-worktree-test-runner.ts", import.meta.url), "utf8");
  const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const dependencyVerifier = readFileSync(new URL("../electron/services/collaboration/integration-verifier.ts", import.meta.url), "utf8");
  const sessions = readFileSync(new URL("../electron/services/collaboration/collaboration-codex-sessions.ts", import.meta.url), "utf8");
  const codex = readFileSync(new URL("../electron/services/codex-service.ts", import.meta.url), "utf8");
  const config = readFileSync(new URL("../playwright.interaction.config.ts", import.meta.url), "utf8");
  assert.match(runner, /worktreeRoot/);
  assert.match(runner, /test-cache|PLAYWRIGHT_BROWSERS_PATH/);
  assert.match(runner, /AI_DESKTOP_TEST_TASK_ID/);
  assert.match(runner, /npm run/);
  assert.match(runner, /cleanupIntegrationDependencyLinks\(desktopRoot\)/);
  assert.equal(manifest.scripts["test:interaction"], "npm run build:developer && node scripts/run-with-dependencies.mjs node scripts/run-interaction-tests.mjs");
  assert.match(runner, /expected: "npm run build:developer && node scripts\/run-with-dependencies\.mjs node scripts\/run-interaction-tests\.mjs"/);
  assert.match(dependencyVerifier, /hasElectronRuntime/);
  assert.doesNotMatch(dependencyVerifier, /"ci", "--ignore-scripts"/);
  assert.match(sessions, /runCodeValidation/);
  assert.match(sessions, /validationOwner: "desktop"/);
  assert.match(codex, /isDesktopOwnedValidationCommand/);
  assert.match(codex, /无需 Agent 申请 Playwright 权限/);
  assert.match(config, /AI_DESKTOP_TEST_TASK_ID/);
});

test("旧协同状态加载时补齐审核尝试历史", () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "collaboration-review-migration-"));
  const filePath = path.join(directory, "state.json");
  try {
    const store = new CollaborationStore(filePath);
    const task = store.submitTask({
      title: "审核迁移",
      problemStatement: "旧任务没有审核尝试字段",
      confirmedIntent: "旧任务重启后应自动补齐审核尝试历史。",
      workspaceState,
      locale: "zh-CN",
    });
    const persisted = JSON.parse(readFileSync(filePath, "utf8"));
    delete persisted.tasks.find((candidate) => candidate.taskId === task.taskId).reviewAttempts;
    writeFileSync(filePath, `${JSON.stringify(persisted, null, 2)}\n`, "utf8");
    assert.deepEqual(new CollaborationStore(filePath).task(task.taskId).reviewAttempts, []);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("协同编排保持独立连接、异人审核、三次上限、心跳和即时就绪集成契约", () => {
  const coordinator = readFileSync(new URL("../electron/services/collaboration/collaboration-coordinator.ts", import.meta.url), "utf8");
  const sessions = readFileSync(new URL("../electron/services/collaboration/collaboration-codex-sessions.ts", import.meta.url), "utf8");
  const workspaces = readFileSync(new URL("../electron/services/collaboration/version-workspace-manager.ts", import.meta.url), "utf8");
  const integrationVerifier = readFileSync(new URL("../electron/services/collaboration/integration-verifier.ts", import.meta.url), "utf8");
  const ui = readFileSync(new URL("../src/variants/developer/DeveloperApp.tsx", import.meta.url), "utf8");
  assert.match(sessions, /new CodexService/);
  assert.match(sessions, /codexHome: this\.#options\.codexHome/);
  assert.match(sessions, /serviceName: "selplat_ai_desktop_collaboration"/);
  assert.match(sessions, /migrateLegacySession: true/);
  assert.match(sessions, /role: "executor" \| "reviewer"/);
  assert.match(coordinator, /member\.memberId !== task\.executorMemberId/);
  assert.match(coordinator, /optimize-and-execute/);
  assert.match(coordinator, /member\.heartbeat/);
  assert.match(coordinator, /state === "ready-for-integration"/);
  assert.doesNotMatch(coordinator, /setTimeout\([^)]*integration/i);
  assert.match(workspaces, /codex\/collab/);
  assert.match(workspaces, /codex\/collab\/integration-g\$\{generation\}/);
  assert.doesNotMatch(workspaces, /codex\/collab\/integration\/g\$\{generation\}/);
  assert.match(workspaces, /resultSha/);
  assert.match(integrationVerifier, /ensureBuildDependencyLink\(candidateDesktopRoot, sourceModules\)/);
  assert.match(integrationVerifier, /cleanupIntegrationDependencyLinks\(desktopRoot\)/);
  assert.match(ui, /reviewAttempts\.some/);
  assert.match(ui, /"decision-unrecognized": "结论未识别"/);
  const memberPageSource = ui.slice(ui.indexOf("function CollaborationMemberPage"), ui.indexOf("function collaborationMemberStateLabel"));
  assert.doesNotMatch(memberPageSource, /durationMs|总耗时/);
  assert.match(ui, /CollaborationExecutionList/);
  assert.match(ui, /任务结果摘要/);
});
