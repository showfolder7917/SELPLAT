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

const git = (root, ...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

test("预检运行器变更先激活候选包，并由候选 SHA 进程恢复同一批次", async () => {
  const directory = path.join(controlledTestRoot, `runtime-activation-${process.pid}-${Date.now()}`);
  const repository = path.join(directory, "repository");
  const running = path.join(directory, "running");
  const archive = path.join(directory, "archive");
  mkdirSync(path.join(repository, "apps/ai-desktop/electron/services/support/capabilities/release/internal"), { recursive: true });
  try {
    const verifier = path.join(repository, "apps/ai-desktop/electron/services/support/capabilities/release/internal/integration.verifier.ts");
    writeFileSync(verifier, "export const verifier = 'base';\n");
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
      promoteIntegrationCandidate: async () => { events.push("promote"); return candidateSha; },
      mergeIntoLocalBranch: async () => { events.push("merge"); return "local-merge-sha"; },
      retireCandidate: async () => { events.push("retire"); },
      retireWorkspace: async () => {},
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
    await activated;
    await new Promise((resolve) => setImmediate(resolve));

    const runningDocumentPath = path.join(running, candidate.releaseBatchId, "发布批次文档.json");
    const checkpoint = JSON.parse(readFileSync(runningDocumentPath, "utf8"));
    assert.equal(checkpoint.state, "activating");
    assert.equal(checkpoint.runtimeActivation.state, "relaunch-scheduled");
    assert.equal(checkpoint.runtimeActivation.candidateSha, candidateSha);
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
