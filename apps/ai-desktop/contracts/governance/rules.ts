/**
 * 生产规则包协议，向 Renderer 展示安装包内置规则、客户覆盖和最终生效来源。
 *
 * 生产者：主进程 RuleBundleService。
 * 消费者：preload 白名单、Renderer 规则管理界面和 Codex 会话装配。
 * 数据方向：main -> preload -> renderer；客户覆盖文件只由主进程读取。
 * 本文件不解析规则源码、不写覆盖文件，也不暴露规则源工程绝对路径。
 */

/** 一条规则在当前进程中的真实来源。 */
export type RuntimeRuleSource = "builtin" | "customer-overlay";

/**
 * 可跨进程展示的有效规则摘要。
 * `content` 是已验证 Markdown 正文；`sha256` 用于诊断版本，不作为签名替代品。
 */
export interface RuntimeRule {
  logicalId: string;
  title: string;
  content: string;
  source: RuntimeRuleSource;
  sourceName: string;
  sha256: string;
  customerOverridable: boolean;
}

/** 规则包健康状态；无可用内置包时应用仍可启动，但必须向用户明确报告。 */
export interface RuleBundleStatus {
  state: "ready" | "degraded" | "unavailable";
  bundleVersion: string | null;
  generatedAt: string | null;
  builtinRuleCount: number;
  overlayRuleCount: number;
  rejectedOverlayCount: number;
  message: string | null;
}

/** 某个逻辑 ID 的最终规则和来源链；未命中时 `rule` 为 `null`。 */
export interface ResolvedRuntimeRule {
  logicalId: string;
  rule: RuntimeRule | null;
  appliedSources: RuntimeRuleSource[];
}
