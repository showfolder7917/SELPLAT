/** 主进程规则领域 IPC：只公开规则状态与有效内容，不接受 Renderer 提交规则文件。 */
import { RuleBundleFacade as RuleBundleService } from "../../services/capabilities/rules/index.js";
import type { EventCenterFacade } from "../../services/capabilities/event-center/index.js";
import { registerEventCenterIpcHandler } from "../event-center-ipc.js";

/** 注册规则只读查询接口；真实参数示例为稳定逻辑 ID，未知 ID 返回空规则。 */
export function registerRulesIpc(rules: RuleBundleService, eventCenter: EventCenterFacade): void {
  registerEventCenterIpcHandler(eventCenter, "desktop:get-rule-bundle-status", () => rules.status());
  registerEventCenterIpcHandler(eventCenter, "desktop:list-effective-rules", () => rules.listEffectiveRules());
  registerEventCenterIpcHandler(eventCenter, "desktop:resolve-effective-rule", (_event, logicalId: unknown) => {
    if (typeof logicalId !== "string") throw new Error("规则逻辑 ID 必须是字符串。");
    return rules.resolve(logicalId);
  }, "business");
}
