import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

import { controlledTestRoot } from "#test-paths";

// 候选激活回归必须执行当前工作树源码，避免上一轮 build 产物掩盖发布恢复逻辑的变化。
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && specifier.endsWith(".js")) {
      const sourceUrl = new URL(`${specifier.slice(0, -3)}.ts`, context.parentURL);
      if (existsSync(sourceUrl)) return { url: sourceUrl.href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith(".ts")) {
      const source = ts.transpileModule(readFileSync(new URL(url), "utf8"), {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      }).outputText;
      return { format: "module", source, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

const { ReleaseBatchStore } = await import("../../../electron/services/support/capabilities/release/internal/release-batch.store.ts");
const { VersionIntegrationPipeline } = await import("../../../electron/services/support/capabilities/release/internal/version-integration.pipeline.ts");
const { VersionWorkspaceManager } = await import("../../../electron/services/support/capabilities/release/internal/version-workspace.manager.ts");

const git = (root, ...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

test("包外启动器仅恢复来源匹配且仍保留暂存清理失败事实的归档批次", () => {
  const directory = path.join(controlledTestRoot, `archived-runtime-activation-${process.pid}-${Date.now()}`);
  const running = path.join(directory, "running");
  const archive = path.join(directory, "archive");
  const buildRoot = path.join(directory, "build");
  const releaseBatchId = "release-0.1.1-g461";
  const candidateSha = "a".repeat(40);
  const executable = path.join(buildRoot, "package", "activation", `${releaseBatchId}-runtime`, "AI Desktop.app", "Contents", "MacOS", "AI Desktop");
  try {
    mkdirSync(path.dirname(executable), { recursive: true });
    writeFileSync(executable, "candidate executable");
    writeFileSync(path.join(buildRoot, "package", "activation", `${releaseBatchId}-runtime`, "ai-desktop-runtime-source.json"), `${JSON.stringify({ sourceSha: candidateSha })}\n`);
    const releaseBatches = new ReleaseBatchStore(running, archive, buildRoot);
    const document = releaseBatches.create(releaseBatchId, "0.1.1", 461, [], "linghu-ancestor");
    document.state = "failed";
    document.candidateSha = candidateSha;
    document.runtimeActivation = {
      state: "preparing", candidateRootPath: "/candidate", candidateBaseSha: "b".repeat(40), candidateSha,
      impactScope: { baseSha: "b".repeat(40), candidateSha, files: ["electron/main.ts"] },
      executable: null, detail: "旧宿主", updatedAt: new Date().toISOString(),
    };
    document.failureReason = `ENOTDIR: not a directory, rmdir '${path.join(buildRoot, "package", "activation-staging-old", "mac-arm64", "AI Desktop.app", "Contents", "Resources", "app.asar")}'`;
    document.completedAt = new Date().toISOString();
    releaseBatches.write(document);

    assert.equal(releaseBatches.recoverArchivedStagingCleanupFailure(releaseBatchId, `${candidateSha.slice(0, -1)}b`), null);
    document.runtimeActivation.impactScope.candidateSha = `${candidateSha.slice(0, -1)}b`;
    releaseBatches.write(document);
    assert.equal(releaseBatches.recoverArchivedStagingCleanupFailure(releaseBatchId, candidateSha), null, "影响范围快照与候选身份不匹配时不得接管");
    document.runtimeActivation.impactScope.candidateSha = candidateSha;
    releaseBatches.write(document);
    const recovered = releaseBatches.recoverArchivedStagingCleanupFailure(releaseBatchId, candidateSha);
    assert.ok(recovered);
    assert.equal(recovered.state, "activating");
    assert.equal(recovered.runtimeActivation.state, "relaunch-scheduled");
    assert.equal(recovered.runtimeActivation.executable, executable);
    assert.match(recovered.runtimeActivation.detail, /ENOTDIR/u);
    assert.equal(releaseBatches.pendingRuntimeActivation(releaseBatchId)?.candidateSha, candidateSha);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("旧宿主缺少影响范围快照时仍可接管精确的 unlink 暂存清理失败", () => {
  const directory = path.join(controlledTestRoot, `legacy-runtime-activation-${process.pid}-${Date.now()}`);
  const running = path.join(directory, "running");
  const archive = path.join(directory, "archive");
  const buildRoot = path.join(directory, "build");
  const releaseBatchId = "release-0.1.1-g468";
  const candidateSha = "c".repeat(40);
  const executable = path.join(buildRoot, "package", "activation", `${releaseBatchId}-runtime`, "AI Desktop.app", "Contents", "MacOS", "AI Desktop");
  try {
    mkdirSync(path.dirname(executable), { recursive: true });
    writeFileSync(executable, "candidate executable");
    writeFileSync(path.join(buildRoot, "package", "activation", `${releaseBatchId}-runtime`, "ai-desktop-runtime-source.json"), `${JSON.stringify({ sourceSha: candidateSha })}\n`);
    const releaseBatches = new ReleaseBatchStore(running, archive, buildRoot);
    const document = releaseBatches.create(releaseBatchId, "0.1.1", 468, [], "linghu-ancestor");
    document.state = "failed";
    document.candidateSha = candidateSha;
    document.runtimeActivation = {
      state: "preparing", candidateRootPath: "/retired-candidate", candidateBaseSha: "d".repeat(40), candidateSha,
      executable: null, detail: "旧宿主", updatedAt: new Date().toISOString(),
    };
    document.failureReason = `ENOTDIR: not a directory, unlink '${path.join(buildRoot, "package", "activation-staging-old", "mac-arm64", "AI Desktop.app", "Contents", "Resources", "app.asar", "dist", "developer", "asset.js")}'`;
    document.completedAt = new Date().toISOString();
    releaseBatches.write(document);

    const recovered = releaseBatches.recoverArchivedStagingCleanupFailure(releaseBatchId, candidateSha);
    assert.ok(recovered);
    assert.equal(recovered.runtimeActivation.state, "relaunch-scheduled");
    assert.equal(recovered.runtimeActivation.impactScope, undefined);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("恢复缺少快照时只从稳定仓库保留的候选分支读取影响范围", async () => {
  const directory = path.join(controlledTestRoot, `retained-impact-scope-${process.pid}-${Date.now()}`);
  const repository = path.join(directory, "repository");
  const managedRoot = path.join(directory, "managed");
  try {
    mkdirSync(repository, { recursive: true });
    git(repository, "init");
    git(repository, "config", "user.name", "AI Desktop Test");
    git(repository, "config", "user.email", "ai-desktop-test@example.invalid");
    writeFileSync(path.join(repository, "base.ts"), "export const base = true;\n");
    git(repository, "add", "-A");
    git(repository, "commit", "-m", "base");
    const baseSha = git(repository, "rev-parse", "HEAD");
    writeFileSync(path.join(repository, "candidate.ts"), "export const candidate = true;\n");
    writeFileSync(path.join(repository, "evidence.ts"), "export const evidence = true;\n");
    git(repository, "add", "-A");
    git(repository, "commit", "-m", "candidate");
    const candidateSha = git(repository, "rev-parse", "HEAD");
    const branchName = "release/0.1.1-rc-g468";
    git(repository, "branch", branchName, candidateSha);
    const manager = new VersionWorkspaceManager(repository, managedRoot);
    const candidate = { generation: 468, releaseBatchId: "release-0.1.1-g468", version: "0.1.1", branchName, rootPath: path.join(directory, "retired-candidate"), baseSha, candidateSha, taskIds: [] };
    assert.deepEqual(await manager.readRetainedCandidateChangedFiles(candidate), ["candidate.ts", "evidence.ts"]);
    assert.deepEqual(await manager.readRetainedCandidateFiles(candidate, ["evidence.ts"]), { "evidence.ts": "export const evidence = true;\n" });
    git(repository, "branch", "-f", branchName, baseSha);
    await assert.rejects(() => manager.readRetainedCandidateChangedFiles(candidate), /候选 SHA 不一致/u);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("预检运行器变更先激活候选包，并由候选 SHA 进程恢复同一批次", async () => {
  const directory = path.join(controlledTestRoot, `runtime-activation-${process.pid}-${Date.now()}`);
  const repository = path.join(directory, "repository");
  const running = path.join(directory, "running");
  const archive = path.join(directory, "archive");
  const services = path.join(repository, "apps/ai-desktop/electron/services");
  mkdirSync(path.join(services, "support/capabilities/release/internal"), { recursive: true });
  mkdirSync(path.join(services, "evolution/internal"), { recursive: true });
  mkdirSync(path.join(services, "workflow/internal/evolution"), { recursive: true });
  mkdirSync(path.join(services, "workflow/domain"), { recursive: true });
  try {
    const verifier = path.join(repository, "apps/ai-desktop/electron/services/support/capabilities/release/internal/integration.verifier.ts");
    const evolutionState = path.join(services, "evolution/internal/evolution-state.store.ts");
    const evolutionRuntime = path.join(services, "workflow/internal/evolution/persona-evolution.runtime.ts");
    const projection = path.join(services, "workflow/domain/current-topic-stage.projection.ts");
    writeFileSync(verifier, "export const verifier = 'base';\n");
    // 激活前仍执行当前候选预检；夹具必须提供真实预检读取的三份验收能力来源。
    writeFileSync(evolutionState, "saveAcceptancePlan acceptance.plan_frozen reopenCompletedAcceptance acceptance.reopened decideResult(proposalId plan.conditions.find((condition) => condition.conditionId === step.checkId)");
    writeFileSync(evolutionRuntime, 'if (review.mode === "mixed") { const pageCriterionIds = plan.conditions.filter((item) => item.evidenceType === "page-experience"); runResult = composeHanliResultReview(plan, review, pageRun); } completeAutomaticAcceptance');
    writeFileSync(projection, "acceptanceRoundId currentRoundId");
    git(repository, "init");
    git(repository, "config", "user.name", "AI Desktop Test");
    git(repository, "config", "user.email", "ai-desktop-test@example.invalid");
    git(repository, "add", "-A");
    git(repository, "commit", "-m", "base");
    const baseSha = git(repository, "rev-parse", "HEAD");
    writeFileSync(verifier, "export const verifier = 'candidate';\n");
    git(repository, "add", "-A");
    git(repository, "commit", "-m", "candidate verifier");
    const candidateSha = git(repository, "rev-parse", "HEAD");

    const taskId = "activation-task";
    const state = {
      mode: "collaboration",
      nextIntegrationGeneration: 1,
      members: [{ memberId: "linghu-ancestor", displayName: "令狐老祖" }],
      tasks: [{
        taskId,
        state: "ready-for-integration",
        phase: null,
        dependencyTaskIds: [],
        mergeStrategy: "INDEPENDENT",
        flowEvents: [],
        executionRecords: [],
        snapshot: { title: "候选运行器激活" },
        initiator: { memberId: "nangong-wan", displayName: "南宫婉" },
        currentHandler: { memberId: "linghu-ancestor", displayName: "令狐老祖" },
        versionWorkspace: { branchName: "codex/activation", resultSha: candidateSha, rootPath: repository },
      }],
      integrationBatches: [],
    };
    const store = {
      state: () => state,
      task: (id) => state.tasks.find((task) => task.taskId === id),
      updateTask: (id, _reason, update) => update(state.tasks.find((task) => task.taskId === id), state),
    };
    const durations = { start: () => "span", startWait: () => "wait", finish() {}, instant() {}, writeGenerationReport() {} };
    const candidate = { generation: 1, releaseBatchId: "release-0.1.1-g1", version: "0.1.1", branchName: "release/0.1.1-rc-g1", rootPath: repository, baseSha, candidateSha, taskIds: [taskId] };
    const events = [];
    let activate;
    const activated = new Promise((resolve) => { activate = resolve; });
    const workspaces = {
      transferOwnedLocalChanges: async () => null,
      createReleaseCandidate: async () => candidate,
      assertCandidateContainsTaskResults: async () => { events.push("candidate-complete"); },
      promoteIntegrationCandidate: async () => { events.push("promote"); return candidateSha; },
      mergeIntoLocalBranch: async () => { events.push("merge"); return "local-merge-sha"; },
      retireCandidate: async () => { events.push("retire"); },
      retireWorkspace: async () => {},
      readRetainedCandidateFiles: async (_candidate, relativePaths) => Object.fromEntries(relativePaths.map((relativePath) => [relativePath, {
        "apps/ai-desktop/electron/services/evolution/internal/evolution-state.store.ts": "saveAcceptancePlan acceptance.plan_frozen reopenCompletedAcceptance acceptance.reopened decideResult(proposalId plan.conditions.find((condition) => condition.conditionId === step.checkId)",
        "apps/ai-desktop/electron/services/workflow/internal/evolution/persona-evolution.runtime.ts": "if (review.mode === 'mixed') { const pageCriterionIds = plan.conditions.filter((item) => item.evidenceType === 'page-experience'); runResult = composeHanliResultReview(plan, review, pageRun); } completeAutomaticAcceptance buildHanliResultReviewContext(acceptanceTasks, topic.workspaceState, proposalSourceTasks, plan?.sourceEvidenceFiles || [])",
        "apps/ai-desktop/electron/services/workflow/domain/current-topic-stage.projection.ts": "acceptanceRoundId currentRoundId",
        "apps/ai-desktop/electron/services/personas/hanli/internal/application/hanli-application.service.ts": "version: 3 version-integration.pipeline.ts",
        "apps/ai-desktop/electron/services/support/capabilities/release/internal/version-integration.pipeline.ts": "appendQuickPreflightDecision preflight.issues_found preflight.rerun_required",
        "apps/ai-desktop/prompts/personas/hanli/result-acceptance.md": "acceptancePlan.version 为 2 或 3 sourceEvidenceFiles 清单以外文件",
      }[relativePath]])),
    };
    const releaseBatches = new ReleaseBatchStore(running, archive);
    const common = {
      store, durations, workspaces, actorMemberId: "linghu-ancestor", releaseVersion: "0.1.1", releaseBatches,
      acquireRelease: async () => { events.push("acquire"); return () => events.push("release"); },
      publishRelease: (executable, batchId, sha) => events.push(["publish", executable, batchId, sha]),
    };
    const oldRuntime = new VersionIntegrationPipeline({
      ...common,
      loadedRuntimeSha: "loaded-old-sha",
      verifyCandidate: async () => { throw new Error("旧运行器不得继续验证候选"); },
      prepareRuntimeActivation: async (preparedCandidate, batchId) => {
        assert.equal(preparedCandidate.candidateSha, candidateSha);
        assert.equal(batchId, candidate.releaseBatchId);
        events.push("prepare");
        return "/staged/AI Desktop";
      },
      activateRuntime: (executable, batchId, sha) => {
        events.push(["activate", executable, batchId, sha]);
        activate();
      },
    });
    oldRuntime.schedule();
    let activationTimeout;
    try {
      await Promise.race([
        activated,
        new Promise((_, reject) => { activationTimeout = setTimeout(() => {
        const checkpointPath = path.join(running, candidate.releaseBatchId, "发布批次文档.json");
        const checkpoint = existsSync(checkpointPath) ? readFileSync(checkpointPath, "utf8") : "<missing>";
        reject(new Error(`候选运行包激活未在 5 秒内发出：events=${JSON.stringify(events)}；checkpoint=${checkpoint}`));
        }, 5_000); }),
      ]);
    } finally { clearTimeout(activationTimeout); }
    await new Promise((resolve) => setImmediate(resolve));

    const runningDocumentPath = path.join(running, candidate.releaseBatchId, "发布批次文档.json");
    const checkpoint = JSON.parse(readFileSync(runningDocumentPath, "utf8"));
    assert.equal(checkpoint.state, "activating");
    assert.equal(checkpoint.runtimeActivation.state, "relaunch-scheduled");
    assert.equal(checkpoint.runtimeActivation.candidateSha, candidateSha);
    assert.deepEqual(checkpoint.runtimeActivation.impactScope, { baseSha, candidateSha, files: ["apps/ai-desktop/electron/services/support/capabilities/release/internal/integration.verifier.ts"] });
    assert.deepEqual(events.filter((event) => Array.isArray(event) && event[0] === "activate"), [["activate", "/staged/AI Desktop", candidate.releaseBatchId, candidateSha]]);
    assert.ok(events.indexOf("release") < events.findIndex((event) => Array.isArray(event) && event[0] === "activate"), "重启前必须释放跨进程发布锁");
    assert.equal(events.includes("retire"), false, "激活前必须保留原候选工作树");

    const candidateRuntime = new VersionIntegrationPipeline({
      ...common,
      loadedRuntimeSha: candidateSha,
      verifyCandidate: async (restoredCandidate) => {
        events.push("verify");
        assert.equal(restoredCandidate.candidateSha, candidateSha);
        assert.equal(restoredCandidate.rootPath, repository);
        return { executable: "/verified/AI Desktop", verificationEvidence: [] };
      },
      prepareRuntimeActivation: async () => { throw new Error("恢复进程不得再次准备运行包"); },
      activateRuntime: () => { throw new Error("恢复进程不得再次激活运行包"); },
    });
    rmSync(repository, { recursive: true, force: true });
    assert.equal(existsSync(repository), false, "恢复必须覆盖候选工作树已回收的真实边界");
    await candidateRuntime.resumeRuntimeActivation(candidate.releaseBatchId);

    assert.equal(state.tasks[0].state, "awaiting-restart");
    assert.equal(state.tasks[0].unifiedTest.status, "passed");
    assert.equal(state.integrationBatches[0].state, "verified");
    assert.equal(state.integrationBatches[0].integrationSha, candidateSha);
    const publishIndex = events.findIndex((event) => Array.isArray(event) && event[0] === "publish");
    assert.ok(events.lastIndexOf("release") < publishIndex, "最终发布重启前必须释放恢复进程的发布锁");
    assert.ok(events.indexOf("retire") < publishIndex, "最终发布重启前必须回收候选工作树");
    assert.equal(existsSync(runningDocumentPath), false);
    const archivedDocument = JSON.parse(readFileSync(path.join(archive, "发布归档", checkpoint.startedAt.slice(0, 7), candidate.releaseBatchId, "发布批次文档.json"), "utf8"));
    assert.equal(archivedDocument.state, "published");
    assert.equal(archivedDocument.runtimeActivation.state, "resumed");
    oldRuntime.dispose();
    candidateRuntime.dispose();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("旧宿主清理暂存包失败时仅接管来源匹配的已提升候选", async () => {
  const directory = path.join(controlledTestRoot, `runtime-activation-recovery-${process.pid}-${Date.now()}`);
  const repository = path.join(directory, "repository");
  const running = path.join(directory, "running");
  const archive = path.join(directory, "archive");
  const buildRoot = path.join(directory, "build");
  const services = path.join(repository, "apps/ai-desktop/electron/services");
  mkdirSync(path.join(services, "support/capabilities/release/internal"), { recursive: true });
  mkdirSync(path.join(services, "evolution/internal"), { recursive: true });
  mkdirSync(path.join(services, "workflow/internal/evolution"), { recursive: true });
  mkdirSync(path.join(services, "workflow/domain"), { recursive: true });
  try {
    const verifier = path.join(repository, "apps/ai-desktop/electron/services/support/capabilities/release/internal/integration.verifier.ts");
    const evolutionState = path.join(services, "evolution/internal/evolution-state.store.ts");
    const evolutionRuntime = path.join(services, "workflow/internal/evolution/persona-evolution.runtime.ts");
    const projection = path.join(services, "workflow/domain/current-topic-stage.projection.ts");
    writeFileSync(verifier, "export const verifier = 'base';\n");
    writeFileSync(evolutionState, "saveAcceptancePlan acceptance.plan_frozen reopenCompletedAcceptance acceptance.reopened decideResult(proposalId plan.conditions.find((condition) => condition.conditionId === step.checkId)");
    writeFileSync(evolutionRuntime, 'if (review.mode === "mixed") { const pageCriterionIds = plan.conditions.filter((item) => item.evidenceType === "page-experience"); runResult = composeHanliResultReview(plan, review, pageRun); } completeAutomaticAcceptance');
    writeFileSync(projection, "acceptanceRoundId currentRoundId");
    git(repository, "init");
    git(repository, "config", "user.name", "AI Desktop Test");
    git(repository, "config", "user.email", "ai-desktop-test@example.invalid");
    git(repository, "add", "-A");
    git(repository, "commit", "-m", "base");
    const baseSha = git(repository, "rev-parse", "HEAD");
    writeFileSync(verifier, "export const verifier = 'candidate';\n");
    git(repository, "add", "-A");
    git(repository, "commit", "-m", "candidate verifier");
    const candidateSha = git(repository, "rev-parse", "HEAD");
    const taskId = "cleanup-recovery-task";
    const releaseBatchId = "release-0.1.1-g1";
    const state = {
      mode: "collaboration", nextIntegrationGeneration: 1,
      members: [{ memberId: "linghu-ancestor", displayName: "令狐老祖" }],
      tasks: [{ taskId, state: "ready-for-integration", phase: null, dependencyTaskIds: [], mergeStrategy: "INDEPENDENT", flowEvents: [], executionRecords: [], snapshot: { title: "暂存清理恢复" }, initiator: { memberId: "nangong-wan", displayName: "南宫婉" }, currentHandler: { memberId: "linghu-ancestor", displayName: "令狐老祖" }, versionWorkspace: { branchName: "codex/cleanup-recovery", resultSha: candidateSha, rootPath: repository } }],
      integrationBatches: [],
    };
    const store = { state: () => state, task: (id) => state.tasks.find((task) => task.taskId === id), updateTask: (id, _reason, update) => update(state.tasks.find((task) => task.taskId === id), state) };
    const durations = { start: () => "span", startWait: () => "wait", finish() {}, instant() {}, writeGenerationReport() {} };
    const candidate = { generation: 1, releaseBatchId, version: "0.1.1", branchName: "release/0.1.1-rc-g1", rootPath: repository, baseSha, candidateSha, taskIds: [taskId] };
    const activationExecutable = path.join(buildRoot, "package", "activation", `${releaseBatchId}-runtime`, "AI Desktop.app", "Contents", "MacOS", "AI Desktop");
    mkdirSync(path.dirname(activationExecutable), { recursive: true });
    writeFileSync(activationExecutable, "candidate executable");
    writeFileSync(path.join(buildRoot, "package", "activation", `${releaseBatchId}-runtime`, "ai-desktop-runtime-source.json"), `${JSON.stringify({ sourceSha: candidateSha })}\n`);
    const events = [];
    const releaseBatches = new ReleaseBatchStore(running, archive, buildRoot);
    const otherCandidateSha = `${candidateSha.slice(0, -1)}${candidateSha.endsWith("0") ? "1" : "0"}`;
    assert.equal(releaseBatches.resolveStagedRuntimeActivationExecutable(releaseBatchId, otherCandidateSha), null);
    let activate;
    const activated = new Promise((resolve) => { activate = resolve; });
    const workspaces = { transferOwnedLocalChanges: async () => null, createReleaseCandidate: async () => { events.push("candidate"); return candidate; }, assertCandidateContainsTaskResults: async () => { events.push("candidate-complete"); }, promoteIntegrationCandidate: async () => candidateSha, mergeIntoLocalBranch: async () => "local-merge-sha", retireCandidate: async () => { events.push("retire"); }, retireWorkspace: async () => {} };
    const pipeline = new VersionIntegrationPipeline({
      store, durations, workspaces, actorMemberId: "linghu-ancestor", releaseVersion: "0.1.1", releaseBatches, loadedRuntimeSha: "loaded-old-sha",
      acquireRelease: async () => { events.push("acquire"); return () => events.push("release"); },
      verifyCandidate: async () => { throw new Error("旧运行器不得继续验证候选"); },
      prepareRuntimeActivation: async () => { throw new Error(`ENOTDIR: not a directory, unlink '${path.join(buildRoot, "package", "activation-staging-old", "mac-arm64", "AI Desktop.app", "Contents", "Resources", "app.asar", "dist", "developer", "asset.js")}'`); },
      activateRuntime: (executable, batchId, sha) => { events.push(["activate", executable, batchId, sha]); activate(); },
      publishRelease: () => { throw new Error("激活前不得发布"); },
    });
    pipeline.schedule();
    let activationTimeout;
    try {
      await Promise.race([
        activated,
        new Promise((_, reject) => { activationTimeout = setTimeout(() => {
          const checkpointPath = path.join(running, releaseBatchId, "发布批次文档.json");
          const checkpoint = existsSync(checkpointPath) ? readFileSync(checkpointPath, "utf8") : "<missing>";
          reject(new Error(`暂存清理恢复未在 5 秒内安排激活：events=${JSON.stringify(events)}；checkpoint=${checkpoint}`));
        }, 5_000); }),
      ]);
    } finally { clearTimeout(activationTimeout); }
    const checkpoint = JSON.parse(readFileSync(path.join(running, releaseBatchId, "发布批次文档.json"), "utf8"));
    assert.equal(checkpoint.runtimeActivation.state, "relaunch-scheduled");
    assert.equal(checkpoint.runtimeActivation.executable, activationExecutable);
    assert.match(checkpoint.runtimeActivation.detail, /ENOTDIR/u);
    assert.deepEqual(events.filter((event) => Array.isArray(event) && event[0] === "activate"), [["activate", activationExecutable, releaseBatchId, candidateSha]]);
    assert.equal(events.includes("retire"), false);
    pipeline.dispose();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
