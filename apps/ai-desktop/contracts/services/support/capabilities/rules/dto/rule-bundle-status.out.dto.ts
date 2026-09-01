/** 规则包加载与客户覆盖校验后的健康状态。 */
export interface RuleBundleStatusOutDto {
  state: "ready" | "degraded" | "unavailable";
  bundleVersion: string | null;
  generatedAt: string | null;
  builtinRuleCount: number;
  overlayRuleCount: number;
  rejectedOverlayCount: number;
  message: string | null;
}
