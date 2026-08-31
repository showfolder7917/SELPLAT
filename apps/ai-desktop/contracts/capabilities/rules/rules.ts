/**
 * 生产规则包协议，向 Renderer 展示安装包内置规则、客户覆盖和最终生效来源。
 *
 * 生产者：主进程 RuleBundleFacade。
 * 消费者：preload 白名单、Renderer 规则管理界面和 Codex 会话装配。
 * 数据方向：main -> preload -> renderer；客户覆盖文件只由主进程读取。
 * 本文件不解析规则源码、不写覆盖文件，也不暴露规则源工程绝对路径。
 */

/** 一条规则在当前进程中的真实来源。 */
export type RuntimeRuleSource = "builtin" | "customer-overlay";

/** 可跨进程展示的有效规则摘要，正文已经过主进程校验。 */
export interface RuntimeRule {
  /** 规则索引登记的稳定逻辑 ID。 */
  logicalId: string;
  /** 面向用户显示的规则标题。 */
  title: string;
  /** 已验证 Markdown 正文，不包含源工程路径。 */
  content: string;
  /** 当前真正生效的是内置规则还是客户覆盖。 */
  source: RuntimeRuleSource;
  /** 脱敏后的来源名称。 */
  sourceName: string;
  /** 用于诊断内容版本的 SHA-256，不替代安全签名。 */
  sha256: string;
  /** 是否允许客户层按同一逻辑 ID 覆盖。 */
  customerOverridable: boolean;
}

/** 规则包健康状态；无可用内置包时应用仍可启动，但必须明确报告。 */
export interface RuleBundleStatus {
  state: "ready" | "degraded" | "unavailable";
  bundleVersion: string | null;
  generatedAt: string | null;
  builtinRuleCount: number;
  overlayRuleCount: number;
  rejectedOverlayCount: number;
  message: string | null;
}

/** 某个逻辑 ID 的最终规则和来源链；未命中时 rule 为 null。 */
export interface ResolvedRuntimeRule {
  logicalId: string;
  rule: RuntimeRule | null;
  appliedSources: RuntimeRuleSource[];
}
