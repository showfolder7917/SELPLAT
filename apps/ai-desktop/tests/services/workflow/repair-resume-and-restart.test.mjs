import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { controlledTestRoot, projectRoot } from "#test-paths";
import { CollaborationStore } from "../../../../../build/ai-desktop/electron/electron/services/workflow/internal/collaboration/collaboration.store.js";
import { CollaborationCoordinator } from "../../../../../build/ai-desktop/electron/electron/services/workflow/collaboration-workflow.facade.js";
import { ExecutorFacade } from "../../../../../build/ai-desktop/electron/electron/services/personas/executor/index.js";
import { VersionIntegrationPipeline } from "../../../../../build/ai-desktop/electron/electron/services/support/capabilities/release/internal/version-integration.pipeline.js";

const workspaceState = { primaryId: "root", roots: [{ id: "root", name: "SELPLAT", path: projectRoot, permission: "workspace-write" }] };
const request = { title: "恢复原任务", problemStatement: "原执行失败", confirmedIntent: "修正目标问题", acceptanceCriteria: ["目标行为正常"], workspaceState, locale: "zh-CN", preferredExecutorMemberId: "yuan-yao" };
const durations = { startWait: () => "wait", finish() {}, start: () => "span", instant() {}, interruptOpenSpans() {} };
const verified = { status: "code-verified", text: "目标代码已验证", pendingActions: [], changedFiles: [], successfulCommands: ["targeted-check"] };

test("重启补齐旧受控激活失败的结构化验证事实", () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "activated-failure-migration-"));
  try {
    const file = path.join(directory, "state.json");
    const store = new CollaborationStore(file);
    const submitted = store.submitTask(request);
    store.updateTask(submitted.taskId, "legacy.activation.failed", (task) => {
      task.state = "test-failed";
      task.phase = null;
      task.integrationGeneration = 37;
      task.blockingReason = "候选运行包已激活，但恢复统一测试失败";
      task.unifiedTest = {
        status: "failed", owner: { memberId: "linghu-ancestor", displayName: "令狐老祖" },
        failureReason: "npm run test 失败", startedAt: "2026-09-16T09:00:00.000Z", completedAt: "2026-09-16T09:01:00.000Z",
      };
      delete task.integrationFailure;
    });
    const restored = new CollaborationStore(file).task(submitted.taskId);
    assert.equal(restored.integrationFailure?.kind, "verification");
    assert.equal(restored.integrationFailure?.phase, "verification");
    assert.equal(restored.integrationFailure?.generation, 37);
    assert.equal(restored.integrationFailure?.detail, "npm run test 失败");
    assert.equal(restored.blockingReason, "统一测试发现未通过项，已转入修复");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

for (const complete of [true, false, "invalid"]) test(`修复后按完成证据续接：${complete}`, async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "repair-decision-"));
  let coordinator;
  try {
    const store = new CollaborationStore(path.join(directory, "state.json"));
    const workspace = { workspaceId: "worktree:repair", rootPath: directory, branchName: "codex/repair", baseSha: "base", resultSha: null, createdAt: new Date().toISOString(), retiredAt: null };
    let analysisCount = 0, investigationCount = 0, completionCount = 0, executionCount = 0, commits = 0;
    const plans = [];
    coordinator = new CollaborationCoordinator({
      store, durations,
      workspaces: { prepareTask: async () => workspace, resumeTask: async () => workspace, commitTaskResult: async () => { commits++; return "verified-result"; } },
      executor: new ExecutorFacade({ createExecutor: async () => ({
        isAlive: () => true, dispose: async () => {}, optimize: async () => "",
        analyze: async () => { analysisCount++; return "原整项任务方案"; },
        investigateRepair: async () => { investigationCount++; return "只修复已定位错误"; },
        executeRepair: async () => verified,
        verifyRepairCompletion: async () => {
          completionCount++;
          return complete === "invalid" ? "没有结构化证据"
            : `REPAIR_COMPLETION=${JSON.stringify({ complete, remaining: complete ? "" : "补充边界用例", evidence: "目标源码已检查，主路径验证通过" })}`;
        },
        execute: async (_task, plan) => {
          plans.push(plan.text);
          return ++executionCount === 1 ? {
            status: "incomplete", text: "失败", pendingActions: ["目标错误"], changedFiles: [], authorizedFiles: [], successfulCommands: [],
            failureRouting: {
              kind: "technical-failure", stepPurpose: "implementation", diagnosticContext: "目标实现错误与原任务直接相关",
              verifiedFacts: ["工作区、规则入口与原任务范围均已核对"], rawCommandResults: ["目标错误"],
              taskRelation: "direct", nextRetryAction: "沿原任务进入令狐修复并依据完成证据续接",
            },
          } : verified;
        },
      }) }),
      integrationPipeline: { finishWaitingTask() {}, trackWaitingTask() {}, schedule() {}, dispose() {} },
      emitState() {}, emitStream() {},
    });
    const taskId = coordinator.submitTask(request).taskId;
    for (let i = 0; i < 200 && !["ready-for-integration", "recovering"].includes(store.task(taskId).state); i++) await new Promise(resolve => setTimeout(resolve, 10));
    const task = store.task(taskId);
    assert.equal(analysisCount, 1, "修复后不得重新技术分析整项需求");
    assert.equal(investigationCount, 1, "令狐只调查原故障一次，不得用旧调查入口做完成核对");
    assert.equal(completionCount, 1, "修复后必须通过独立的增量完成核对入口判断结果");
    if (complete === "invalid") {
      assert.equal(task.state, "recovering");
      assert.equal(commits, 0);
      assert.equal(executionCount, 1);
    } else {
      assert.equal(task.state, "ready-for-integration");
      assert.equal(commits, 1);
      assert.equal(executionCount, complete ? 1 : 2);
      assert.equal(task.versionWorkspace.resultSha, "verified-result");
      if (!complete) { assert.match(plans[1], /补充边界用例/); assert.doesNotMatch(plans[1], /原整项任务方案/); }
    }
  } finally { await coordinator?.dispose(); rmSync(directory, { recursive: true, force: true }); }
});

