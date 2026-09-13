import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  writePromptBundleFixture(workspaceRoot, sourceRoot);
  process.once("exit", () => rmSync(workspaceRoot, { recursive: true, force: true }));
  return workspaceRoot;
}

/**
 * 直接执行的隔离测试不运行构建；仅从当前工作树的提示词源写入校验一致的临时只读快照。
 * 这样人物服务仍经 PromptLibraryFacade 走生产 bundle 契约，也不会读取主工程的构建产物。
 */
function writePromptBundleFixture(workspaceRoot, sourceRoot) {
  const sourcePromptsRoot = path.join(sourceRoot, "apps", "ai-desktop", "prompts");
  const manifest = JSON.parse(readFileSync(path.join(sourcePromptsRoot, "manifest.json"), "utf8"));
  const prompts = manifest.prompts.map((entry) => {
    const content = readFileSync(path.join(sourcePromptsRoot, entry.file), "utf8");
    return { ...entry, content, sha256: createHash("sha256").update(content, "utf8").digest("hex") };
  });
  const bundleRoot = path.join(workspaceRoot, "build", "ai-desktop", "prompt-bundle");
  mkdirSync(bundleRoot, { recursive: true });
  const manifestPrompts = prompts.map(({ content: _content, ...entry }) => entry);
  writeFileSync(path.join(bundleRoot, "manifest.json"), JSON.stringify({
    formatVersion: manifest.formatVersion,
    bundleVersion: manifest.bundleVersion,
    generatedAt: new Date(0).toISOString(),
    promptCount: manifestPrompts.length,
    prompts: manifestPrompts,
  }), "utf8");
  writeFileSync(path.join(bundleRoot, "prompts.json"), JSON.stringify({ formatVersion: manifest.formatVersion, prompts }), "utf8");
}
