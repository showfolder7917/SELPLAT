import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { controlledTestRoot } from "#test-paths";
import { findDesktopAncestor, findSinglePreparingBatch, watchRuntimeActivationFailure } from "../../scripts/runtime-activation-recovery-watchdog.mjs";

test("观察器在未注入进程查询器时仍可读取默认依赖", async () => {
  const projectRoot = fixtureRoot();
  try {
    assert.deepEqual(await watchRuntimeActivationFailure({ projectRoot }), { status: "not-scheduled" });
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("候选健康检查观察者只在唯一 preparing 批次归档失败后委托恢复控制器", async () => {
  const projectRoot = fixtureRoot();
  const releaseBatchId = "release-0.1.1-g464";
  const candidateSha = "b".repeat(40);
  let archived = false;
  try {
    writePreparingBatch(projectRoot, releaseBatchId, candidateSha);
    const calls = [];
    const result = await watchRuntimeActivationFailure({
      projectRoot,
      now: (() => { let time = 0; return () => time += 250; })(),
      sleep: async () => {
        const running = path.join(projectRoot, "OPTION", "temp", "ai-desktop", "执行日志", "运行中", "执行", releaseBatchId);
        const archive = path.join(projectRoot, "log", "ai-desktop", "归档日志", "发布归档", "2026-09", releaseBatchId);
        mkdirSync(archive, { recursive: true });
        writeFileSync(path.join(archive, "发布批次文档.json"), JSON.stringify({ releaseBatchId, state: "failed", candidateSha, runtimeActivation: { state: "preparing", candidateSha }, failureReason: `ENOTDIR: not a directory, rmdir '${path.join(projectRoot, "build", "ai-desktop", "package", "activation-staging-test", "app.asar")}'` }));
        rmSync(running, { recursive: true, force: true });
        archived = true;
      },
      inspectProcess: (pid) => pid === process.ppid
        ? { parentPid: 99, command: "node verifier" }
        : { parentPid: 1, command: "/Applications/AI Desktop.app/Contents/MacOS/AI Desktop" },
      recover: (request) => calls.push(request),
      validate: (request) => {
        if (!archived) throw new Error("尚未归档失败事实");
        return request;
      },
      receipt: () => undefined,
    });
    assert.deepEqual(result, { status: "invoked", releaseBatchId, candidateSha });
    assert.deepEqual(calls, [{ projectRoot, releaseBatchId, candidateSha, replacePid: "99" }]);
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("观察者拒绝多个 preparing 批次，且祖先链必须命中桌面宿主", () => {
  const projectRoot = fixtureRoot();
  try {
    writePreparingBatch(projectRoot, "release-0.1.1-g1", "a".repeat(40));
    writePreparingBatch(projectRoot, "release-0.1.1-g2", "b".repeat(40));
    assert.equal(findSinglePreparingBatch(projectRoot), null);
    assert.equal(findDesktopAncestor(5, () => ({ parentPid: 1, command: "node" })), null);
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

function fixtureRoot() {
  const root = path.join(controlledTestRoot, `runtime-activation-watchdog-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(root, { recursive: true });
  writeFileSync(path.join(root, "settings.gradle"), "rootProject.name='fixture'\n");
  return root;
}

function writePreparingBatch(projectRoot, releaseBatchId, candidateSha) {
  const root = path.join(projectRoot, "OPTION", "temp", "ai-desktop", "执行日志", "运行中", "执行", releaseBatchId);
  mkdirSync(root, { recursive: true });
  writeFileSync(path.join(root, "发布批次文档.json"), JSON.stringify({ releaseBatchId, state: "activating", candidateSha, runtimeActivation: { state: "preparing", candidateSha } }));
}
