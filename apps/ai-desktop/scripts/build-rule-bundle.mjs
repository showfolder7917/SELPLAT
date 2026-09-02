/** 构建 AI Desktop 可写规则工作区的只读初始快照：统一入口、根索引和当前用户规则树。 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveApplicationDataPaths, resolveApplicationNameFromSourceRoot } from "@selplat/node-common-core/path";
import { resolveSelectedWorkspaceRoot } from "./selected-workspace-root.mjs";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceProjectRoot = path.resolve(appRoot, "../..");
const projectRoot = resolveRuleBundleWorkspaceRoot(sourceProjectRoot);
const ruleEngineRoot = path.join(appRoot, "ruleengine");
const resourceRoot = path.join(ruleEngineRoot, "rules");
const agentsSourcePath = path.join(ruleEngineRoot, "AGENTS.md");
const applicationName = resolveApplicationNameFromSourceRoot(appRoot);
const projectPaths = resolveApplicationDataPaths({ selplatRoot: projectRoot, applicationName });
const outputRoot = path.join(projectPaths.buildRoot, "rule-bundle");
const activeUserMatch = readFileSync(agentsSourcePath, "utf8").match(/^- 当前稳定用户 ID：`([^`]+)`\s*$/m);
if (!activeUserMatch || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(activeUserMatch[1].trim())) throw new Error("ruleengine/AGENTS.md 缺少安全的当前稳定用户 ID");
const activeUserId = activeUserMatch[1].trim();
const activeUserSource = path.join(resourceRoot, "local", activeUserId);
if (!existsSync(path.join(resourceRoot, "RULE_INDEX.md")) || !existsSync(path.join(activeUserSource, "RULE_INDEX.md"))) throw new Error("当前用户完整规则索引树不存在");

function resolveRuleBundleWorkspaceRoot(candidateRoot) {
  if (String(process.env.SELPLAT_ROOT || "").trim()) return resolveSelectedWorkspaceRoot(candidateRoot);
  const result = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: candidateRoot, encoding: "utf8", shell: false });
  if (result.error || result.status !== 0) return resolveSelectedWorkspaceRoot(candidateRoot);
  const workspaceRoot = path.dirname(String(result.stdout || "").trim());
  if (!existsSync(path.join(workspaceRoot, "settings.gradle")) || !existsSync(path.join(workspaceRoot, "apps", "ai-desktop", "package.json"))) return resolveSelectedWorkspaceRoot(candidateRoot);
  return workspaceRoot;
}
function excluded(relative) { return relative.split("/").some((segment) => ["会话", "history", "template"].includes(segment)); }
function filesUnder(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const candidate = path.join(root, entry.name);
    if (entry.isDirectory()) return filesUnder(candidate);
    return entry.isFile() ? [candidate] : [];
  }).sort();
}
function sha256(value) { return createHash("sha256").update(value).digest("hex"); }

rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(path.join(outputRoot, "rules"), { recursive: true });
cpSync(agentsSourcePath, path.join(outputRoot, "AGENTS.md"));
cpSync(path.join(resourceRoot, "RULE_INDEX.md"), path.join(outputRoot, "rules", "RULE_INDEX.md"));
cpSync(activeUserSource, path.join(outputRoot, "rules", "local", activeUserId), {
  recursive: true,
  filter(source) {
    const relative = path.relative(activeUserSource, source).replaceAll(path.sep, "/");
    return !excluded(relative) && (source === activeUserSource || statSync(source).isDirectory() || source.endsWith(".md"));
  },
});
const packagedFiles = filesUnder(outputRoot).filter((file) => path.basename(file) !== "manifest.json").map((file) => ({
  path: path.relative(outputRoot, file).replaceAll(path.sep, "/"),
  size: statSync(file).size,
  sha256: sha256(readFileSync(file)),
}));
writeFileSync(path.join(outputRoot, "manifest.json"), `${JSON.stringify({
  formatVersion: 2,
  activeUserId,
  generatedAt: new Date().toISOString(),
  files: packagedFiles,
  excludedCategories: ["core", "common", "other-users", "sessions", "history", "templates"],
}, null, 2)}\n`, "utf8");
console.log(`Active-user rule bundle generated: ${packagedFiles.length} files -> ${outputRoot}`);
