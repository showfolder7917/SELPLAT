/**
 * 从显式生产白名单生成客户安装包可读取的规则 bundle。
 *
 * 输入：ruleengine/manifest/production-rules.json 和其中登记的正式规则正文。
 * 输出：build/ai-desktop/rule-bundle 下的 manifest.json 与 rules.json。
 * 副作用：只重建该应用的规则构建目录，不修改规则源、客户覆盖或其他应用产物。
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveApplicationDataPaths, resolveApplicationNameFromSourceRoot } from "@selplat/node-common-core/path";
import { resolveSelectedWorkspaceRoot } from "./selected-workspace-root.mjs";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = resolveSelectedWorkspaceRoot(path.resolve(appRoot, "../.."));
const resourceRoot = path.join(appRoot, "ruleengine", "rules");
const sourceManifestPath = path.join(appRoot, "ruleengine", "manifest", "production-rules.json");
const applicationName = resolveApplicationNameFromSourceRoot(appRoot);
const projectPaths = resolveApplicationDataPaths({ selplatRoot: projectRoot, applicationName });
const outputRoot = path.join(projectPaths.buildRoot, "rule-bundle");
const safeResourceRoot = `${path.resolve(resourceRoot)}${path.sep}`;

/** 读取并校验生产白名单；缺失字段必须在构建期阻断，禁止安装态猜测规则。 */
function readSourceManifest() {
  const value = JSON.parse(readFileSync(sourceManifestPath, "utf8"));
  if (value?.formatVersion !== 1 || typeof value.bundleVersion !== "string" || !Array.isArray(value.rules)) {
    throw new Error(`Invalid production rule manifest: ${sourceManifestPath}`);
  }
  return value;
}

/** 从 Markdown 第一行提取用户可读标题；没有标题时回退到稳定逻辑 ID。 */
function ruleTitle(content, logicalId) {
  const heading = content.split(/\r?\n/, 1)[0]?.match(/^#\s+(.+)$/)?.[1]?.trim();
  return heading || logicalId;
}

/** 生成内容哈希，供安装态诊断内置规则和覆盖规则的真实版本。 */
function sha256(content) {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

const sourceManifest = readSourceManifest();
const logicalIds = new Set();
const rules = sourceManifest.rules.map((entry) => {
  if (!entry || typeof entry.logicalId !== "string" || !/^[A-Z][A-Z0-9_]{2,127}$/.test(entry.logicalId)) {
    throw new Error(`Invalid production rule logicalId: ${String(entry?.logicalId)}`);
  }
  if (logicalIds.has(entry.logicalId)) throw new Error(`Duplicate production rule logicalId: ${entry.logicalId}`);
  logicalIds.add(entry.logicalId);
  if (typeof entry.resourcePath !== "string" || path.isAbsolute(entry.resourcePath) || entry.resourcePath.includes("..")) {
    throw new Error(`Invalid production rule resourcePath: ${String(entry.resourcePath)}`);
  }
  const sourcePath = path.resolve(resourceRoot, entry.resourcePath);
  // 白名单路径仍需做最终根内检查，避免将机器文件或其他工程内容写入客户包。
  if (!sourcePath.startsWith(safeResourceRoot) || !existsSync(sourcePath)) {
    throw new Error(`Production rule source is unavailable or outside resources: ${entry.resourcePath}`);
  }
  const content = readFileSync(sourcePath, "utf8");
  return {
    logicalId: entry.logicalId,
    title: ruleTitle(content, entry.logicalId),
    content,
    sha256: sha256(content),
    customerOverridable: entry.customerOverridable === true,
  };
});

// build 产物可由白名单和规则源完全重建；只清理本应用已解析的精确输出根。
rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(outputRoot, { recursive: true });
const generatedAt = new Date().toISOString();
writeFileSync(path.join(outputRoot, "rules.json"), `${JSON.stringify({ formatVersion: 1, rules }, null, 2)}\n`, "utf8");
writeFileSync(path.join(outputRoot, "manifest.json"), `${JSON.stringify({
  formatVersion: 1,
  bundleVersion: sourceManifest.bundleVersion,
  generatedAt,
  ruleCount: rules.length,
  rules: rules.map(({ logicalId, sha256: contentHash, customerOverridable }) => ({ logicalId, sha256: contentHash, customerOverridable })),
  excludedCategories: sourceManifest.excludedCategories || [],
}, null, 2)}\n`, "utf8");

console.log(`Production rule bundle generated: ${rules.length} rules -> ${outputRoot}`);
