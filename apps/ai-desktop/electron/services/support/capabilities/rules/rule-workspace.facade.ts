/** 解析 AI Desktop 源码规则树，缺失时从安装快照初始化可写本地规则工作区。 */
import { cpSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

export interface RuleWorkspaceDescriptor {
  mode: "source" | "local";
  workspaceRoot: string;
  agentsPath: string;
  ruleRoot: string;
}

export interface RuleWorkspaceOptions {
  projectRoot: string;
  userDataRoot: string;
  bundledRuleRoot: string;
}

/** 规则工作区只认 UI 当前主工程；不会扫描其他挂接目录猜测源码。 */
export class RuleWorkspaceFacade {
  readonly descriptor: RuleWorkspaceDescriptor;

  constructor(options: RuleWorkspaceOptions) {
    const sourceRoot = path.join(path.resolve(options.projectRoot), "apps", "ai-desktop", "ruleengine");
    const sourceAgents = path.join(sourceRoot, "AGENTS.md");
    const sourceRules = path.join(sourceRoot, "rules");
    if (existsSync(sourceAgents) && existsSync(path.join(sourceRules, "RULE_INDEX.md"))) {
      this.descriptor = { mode: "source", workspaceRoot: sourceRoot, agentsPath: sourceAgents, ruleRoot: sourceRules };
      return;
    }
    const localRoot = path.join(path.resolve(options.userDataRoot), "rule-workspace");
    const localAgents = path.join(localRoot, "AGENTS.md");
    const localRules = path.join(localRoot, "rules");
    mkdirSync(localRoot, { recursive: true });
    if (!existsSync(localAgents)) {
      const bundledAgents = path.join(options.bundledRuleRoot, "AGENTS.md");
      if (!existsSync(bundledAgents)) throw new Error("AI Desktop 规则快照缺少 AGENTS.md。");
      cpSync(bundledAgents, localAgents, { errorOnExist: true });
    }
    if (!existsSync(path.join(localRules, "RULE_INDEX.md"))) {
      const bundledRules = path.join(options.bundledRuleRoot, "rules");
      if (!existsSync(path.join(bundledRules, "RULE_INDEX.md"))) throw new Error("AI Desktop 规则快照缺少规则索引树。");
      cpSync(bundledRules, localRules, { recursive: true, errorOnExist: false });
    }
    for (const directory of ["releases", "upload-outbox", "upload-history"]) mkdirSync(path.join(localRoot, directory), { recursive: true });
    this.descriptor = { mode: "local", workspaceRoot: localRoot, agentsPath: localAgents, ruleRoot: localRules };
  }
}
