import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveApplicationDataPaths, resolveApplicationNameFromSourceRoot } from "@selplat/node-common-core/path";
import { assertWorkspaceDataPath, isCollaborationWorktree, resolveSelectedWorkspaceRoot } from "../../scripts/selected-workspace-root.mjs";

export const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const sourceProjectRoot = path.resolve(appRoot, "../..");
export const projectRoot = resolveTestWorkspaceRoot(sourceProjectRoot);
export const projectPaths = resolveApplicationDataPaths({ selplatRoot: projectRoot, applicationName: resolveApplicationNameFromSourceRoot(appRoot) });
export const controlledTestRoot = assertWorkspaceDataPath(projectRoot, path.join(projectPaths.temporaryMaterialsRoot, "测试证据", "正式测试"));
mkdirSync(controlledTestRoot, { recursive: true });

/**
 * 定向测试在隔离工作树中运行时，只为测试数据建立最小工程根；候选源码绝不作为运行数据根。
 * 生产命令继续调用 resolveSelectedWorkspaceRoot，缺少用户选择时仍会严格拒绝。
 */
function resolveTestWorkspaceRoot(sourceRoot) {
  if (String(process.env.SELPLAT_ROOT || "").trim() || !isCollaborationWorktree(sourceRoot)) {
    return resolveSelectedWorkspaceRoot(sourceRoot);
  }
  // 依赖加载器可把 TMPDIR 指向只读缓存；隔离测试根必须使用可写的系统临时区。
  const temporaryRoot = process.platform === "darwin" ? "/private/tmp" : os.tmpdir();
  const workspaceRoot = mkdtempSync(path.join(temporaryRoot, "ai-desktop-direct-test-"));
  mkdirSync(path.join(workspaceRoot, ".git"), { recursive: true });
  mkdirSync(path.join(workspaceRoot, "apps", "ai-desktop"), { recursive: true });
  writeFileSync(path.join(workspaceRoot, "settings.gradle"), "rootProject.name='ai-desktop-direct-test'\n");
  writeFileSync(path.join(workspaceRoot, "apps", "ai-desktop", "package.json"), '{"name":"ai-desktop"}\n');
  process.once("exit", () => rmSync(workspaceRoot, { recursive: true, force: true }));
  return workspaceRoot;
}
