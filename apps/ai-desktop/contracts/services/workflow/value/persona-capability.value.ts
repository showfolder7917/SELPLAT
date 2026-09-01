/**
 * Workflow 用来选择人物的稳定能力名。
 *
 * 生产者：人物能力注册表。
 * 消费者：Workflow 路由与能力检查。
 * 数据方向：人物注册信息 -> Workflow。
 * 禁止职责：不声明可调用方法，不持有人物 Runtime 或实现。
 */
export type PersonaCapabilityValue =
  | "investigation"
  | "proposal-authoring"
  | "deliberation"
  | "proposal-review"
  | "acceptance"
  | "flow-guard"
  | "unified-test";
