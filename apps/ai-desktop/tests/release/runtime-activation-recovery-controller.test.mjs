import assert from "node:assert/strict";
import { chmodSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { controlledTestRoot } from "#test-paths";
import { requestRuntimeActivationRecovery, validateRequest } from "../../scripts/recover-runtime-activation.mjs";

const candidateSha = "a".repeat(40);
const releaseBatchId = "release-0.1.1-g463";

test("外部恢复控制器只把来源匹配的已提升包交给包内工具", () => {
  const projectRoot = fixtureRoot();
  try {
    const calls = [];
    const request = requestRuntimeActivationRecovery({
      projectRoot,
      releaseBatchId,
      candidateSha,
      replacePid: "81317",
      execute: (command, args, options) => calls.push({ command, args, options }),
    });
    assert.equal(request.releaseBatchId, releaseBatchId);
    assert.deepEqual(calls, [{
      command: path.join(request.activationRoot, "AI Desktop.app", "Contents", "Resources", "runtime-activation-recovery.command"),
      args: [
        `--selplat-root=${projectRoot}`,
        `--release-batch=${releaseBatchId}`,
        `--runtime-sha=${candidateSha}`,
        "--replace-pid=81317",
      ],
      options: { stdio: "inherit" },
    }]);
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("外部恢复控制器拒绝候选来源或失败事实不匹配的归档", () => {
  const projectRoot = fixtureRoot();
  try {
    const documentPath = path.join(projectRoot, "log", "ai-desktop", "归档日志", "发布归档", "2026-09", releaseBatchId, "发布批次文档.json");
    writeFileSync(documentPath, JSON.stringify({
      releaseBatchId,
      state: "failed",
      candidateSha,
      runtimeActivation: { state: "preparing", candidateSha },
      failureReason: "candidate verification failed",
    }));
    assert.throws(() => validateRequest({ projectRoot, releaseBatchId, candidateSha, replacePid: "81317" }), /暂存清理失败事实/u);
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("外部恢复控制器接受暂存清理进入 app.asar 虚拟路径后的 unlink 失败", () => {
  const projectRoot = fixtureRoot({ operation: "unlink", nestedAsarPath: true });
  try {
    const request = validateRequest({ projectRoot, releaseBatchId, candidateSha, replacePid: "81317" });
    assert.equal(request.candidateSha, candidateSha);
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

function fixtureRoot({ operation = "rmdir", nestedAsarPath = false } = {}) {
  const root = path.join(controlledTestRoot, `runtime-activation-controller-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const archiveRoot = path.join(root, "log", "ai-desktop", "归档日志", "发布归档", "2026-09", releaseBatchId);
  const activationRoot = path.join(root, "build", "ai-desktop", "package", "activation", `${releaseBatchId}-runtime`);
  const resources = path.join(activationRoot, "AI Desktop.app", "Contents", "Resources");
  const macos = path.join(activationRoot, "AI Desktop.app", "Contents", "MacOS");
  mkdirSync(archiveRoot, { recursive: true });
  mkdirSync(resources, { recursive: true });
  mkdirSync(macos, { recursive: true });
  writeFileSync(path.join(root, "settings.gradle"), "rootProject.name='fixture'\n");
  writeFileSync(path.join(archiveRoot, "发布批次文档.json"), JSON.stringify({
    releaseBatchId,
    state: "failed",
    candidateSha,
    runtimeActivation: { state: "preparing", candidateSha },
    failureReason: `ENOTDIR: not a directory, ${operation} '${path.join(root, "build", "ai-desktop", "package", "activation-staging-fixture", "app.asar", ...(nestedAsarPath ? ["dist", "developer", "asset.js"] : []))}'`,
  }));
  writeFileSync(path.join(activationRoot, "ai-desktop-runtime-source.json"), JSON.stringify({ sourceSha: candidateSha }));
  for (const file of [path.join(resources, "runtime-activation-recovery.command"), path.join(macos, "AI Desktop")]) {
    writeFileSync(file, "#!/bin/zsh\nexit 0\n");
    chmodSync(file, 0o755);
  }
  return root;
}
