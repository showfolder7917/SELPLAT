/** 一个逻辑 ID 最终命中的规则及来源链。 */
import type { RuntimeRuleOutDto } from "./runtime-rule.out.dto.js";
import type { RuntimeRuleSourceValue } from "../value/runtime-rule-source.value.js";

export interface ResolvedRuntimeRuleOutDto {
  logicalId: string;
  rule: RuntimeRuleOutDto | null;
  appliedSources: RuntimeRuleSourceValue[];
}
