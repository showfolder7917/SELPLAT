/** 经主进程校验后可以跨进程展示的规则。 */
import type { RuntimeRuleSourceValue } from "../value/runtime-rule-source.value.js";

export interface RuntimeRuleOutDto {
  logicalId: string;
  title: string;
  content: string;
  source: RuntimeRuleSourceValue;
  sourceName: string;
  sha256: string;
  customerOverridable: boolean;
}
