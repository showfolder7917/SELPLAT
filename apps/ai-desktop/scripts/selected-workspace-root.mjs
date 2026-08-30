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

function isDescendant(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}
