import { existsSync } from "node:fs";
import path from "node:path";

const WORKTREE_SEGMENTS = ["collaboration", "worktrees"];

/**
 * 测试和开发工具的数据根只来自用户选择的工作区；候选工作树只提供待测源码。
 * 缺少显式工作区时，仅允许普通主工程把自身作为默认值，隔离工作树必须立即报错。
 */
export function resolveSelectedWorkspaceRoot(sourceProjectRoot) {
  const sourceRoot = path.resolve(sourceProjectRoot);
  const configured = String(process.env.SELPLAT_ROOT || "").trim();
  if (!configured && isCollaborationWorktree(sourceRoot)) {
    throw new Error("工作区中没有工程，请添加工程");
  }
  const workspaceRoot = path.resolve(configured || sourceRoot);
  if (!path.isAbsolute(workspaceRoot)
    || !existsSync(path.join(workspaceRoot, "settings.gradle"))
    || !existsSync(path.join(workspaceRoot, "apps", "ai-desktop", "package.json"))) {
    throw new Error("工作区中没有工程，请添加工程");
  }
  return workspaceRoot;
}

/**
 * 路径诊断允许读取候选工作树自身的工程标识，但不把它提升为运行数据工作区。
 * 真实构建、测试、发布和运行仍必须调用 resolveSelectedWorkspaceRoot，缺少显式选择时继续阻断。
 */
export function resolvePathDiagnosticWorkspaceRoot(sourceProjectRoot) {
  const sourceRoot = path.resolve(sourceProjectRoot);
  const configured = String(process.env.SELPLAT_ROOT || "").trim();
  if (configured || !isCollaborationWorktree(sourceRoot)) return resolveSelectedWorkspaceRoot(sourceRoot);
  if (!hasSelplatProjectMarkers(sourceRoot)) {
    throw new Error("路径诊断找不到候选工作树工程标识");
  }
  return sourceRoot;
}

/** 数据目录不得落入任何协作任务或发布候选工作树。 */
export function assertWorkspaceDataPath(workspaceRoot, candidatePath) {
  const root = path.resolve(workspaceRoot);
  const candidate = path.resolve(candidatePath);
  if (!isDescendant(root, candidate) || isCollaborationWorktree(candidate)) {
    throw new Error(`测试数据路径超出所选工作区或落入候选工作树：${candidate}`);
  }
  return candidate;
}

export function isCollaborationWorktree(candidatePath) {
  const segments = path.resolve(candidatePath).split(path.sep).filter(Boolean);
  return segments.some((segment, index) => segment === WORKTREE_SEGMENTS[0] && segments[index + 1] === WORKTREE_SEGMENTS[1]);
}

function hasSelplatProjectMarkers(workspaceRoot) {
  return existsSync(path.join(workspaceRoot, "settings.gradle"))
    && existsSync(path.join(workspaceRoot, "apps", "ai-desktop", "package.json"));
}

function isDescendant(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}
