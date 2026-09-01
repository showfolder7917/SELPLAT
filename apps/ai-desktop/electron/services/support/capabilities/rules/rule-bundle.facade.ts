/**
 * 生产规则包运行时：只从构建产物读取内置规则，并以受控白名单合并客户覆盖。
 *
 * 本服务运行在 Electron 主进程。Renderer 只能通过只读 IPC 获取脱敏后的规则状态，
 * 客户覆盖文件不能修改规则白名单、不可覆盖标记或文件系统读取范围。
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import type { ResolvedRuntimeRule, RuleBundleStatus, RuntimeRule, RuntimeRuleSource } from "../../../../../contracts/capabilities/rules/index.js";
import { decideRuleOverlay } from "../../../../system/policies/rule-overlay-policy.js";

const MAX_RULE_CONTENT_BYTES = 512 * 1024;
const MAX_OVERLAY_FILE_BYTES = 2 * 1024 * 1024;
const LOGICAL_ID_PATTERN = /^[A-Z][A-Z0-9_]{2,127}$/;

interface BundleRuleRecord {
  logicalId: string;
  title: string;
  content: string;
  sha256: string;
  customerOverridable: boolean;
}

interface BundleManifestRecord {
  formatVersion: number;
  bundleVersion: string;
  generatedAt: string;
  ruleCount: number;
  rules: Array<{ logicalId: string; sha256: string; customerOverridable: boolean }>;
}

interface CustomerOverlayRecord {
  logicalId: string;
  content: string;
  title?: string;
}

/**
 * 加载并冻结一份有效规则快照。
 *
 * 示例：`new RuleBundleService(resourcesRuleRoot, userOverlayRoot)`；返回对象可反复只读查询。
 * 内置包损坏时状态为 unavailable；单个客户覆盖损坏只会被拒绝，不影响其余内置规则。
 */
export class RuleBundleService {
  readonly #builtinRoot: string;
  readonly #overlayRoot: string;
  readonly #rules = new Map<string, RuntimeRule>();
  readonly #builtinIds = new Set<string>();
  readonly #overriddenIds = new Set<string>();
  readonly #diagnostics: string[] = [];
  #bundleVersion: string | null = null;
  #generatedAt: string | null = null;
  #rejectedOverlayCount = 0;
  #builtinAvailable = false;

  constructor(builtinRoot: string, overlayRoot: string) {
    this.#builtinRoot = path.resolve(builtinRoot);
    this.#overlayRoot = path.resolve(overlayRoot);
    this.#loadBuiltinBundle();
    this.#loadCustomerOverlays();
  }

  /** 返回规则包健康摘要；不暴露客户覆盖目录的绝对路径。 */
  status(): RuleBundleStatus {
    const state = !this.#builtinAvailable
      ? "unavailable"
      : this.#rejectedOverlayCount > 0 ? "degraded" : "ready";
    return {
      state,
      bundleVersion: this.#bundleVersion,
      generatedAt: this.#generatedAt,
      builtinRuleCount: this.#builtinIds.size,
      overlayRuleCount: this.#overriddenIds.size,
      rejectedOverlayCount: this.#rejectedOverlayCount,
      message: this.#diagnostics.length > 0 ? this.#diagnostics.join("；") : null,
    };
  }