for (const scenario of ["verified", "misclassified", "different-version", "failed-test", "ordinary-failure"]) test(`重启健康确认不越过版本测试门：${scenario}`, () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "restart-gate-"));
  try {
    const file = path.join(directory, "state.json");
    const store = new CollaborationStore(file);
    const task = store.submitTask(request);
    store.updateTask(task.taskId, "test.prepare", (current, state) => {
      current.state = "awaiting-restart";
      current.integrationGeneration = 36;
      current.unifiedTest = { status: scenario === "failed-test" ? "failed" : "passed" };
      state.integrationBatches.push({ generation: 36, state: scenario === "verified" ? "verified" : "failed", taskIds: [current.taskId], integrationSha: "candidate-sha", failureReason: scenario === "ordinary-failure" ? "真实测试失败" : "应用重建中断集成，等待用户恢复", createdAt: new Date().toISOString() });
    });
    const restored = new CollaborationStore(file);
    if (scenario === "verified") assert.equal(restored.state().integrationBatches[0].state, "verified", "启动不得把已测试版本误标失败");
    const confirmedBatches = [];
    const pipeline = new VersionIntegrationPipeline({
      store: restored, durations, actorMemberId: "linghu-ancestor", releaseVersion: "0.1.1",
      releaseBatches: { confirmDeveloperRestart: (batchId) => confirmedBatches.push(batchId), retireRuntimeActivationPackage: () => undefined },
      workspaces: { retireWorkspace: async () => undefined },
      loadedRuntimeSha: scenario === "different-version" ? "other-sha" : "candidate-sha",
    });
    const expected = ["verified", "misclassified"].includes(scenario);
    assert.deepEqual(pipeline.confirmPublishedRestart(), expected ? [36] : []);
    assert.deepEqual(confirmedBatches, expected ? ["release-0.1.1-g36"] : []);
    assert.equal(restored.task(task.taskId).state, expected ? "integrated" : "awaiting-restart");
    assert.deepEqual(pipeline.confirmPublishedRestart(), [], "重复健康通知不得重复验收交接");
    pipeline.dispose();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
