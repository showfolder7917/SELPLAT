/**
 * 应用提示词库只读取构建期校验过的 bundle，并按稳定逻辑 ID 渲染正文。
 *
 * 业务服务不得自行读取 Markdown 或猜测资源路径；权限、状态机和返回校验也不由本服务决定。
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

const MAX_BUNDLE_BYTES = 16 * 1024 * 1024;
const PROMPT_ID_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+$/;

export type PromptVariables = Readonly<Record<string, string | number | boolean>>;

/** 管理页面和运行诊断可读取的提示词身份，不包含正文和文件系统路径。 */
export interface PromptDescriptor {
  id: string;
  name: string;
  description: string;
  owner: string;
  workflow: string;
  stage: string;
  stageName: string;
  trigger: string;
  version: number;
  editable: boolean;
  variables: string[];
  includes: string[];
  sha256: string;
}

/** 人物和执行服务依赖的最小提示词能力。 */
export interface PromptLibraryPort {
  render(promptId: string, variables?: PromptVariables): string;
  list(): PromptDescriptor[];
}

interface PromptRecord extends PromptDescriptor {
  file: string;
  content: string;
}

interface PromptBundleDocument {
  formatVersion: number;
  prompts: PromptRecord[];
}

interface PromptManifestDocument {
  formatVersion: number;
  bundleVersion: string;
  generatedAt: string;
  promptCount: number;
  prompts: Array<Omit<PromptRecord, "content">>;
}

/**
 * 加载一份不可变提示词快照。
 *
 * 真实传参示例：`new PromptLibraryFacade(buildRoot/prompt-bundle)`。
 * 真实返回示例：`render("nangong.conversation", { recentConversation: "...", userMessage: "..." })` 返回最终 Prompt。
 * 异常或副作用示例：bundle 缺失、哈希不一致、include 循环或变量不匹配时构造或渲染会抛错；不会写入磁盘。
 */
export class PromptLibraryFacade implements PromptLibraryPort {
  readonly #prompts = new Map<string, PromptRecord>();

  constructor(bundleRoot: string) {
    const resolvedRoot = path.resolve(bundleRoot);
    const manifest = readJsonFile<PromptManifestDocument>(path.join(resolvedRoot, "manifest.json"));
    const bundle = readJsonFile<PromptBundleDocument>(path.join(resolvedRoot, "prompts.json"));
    this.#load(manifest, bundle);
  }

