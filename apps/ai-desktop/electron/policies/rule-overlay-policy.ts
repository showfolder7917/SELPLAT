/** 客户规则覆盖授权策略：把“能否覆盖”的判断与文件读取、合并副作用分离。 */

export interface RuleOverlayTarget {
  logicalId: string;
  customerOverridable: boolean;
}

export type RuleOverlayDecision =
  | { allowed: true }
  | { allowed: false; reason: "unknown-rule" | "locked-rule" | "duplicate-overlay"; message: string };

/**
 * 判断客户覆盖能否替换目标规则。
 * 示例：可覆盖且未声明过的内置规则返回 `{allowed:true}`；未知、锁定或重复 ID 返回稳定拒绝原因。
 */
export function decideRuleOverlay(target: RuleOverlayTarget | undefined, alreadyOverridden: boolean, logicalId: string): RuleOverlayDecision {
  if (!target) return { allowed: false, reason: "unknown-rule", message: `覆盖了未知规则：${logicalId}` };
  if (!target.customerOverridable) return { allowed: false, reason: "locked-rule", message: `规则不允许客户覆盖：${logicalId}` };
  if (alreadyOverridden) return { allowed: false, reason: "duplicate-overlay", message: `规则被多个覆盖文件重复声明：${logicalId}` };
  return { allowed: true };
}