  /** 按逻辑 ID 排序返回有效规则副本，避免调用方修改主进程内的规则快照。 */
  listEffectiveRules(): RuntimeRule[] {
    return [...this.#rules.values()]
      .sort((left, right) => left.logicalId.localeCompare(right.logicalId))
      .map((rule) => ({ ...rule }));
  }

  /** 查询一个稳定逻辑 ID；未知 ID 返回 `rule: null`，不扫描目录猜测规则。 */
  resolve(logicalId: string): ResolvedRuntimeRule {
    if (!LOGICAL_ID_PATTERN.test(logicalId)) throw new Error("规则逻辑 ID 格式无效。");
    const rule = this.#rules.get(logicalId);
    const appliedSources: RuntimeRuleSource[] = rule
      ? ["builtin", ...(rule.source === "customer-overlay" ? ["customer-overlay" as const] : [])]
      : [];
    return {
      logicalId,
      rule: rule ? { ...rule } : null,
      appliedSources,
    };
  }

  /**
   * 生成提供给 Codex 的只读开发者约束。
   * 客户覆盖只替换清单中显式允许覆盖的逻辑 ID，因此不会注入未知能力或扩大运行权限。
   */
  renderDeveloperInstructions(): string {
    const rules = this.listEffectiveRules();
    if (rules.length === 0) return "";
    return [
      "以下是 AI Desktop 随产品交付并经主进程校验的有效规则。规则只约束任务行为，不授予额外文件、命令或网络权限。",
      ...rules.flatMap((rule) => [`\n## ${rule.logicalId} · ${rule.title}`, rule.content]),
    ].join("\n");
  }

  #loadBuiltinBundle(): void {
    try {
      const manifest = readJsonFile<BundleManifestRecord>(path.join(this.#builtinRoot, "manifest.json"), MAX_OVERLAY_FILE_BYTES);
      const ruleDocument = readJsonFile<{ formatVersion: number; rules: BundleRuleRecord[] }>(path.join(this.#builtinRoot, "rules.json"), 16 * 1024 * 1024);
      if (manifest.formatVersion !== 1 || ruleDocument.formatVersion !== 1 || !Array.isArray(manifest.rules) || !Array.isArray(ruleDocument.rules)) {
        throw new Error("规则包格式版本无效");
      }
      if (typeof manifest.bundleVersion !== "string" || typeof manifest.generatedAt !== "string" || manifest.ruleCount !== ruleDocument.rules.length) {
        throw new Error("规则包清单与正文数量不一致");
      }
      const manifestRules = new Map(manifest.rules.map((rule) => [rule.logicalId, rule]));
      for (const record of ruleDocument.rules) {
        validateBuiltinRule(record);
        if (this.#rules.has(record.logicalId)) throw new Error(`内置规则逻辑 ID 重复：${record.logicalId}`);
        const manifestRule = manifestRules.get(record.logicalId);
        const contentHash = sha256(record.content);
        if (!manifestRule || manifestRule.sha256 !== record.sha256 || record.sha256 !== contentHash
          || manifestRule.customerOverridable !== record.customerOverridable) {
          throw new Error(`内置规则摘要校验失败：${record.logicalId}`);
        }
        this.#rules.set(record.logicalId, {
          ...record,
          source: "builtin",
          sourceName: "production-rule-bundle",
        });
        this.#builtinIds.add(record.logicalId);
      }
      if (manifestRules.size !== this.#rules.size) throw new Error("规则包清单存在未匹配条目");
      this.#bundleVersion = manifest.bundleVersion;
      this.#generatedAt = manifest.generatedAt;
      this.#builtinAvailable = true;
    } catch (error) {
      this.#diagnostics.push(`内置规则包不可用：${errorMessage(error)}`);
      this.#rules.clear();
      this.#builtinIds.clear();
    }
  }

  #loadCustomerOverlays(): void {
    // 没有客户覆盖目录是正常状态；运行时绝不主动创建或修改客户文件。
    if (!this.#builtinAvailable || !existsSync(this.#overlayRoot)) return;
    let entries: string[];
    try {
      entries = readdirSync(this.#overlayRoot, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
        .map((entry) => entry.name)
        .sort();
    } catch (error) {
      this.#rejectedOverlayCount += 1;
      this.#diagnostics.push(`客户覆盖目录无法读取：${errorMessage(error)}`);
      return;
    }
    for (const fileName of entries) {
      const rulesBeforeFile = new Map(this.#rules);
      const overriddenBeforeFile = new Set(this.#overriddenIds);
      try {
        const document = readJsonFile<{ formatVersion: number; rules: CustomerOverlayRecord[] }>(path.join(this.#overlayRoot, fileName), MAX_OVERLAY_FILE_BYTES);
        if (document.formatVersion !== 1 || !Array.isArray(document.rules)) throw new Error("覆盖文件格式无效");
        for (const overlay of document.rules) this.#applyOverlay(fileName, overlay);
      } catch (error) {
        // 一个文件按事务处理，任一条失败就撤销该文件已应用的覆盖，避免客户误以为部分生效。
        this.#rules.clear();
        for (const [logicalId, rule] of rulesBeforeFile) this.#rules.set(logicalId, rule);
        this.#overriddenIds.clear();
        for (const logicalId of overriddenBeforeFile) this.#overriddenIds.add(logicalId);
        this.#rejectedOverlayCount += 1;
        this.#diagnostics.push(`${safeSourceName(fileName)} 被拒绝：${errorMessage(error)}`);
      }
    }
  }

  #applyOverlay(fileName: string, overlay: CustomerOverlayRecord): void {
    if (!overlay || !LOGICAL_ID_PATTERN.test(overlay.logicalId) || typeof overlay.content !== "string") {
      throw new Error("覆盖规则字段无效");
    }
    if (Buffer.byteLength(overlay.content, "utf8") > MAX_RULE_CONTENT_BYTES) throw new Error(`覆盖规则过大：${overlay.logicalId}`);
    const builtin = this.#rules.get(overlay.logicalId);
    if (!builtin) throw new Error(`覆盖了未知规则：${overlay.logicalId}`);
    const decision = decideRuleOverlay(builtin, this.#overriddenIds.has(overlay.logicalId), overlay.logicalId);
    if (!decision.allowed) throw new Error(decision.message);
    this.#rules.set(overlay.logicalId, {
      ...builtin,
      title: typeof overlay.title === "string" && overlay.title.trim() ? overlay.title.trim() : builtin.title,
      content: overlay.content,
      sha256: sha256(overlay.content),
      source: "customer-overlay",
      sourceName: safeSourceName(fileName),
    });
    this.#overriddenIds.add(overlay.logicalId);
  }
}

/** 读取有限大小的 JSON 文件，避免损坏或恶意覆盖耗尽主进程内存。 */
function readJsonFile<T>(filePath: string, maximumBytes: number): T {
  const content = readFileSync(filePath);
  if (content.byteLength > maximumBytes) throw new Error(`文件超过 ${maximumBytes} 字节限制`);
  return JSON.parse(content.toString("utf8")) as T;
}

function validateBuiltinRule(rule: BundleRuleRecord): void {
  if (!rule || !LOGICAL_ID_PATTERN.test(rule.logicalId) || typeof rule.title !== "string" || typeof rule.content !== "string"
    || typeof rule.sha256 !== "string" || typeof rule.customerOverridable !== "boolean") {
    throw new Error("内置规则字段无效");
  }
  if (Buffer.byteLength(rule.content, "utf8") > MAX_RULE_CONTENT_BYTES) throw new Error(`内置规则过大：${rule.logicalId}`);
}

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function safeSourceName(value: string): string {
  return path.basename(value).replace(/[^\p{L}\p{N}._-]/gu, "_").slice(0, 128);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