  /** 返回按流程、阶段和 ID 排序的元数据副本，调用方无法修改已加载快照。 */
  list(): PromptDescriptor[] {
    return [...this.#prompts.values()]
      .sort((left, right) => `${left.workflow}:${left.stage}:${left.id}`.localeCompare(`${right.workflow}:${right.stage}:${right.id}`))
      .map(({ file: _file, content: _content, ...descriptor }) => structuredClone(descriptor));
  }

  /** 按逻辑 ID组合 include 并替换全部声明变量；未知 ID、缺失变量和多余变量均明确阻断。 */
  render(promptId: string, variables: PromptVariables = {}): string {
    if (!PROMPT_ID_PATTERN.test(promptId)) throw new Error(`提示词 ID 格式无效：${promptId}`);
    const prompt = this.#prompts.get(promptId);
    if (!prompt) throw new Error(`提示词不存在：${promptId}`);
    const chain = this.#resolveChain(prompt, []);
    const expectedVariables = new Set(chain.flatMap((entry) => entry.variables));
    const suppliedVariables = Object.keys(variables);
    const missing = [...expectedVariables].filter((name) => !Object.prototype.hasOwnProperty.call(variables, name));
    const unknown = suppliedVariables.filter((name) => !expectedVariables.has(name));
    if (missing.length || unknown.length) {
      throw new Error(`提示词 ${promptId} 变量不匹配：缺少 ${missing.join(",") || "无"}；未知 ${unknown.join(",") || "无"}`);
    }
    return chain.map((entry) => renderTemplate(entry, variables)).join("\n\n");
  }

  #load(manifest: PromptManifestDocument, bundle: PromptBundleDocument): void {
    if (manifest.formatVersion !== 1 || bundle.formatVersion !== 1 || typeof manifest.bundleVersion !== "string"
      || typeof manifest.generatedAt !== "string" || !Array.isArray(manifest.prompts) || !Array.isArray(bundle.prompts)
      || manifest.promptCount !== bundle.prompts.length || manifest.prompts.length !== bundle.prompts.length) {
      throw new Error("提示词 bundle 清单格式或数量无效。");
    }
    const manifestById = new Map(manifest.prompts.map((entry) => [entry.id, entry]));
    for (const prompt of bundle.prompts) {
      validatePromptRecord(prompt);
      if (this.#prompts.has(prompt.id)) throw new Error(`提示词 ID 重复：${prompt.id}`);
      const manifestPrompt = manifestById.get(prompt.id);
      const { content: _content, ...promptMetadata } = prompt;
      if (!manifestPrompt || JSON.stringify(manifestPrompt) !== JSON.stringify(promptMetadata)
        || manifestPrompt.sha256 !== prompt.sha256 || sha256(prompt.content) !== prompt.sha256) {
        throw new Error(`提示词摘要校验失败：${prompt.id}`);
      }
      this.#prompts.set(prompt.id, structuredClone(prompt));
    }
    if (manifestById.size !== this.#prompts.size) throw new Error("提示词 bundle 清单存在未匹配条目。");
    for (const prompt of this.#prompts.values()) this.#resolveChain(prompt, []);
  }

  #resolveChain(prompt: PromptRecord, chain: string[]): PromptRecord[] {
    if (chain.includes(prompt.id)) throw new Error(`提示词 include 循环：${[...chain, prompt.id].join(" -> ")}`);
    const nextChain = [...chain, prompt.id];
    const included = prompt.includes.flatMap((includedId) => {
      const includedPrompt = this.#prompts.get(includedId);
      if (!includedPrompt) throw new Error(`提示词 ${prompt.id} 引用了未知提示词：${includedId}`);
      return this.#resolveChain(includedPrompt, nextChain);
    });
    return [...included, prompt];
  }
}

function readJsonFile<T>(filePath: string): T {
  const content = readFileSync(filePath);
  if (content.byteLength > MAX_BUNDLE_BYTES) throw new Error(`提示词 bundle 文件过大：${path.basename(filePath)}`);
  return JSON.parse(content.toString("utf8")) as T;
}

function validatePromptRecord(prompt: PromptRecord): void {
  if (!prompt || !PROMPT_ID_PATTERN.test(prompt.id) || !prompt.name?.trim() || !prompt.description?.trim()
    || !prompt.owner?.trim() || !prompt.workflow?.trim() || !prompt.stage?.trim() || !prompt.stageName?.trim()
    || !prompt.trigger?.trim() || !Number.isInteger(prompt.version) || prompt.version < 1 || typeof prompt.editable !== "boolean"
    || !Array.isArray(prompt.variables) || prompt.variables.some((item) => typeof item !== "string" || !item.trim())
    || new Set(prompt.variables).size !== prompt.variables.length
    || !Array.isArray(prompt.includes) || prompt.includes.some((item) => typeof item !== "string" || !PROMPT_ID_PATTERN.test(item))
    || new Set(prompt.includes).size !== prompt.includes.length || typeof prompt.content !== "string"
    || !prompt.content.trim() || typeof prompt.sha256 !== "string") {
    throw new Error("提示词 bundle 条目字段无效。");
  }
}

function renderTemplate(prompt: PromptRecord, variables: PromptVariables): string {
  let content = prompt.content;
  for (const variable of prompt.variables) content = content.split(`{{${variable}}}`).join(String(variables[variable]));
  if (/\{\{[a-zA-Z][a-zA-Z0-9]*\}\}/.test(content)) throw new Error(`提示词 ${prompt.id} 渲染后仍有未解析变量。`);
  return content;
}

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}
