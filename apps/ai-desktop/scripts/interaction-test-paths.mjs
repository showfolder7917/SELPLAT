import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

import { resolveDependencyCache } from "./dependency-cache.mjs";
import { assertWorkspaceDataPath, resolveSelectedWorkspaceRoot } from "./selected-workspace-root.mjs";

/**
 * 交互测试在公共 Node 包尚未编译时也必须能建立隔离证据目录。
 * 工程根和应用名复用依赖缓存入口的安全解析结果，避免从 worktree 名或调用目录猜测身份。
 */
export function resolveInteractionTestPaths() {
  const { projectRoot: sourceProjectRoot, applicationName } = resolveDependencyCache();
  const projectRoot = resolveInteractionTestWorkspaceRoot(sourceProjectRoot);
  const tempRoot = assertWorkspaceDataPath(projectRoot, path.join(projectRoot, "OPTION", "temp", applicationName));
  return {
    temporaryMaterialsRoot: path.join(tempRoot, "临时材料"),
    archiveLogRoot: path.join(projectRoot, "log", applicationName, "归档日志"),
  };
}

/** 隔离 Playwright 证据只能写入经 Git 公共目录校验的稳定工程根。 */
function resolveInteractionTestWorkspaceRoot(candidateRoot) {
  if (String(process.env.SELPLAT_ROOT || "").trim()) return resolveSelectedWorkspaceRoot(candidateRoot);
  const result = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
    cwd: candidateRoot,
    encoding: "utf8",
    shell: false,
  });
  if (result.error || result.status !== 0) return resolveSelectedWorkspaceRoot(candidateRoot);
  const workspaceRoot = path.dirname(String(result.stdout || "").trim());
  if (!existsSync(path.join(workspaceRoot, "settings.gradle")) || !existsSync(path.join(workspaceRoot, "apps", "ai-desktop", "package.json"))) {
    return resolveSelectedWorkspaceRoot(candidateRoot);
  }
  return workspaceRoot;
}
