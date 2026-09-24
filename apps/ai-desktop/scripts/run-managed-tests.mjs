import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isCollaborationWorktree } from "./selected-workspace-root.mjs";

const applicationRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceProjectRoot = path.resolve(applicationRoot, "../..");
// 协作工作树无论继承何种宿主数据根，都必须让托管静态测试使用自己的临时工程。
const needsTemporaryWorkspace = isCollaborationWorktree(sourceProjectRoot);
const managedTestFiles = [
  "tests/features/collaboration/managed-task-executor-contract.test.mjs",
  "tests/applications/developer/model-settings-contract.test.mjs",
  "tests/applications/screenshot/user-input-and-screenshot-contract.test.mjs",
  "tests/release/test-document-and-mac-launcher-contract.test.mjs",
  "tests/release/developer-package-root.test.mjs",
  "tests/services/support/platform/workspace/selected-workspace-root.test.mjs",
];

const temporaryWorkspace = needsTemporaryWorkspace ? createTemporaryWorkspace() : null;
const managedTestEnvironment = temporaryWorkspace
  ? {
    ...process.env,
    SELPLAT_ROOT: temporaryWorkspace,
    AI_DESKTOP_TEST_TEMP_ROOT: path.join(temporaryWorkspace, "cache", "ai-desktop", "test-tmp"),
  }
  : process.env;
try {
  const result = spawnSync(
    process.execPath,
    ["scripts/run-with-dependencies.mjs", "node", "--test", ...managedTestFiles],
    {
      cwd: applicationRoot,
      stdio: "inherit",
      shell: false,
      env: managedTestEnvironment,
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
} finally {
  if (temporaryWorkspace) rmSync(temporaryWorkspace, { recursive: true, force: true });
}

/** 隔离工作树的静态回归不应把候选源码当运行时数据根，故只提供最小工程标识。 */
function createTemporaryWorkspace() {
  // 依赖包装器可能把 TMPDIR 指向只读的源工程缓存；macOS 协作测试使用允许写入的系统临时目录。
  const temporaryParent = process.platform === "darwin" ? "/private/tmp" : os.tmpdir();
  const workspaceRoot = mkdtempSync(path.join(temporaryParent, "ai-desktop-managed-tests-"));
  mkdirSync(path.join(workspaceRoot, ".git"), { recursive: true });
  mkdirSync(path.join(workspaceRoot, "apps", "ai-desktop"), { recursive: true });
  writeFileSync(path.join(workspaceRoot, "settings.gradle"), "rootProject.name='ai-desktop-managed-tests'\n");
  writeFileSync(path.join(workspaceRoot, "apps", "ai-desktop", "package.json"), '{"name":"ai-desktop"}\n');
  return workspaceRoot;
}
