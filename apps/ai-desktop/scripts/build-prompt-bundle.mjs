/**
 * 把应用提示词源码构建成开发态和安装态共用的只读 bundle。
 *
 * 输入：apps/ai-desktop/prompts/manifest.json 与其中登记的 Markdown。
 * 输出：build/ai-desktop/prompt-bundle/manifest.json 和 prompts.json。
 * 副作用：只重建本应用已解析的 prompt-bundle 目录。
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveApplicationDataPaths, resolveApplicationNameFromSourceRoot } from "@selplat/node-common-core/path";
import { resolveSelectedWorkspaceRoot } from "./selected-workspace-root.mjs";

const applicationRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = resolveSelectedWorkspaceRoot(path.resolve(applicationRoot, "../.."));
const promptSourceRoot = path.join(applicationRoot, "prompts");
const sourceManifestPath = path.join(promptSourceRoot, "manifest.json");
const applicationName = resolveApplicationNameFromSourceRoot(applicationRoot);
const projectPaths = resolveApplicationDataPaths({ selplatRoot: projectRoot, applicationName });
const outputRoot = path.join(projectPaths.buildRoot, "prompt-bundle");
const safePromptRoot = `${path.resolve(promptSourceRoot)}${path.sep}`;
const promptIdPattern = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+$/;
const metadataTextFields = ["name", "description", "owner", "workflow", "stage", "stageName", "trigger"];

function sha256(content) {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function placeholders(content) {
  return [...new Set([...content.matchAll(/\{\{([a-zA-Z][a-zA-Z0-9]*)\}\}/g)].map((match) => match[1]))].sort();
}

function validateStringList(value, field, promptId) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`Invalid ${field} for prompt ${promptId}`);
  }
  const normalized = value.map((item) => item.trim());
  if (new Set(normalized).size !== normalized.length) throw new Error(`Duplicate ${field} for prompt ${promptId}`);
  return normalized;
}

const sourceManifest = JSON.parse(readFileSync(sourceManifestPath, "utf8"));
if (sourceManifest?.formatVersion !== 1 || typeof sourceManifest.bundleVersion !== "string" || !Array.isArray(sourceManifest.prompts)) {
  throw new Error(`Invalid prompt source manifest: ${sourceManifestPath}`);
}

const ids = new Set();
const prompts = sourceManifest.prompts.map((entry) => {
  if (!entry || typeof entry.id !== "string" || !promptIdPattern.test(entry.id)) throw new Error(`Invalid prompt id: ${String(entry?.id)}`);
  if (ids.has(entry.id)) throw new Error(`Duplicate prompt id: ${entry.id}`);
  ids.add(entry.id);
  for (const field of metadataTextFields) {
    if (typeof entry[field] !== "string" || !entry[field].trim()) throw new Error(`Prompt ${entry.id} is missing ${field}`);
  }
  if (!Number.isInteger(entry.version) || entry.version < 1 || typeof entry.editable !== "boolean") {
    throw new Error(`Prompt ${entry.id} has invalid version or editable flag`);
  }
  if (typeof entry.file !== "string" || path.isAbsolute(entry.file) || entry.file.includes("..") || !entry.file.endsWith(".md")) {
    throw new Error(`Prompt ${entry.id} has invalid source path: ${String(entry.file)}`);
  }
  const sourcePath = path.resolve(promptSourceRoot, entry.file);
  if (!sourcePath.startsWith(safePromptRoot) || !existsSync(sourcePath)) throw new Error(`Prompt source is unavailable: ${entry.file}`);
  const content = readFileSync(sourcePath, "utf8").trim();
  if (!content) throw new Error(`Prompt ${entry.id} has empty content`);
  const variables = validateStringList(entry.variables, "variables", entry.id).sort();
  const includes = validateStringList(entry.includes, "includes", entry.id);
  const discoveredVariables = placeholders(content);
  if (JSON.stringify(variables) !== JSON.stringify(discoveredVariables)) {
    throw new Error(`Prompt ${entry.id} variables do not match template: declared=${variables.join(",")} actual=${discoveredVariables.join(",")}`);
  }
  return { ...entry, variables, includes, content, sha256: sha256(content) };
});

const promptById = new Map(prompts.map((prompt) => [prompt.id, prompt]));
function validateIncludes(prompt, chain = []) {
  if (chain.includes(prompt.id)) throw new Error(`Prompt include cycle: ${[...chain, prompt.id].join(" -> ")}`);
  for (const includedId of prompt.includes) {
    const included = promptById.get(includedId);
    if (!included) throw new Error(`Prompt ${prompt.id} includes unknown prompt ${includedId}`);
    validateIncludes(included, [...chain, prompt.id]);
  }
}
for (const prompt of prompts) validateIncludes(prompt);

rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(outputRoot, { recursive: true });
const generatedAt = new Date().toISOString();
writeFileSync(path.join(outputRoot, "prompts.json"), `${JSON.stringify({ formatVersion: 1, prompts }, null, 2)}\n`, "utf8");
writeFileSync(path.join(outputRoot, "manifest.json"), `${JSON.stringify({
  formatVersion: 1,
  bundleVersion: sourceManifest.bundleVersion,
  generatedAt,
  promptCount: prompts.length,
  prompts: prompts.map(({ content: _content, ...prompt }) => prompt),
}, null, 2)}\n`, "utf8");

console.log(`Prompt bundle generated: ${prompts.length} prompts -> ${outputRoot}`);
