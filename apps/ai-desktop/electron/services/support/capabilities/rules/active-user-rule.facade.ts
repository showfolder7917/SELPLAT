/** 仅从当前用户索引树加载规则；core、common 和其他用户永远不能进入结果。 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import type { ResolvedRuntimeRuleOutDto, RuleBundleStatusOutDto, RuntimeRuleOutDto } from "../../../../../contracts/services/support/capabilities/rules/index.js";
import type { RuleWorkspaceDescriptor } from "./rule-workspace.facade.js";

const USER_PATTERN = /^- 当前稳定用户 ID：`([^`]*)`\s*$/m;
const SAFE_USER = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const LOGICAL_ID = /^[A-Z][A-Z0-9_]{1,127}$/;
const ROLE_RULES = {
  hanli: "AI_DESKTOP_HANLI_USER_QUESTIONING_RULES",
  nangong: "AI_DESKTOP_NANGONG_ANALYSIS_PLANNING_RULES",
  executor: "AI_DESKTOP_EXECUTOR_SOURCE_IMPLEMENTATION_RULES",
  linghu: "AI_DESKTOP_LINGHU_FAILURE_TEST_RULES",
} as const;
// 所有人物共用同一份协作与传达规则，避免四份人物规则分别漂移。
const SHARED_ROLE_RULES = ["AI_DESKTOP_COLLABORATION_AUTOMATION_RULES"] as const;

export type AiDesktopRuleRole = keyof typeof ROLE_RULES;
export interface TaskRuleSnapshot {
  activeUserId: string;
  role: AiDesktopRuleRole;
  ruleRevision: string;
  mandatoryRoleRuleIds: string[];
  matchedTaskRuleIds: string[];
  dependencyRuleIds: string[];
  loadedRuleHashes: Record<string, string>;
  loadedRuleContents: Record<string, string>;
  agentsContent: string;
  indexCatalog: string;
  ruleReceipt: string[];
}

interface IndexedRule extends RuntimeRuleOutDto { resourcePath: string; }

export class ActiveUserRuleFacade {
  readonly #workspace: RuleWorkspaceDescriptor;
  readonly #onRevisionActivated: ((revision: { activeUserId: string; ruleRevision: string }) => void) | null;
  #authenticatedStableUserId: string | null = null;
  #rules = new Map<string, IndexedRule>();
  #indexCatalog = "";
  #revision = "";
  #sourceVersion = "";
  #activeUserId = "";
  #diagnostic: string | null = null;

  constructor(workspace: RuleWorkspaceDescriptor, onRevisionActivated: ((revision: { activeUserId: string; ruleRevision: string }) => void) | null = null) {
    this.#workspace = workspace;
    this.#onRevisionActivated = onRevisionActivated;
    this.#reload();
  }

  /** AGENTS 未声明用户时由认证适配器登记安全稳定 ID；显示名称不能直接进入路径。 */
  setAuthenticatedStableUserId(stableUserId: string | null): void {
    if (stableUserId && !SAFE_USER.test(stableUserId)) throw new Error("登录账号稳定用户 ID 格式无效。");
    if (stableUserId === this.#authenticatedStableUserId) return;
    this.#authenticatedStableUserId = stableUserId;
    this.#sourceVersion = "";
    this.#reload();
  }

  status(): RuleBundleStatusOutDto {
    this.#refreshIfChanged();
    return {
      state: this.#diagnostic ? "unavailable" : "ready",
      bundleVersion: this.#revision || null,
      generatedAt: this.#sourceVersion || null,
      builtinRuleCount: this.#rules.size,
      overlayRuleCount: 0,
      rejectedOverlayCount: this.#diagnostic ? 1 : 0,
      message: this.#diagnostic,
    };
  }

  /** 返回当前已经通过 AGENTS 或登录账号解析的稳定用户 ID；调用方不得从目录名称猜测。 */
  activeUserId(): string {
    this.#refreshIfChanged();
    if (this.#diagnostic || !this.#activeUserId) throw new Error(this.#diagnostic || "当前稳定用户尚未解析。");
    return this.#activeUserId;
  }

  listEffectiveRules(): RuntimeRuleOutDto[] {
    this.#refreshIfChanged();
    return [...this.#rules.values()].sort((a, b) => a.logicalId.localeCompare(b.logicalId)).map(({ resourcePath: _path, ...rule }) => ({ ...rule }));
  }

  resolve(logicalId: string): ResolvedRuntimeRuleOutDto {
    this.#refreshIfChanged();
    if (!LOGICAL_ID.test(logicalId)) throw new Error("规则逻辑 ID 格式无效。");
    const rule = this.#rules.get(logicalId);
    return { logicalId, rule: rule ? stripPath(rule) : null, appliedSources: rule ? [this.#workspace.mode === "source" ? "active-user-source" : "active-user-local"] : [] };
  }

  /** 兼容主会话；默认按执行者职责加载，不再拼接全部规则正文。 */
  renderDeveloperInstructions(): string { return this.renderRoleInstructions("executor"); }

  /** 返回 AGENTS、共通协作规则、人物规则和用户索引目录；专项规则由任务按逻辑 ID追加。 */
  renderRoleInstructions(role: AiDesktopRuleRole, taskRuleIds: string[] = []): string {
    const snapshot = this.createTaskRuleSnapshot(role, taskRuleIds);
    return this.renderTaskRuleSnapshot(snapshot);
  }

  /** 使用任务提交时冻结的规则正文，避免热更新改变正在执行任务的约束。 */
  renderTaskRuleSnapshot(snapshot: TaskRuleSnapshot): string {
    const contents = [...snapshot.mandatoryRoleRuleIds, ...snapshot.matchedTaskRuleIds]
      .map((id) => snapshot.loadedRuleContents[id]).filter((value): value is string => Boolean(value));
    return [
      snapshot.agentsContent,
      `\n# AI Desktop 当前规则上下文\nactive_user_id = ${snapshot.activeUserId}\nrule_revision = ${snapshot.ruleRevision}\nrule_role = ${snapshot.role}`,
      "\n# 当前用户规则索引目录\n以下目录只提供逻辑 ID 与路径导航；按当前任务读取需要的规则，禁止读取 core、common 或其他用户。",
      snapshot.indexCatalog,
      ...contents,
      `\n# 规则加载回执\n${snapshot.ruleReceipt.join("\n")}`,
    ].join("\n\n");
  }

  createTaskRuleSnapshot(role: AiDesktopRuleRole, taskRuleIds: string[] = []): TaskRuleSnapshot {
    this.#refreshIfChanged();
    if (this.#diagnostic) throw new Error(this.#diagnostic);
    // 人物专属职责和所有人物共通职责共同构成每次会话的强制规则。
    const mandatoryRoleRuleIds = [...SHARED_ROLE_RULES, ROLE_RULES[role]];
    // 专项规则去重，并排除已经强制加载的共通或人物规则。
    const matchedTaskRuleIds = [...new Set(taskRuleIds)].filter((id) => !mandatoryRoleRuleIds.includes(id as typeof mandatoryRoleRuleIds[number]));
    // 当前任务专项规则只在强制规则之后追加，不覆盖共通传达要求。
    const selected = [...mandatoryRoleRuleIds, ...matchedTaskRuleIds];
    for (const id of selected) if (!this.#rules.has(id)) throw new Error(`当前用户规则未登记：${id}`);
    const hashes = Object.fromEntries(selected.map((id) => [id, this.#rules.get(id)!.sha256]));
    const contents = Object.fromEntries(selected.map((id) => [id, this.#rules.get(id)!.content]));
    return {
      activeUserId: this.#activeUserId,
      role,
      ruleRevision: this.#revision,
      mandatoryRoleRuleIds,
      matchedTaskRuleIds,
      dependencyRuleIds: [],
      loadedRuleHashes: hashes,
      loadedRuleContents: contents,
      agentsContent: readFileSync(this.#workspace.agentsPath, "utf8").trim(),
      indexCatalog: this.#indexCatalog,
      ruleReceipt: selected.map((id) => `${id} | [${this.#activeUserId}] ${this.#rules.get(id)!.resourcePath} | sha256=${this.#rules.get(id)!.sha256}`),
    };
  }

  #refreshIfChanged(): void {
    const sourceVersion = treeVersion(this.#workspace.agentsPath, this.#workspace.ruleRoot, this.#activeUserId || this.#readActiveUserId());
    if (sourceVersion !== this.#sourceVersion) this.#reload();
  }

  #readActiveUserId(): string {
    const agents = readFileSync(this.#workspace.agentsPath, "utf8");
    const match = USER_PATTERN.exec(agents);
    const declared = match?.[1]?.trim() || "";
    const activeUser = declared || this.#authenticatedStableUserId || "";
    if (!SAFE_USER.test(activeUser)) throw new Error("AGENTS 未声明安全用户，且当前登录账号没有稳定用户映射。");
    return activeUser;
  }

  #reload(): void {
    try {
      const activeUser = this.#readActiveUserId();
      const userPrefix = `local/${activeUser}/`;
      const rootAssignments = new Map(assignments(readFileSync(path.join(this.#workspace.ruleRoot, "RULE_INDEX.md"), "utf8")));
      const userPattern = rootAssignments.get("USER_RULE_INDEX_PATTERN");
      if (!userPattern || !userPattern.includes("<stable-user-id>")) throw new Error("根索引未登记 USER_RULE_INDEX_PATTERN。");
      const rootIndex = userPattern.replaceAll("<stable-user-id>", activeUser);
      if (rootIndex !== `${userPrefix}RULE_INDEX.md`) throw new Error(`当前用户索引模式越界：${rootIndex}`);
      const rules = new Map<string, IndexedRule>();
      const catalogs: string[] = [];
      const visited = new Set<string>();
      const walk = (relativeIndex: string): void => {
        if (!relativeIndex.startsWith(userPrefix) || !relativeIndex.endsWith("/RULE_INDEX.md")) throw new Error(`用户索引越界：${relativeIndex}`);
        if (visited.has(relativeIndex)) return;
        visited.add(relativeIndex);
        const content = readSafe(this.#workspace.ruleRoot, relativeIndex);
        catalogs.push(`## ${relativeIndex}\n${content}`);
        for (const [logicalId, resourcePath] of assignments(content)) {
          if (!LOGICAL_ID.test(logicalId) || !resourcePath.startsWith(userPrefix)) continue;
          if (resourcePath.endsWith("/RULE_INDEX.md")) { walk(resourcePath); continue; }
          if (!resourcePath.endsWith(".md")) continue;
          if (rules.has(logicalId)) throw new Error(`当前用户规则逻辑 ID 重复：${logicalId}`);
          const ruleContent = readSafe(this.#workspace.ruleRoot, resourcePath);
          rules.set(logicalId, {
            logicalId,
            title: ruleContent.split(/\r?\n/, 1)[0]?.replace(/^#\s+/, "") || logicalId,
            content: ruleContent,
            source: this.#workspace.mode === "source" ? "active-user-source" : "active-user-local",
            sourceName: this.#workspace.mode === "source" ? "active-user-source" : "active-user-local-workspace",
            sha256: sha256(ruleContent),
            customerOverridable: true,
            resourcePath,
          });
        }
      };
      walk(rootIndex);
      const revision = sha256([...rules.values()].sort((a, b) => a.logicalId.localeCompare(b.logicalId)).map((rule) => `${rule.logicalId}:${rule.sha256}`).join("\n"));
      this.#activeUserId = activeUser;
      this.#rules = rules;
      this.#indexCatalog = catalogs.join("\n\n");
      this.#revision = revision;
      this.#sourceVersion = treeVersion(this.#workspace.agentsPath, this.#workspace.ruleRoot, activeUser);
      this.#diagnostic = null;
      try { this.#onRevisionActivated?.({ activeUserId: activeUser, ruleRevision: revision }); } catch { /* 归档失败不能使已验证规则失效。 */ }
    } catch (error) {
      this.#rules.clear();
      this.#diagnostic = error instanceof Error ? error.message : String(error);
    }
  }
}

function assignments(content: string): Array<[string, string]> {
  return content.split(/\r?\n/).flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("<!--") || !trimmed.includes("=")) return [];
    const separator = trimmed.indexOf("=");
    return [[trimmed.slice(0, separator).trim(), trimmed.slice(separator + 1).trim()] as [string, string]];
  });
}

function readSafe(root: string, relativePath: string): string {
  if (path.isAbsolute(relativePath) || relativePath.includes("\\") || relativePath.split("/").some((part) => !part || part === "." || part === "..")) throw new Error(`规则路径无效：${relativePath}`);
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  if (!resolved.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error(`规则路径逃逸：${relativePath}`);
  return readFileSync(resolved, "utf8");
}

function treeVersion(agentsPath: string, ruleRoot: string, activeUser: string): string {
  const userRoot = path.join(ruleRoot, "local", activeUser);
  const files = [agentsPath, path.join(ruleRoot, "RULE_INDEX.md"), ...walkMarkdownFiles(userRoot)];
  return files.map((file) => { const stat = statSync(file); return `${file}:${stat.mtimeMs}:${stat.size}`; }).join("|");
}

function walkMarkdownFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const candidate = path.join(root, entry.name);
    if (entry.isDirectory()) return walkMarkdownFiles(candidate);
    return entry.isFile() && entry.name.endsWith(".md") ? [candidate] : [];
  }).sort();
}

function sha256(content: string): string { return createHash("sha256").update(content, "utf8").digest("hex"); }
function stripPath(rule: IndexedRule): RuntimeRuleOutDto { const { resourcePath: _path, ...result } = rule; return { ...result }; }
