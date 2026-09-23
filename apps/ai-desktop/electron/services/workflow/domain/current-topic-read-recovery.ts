import type { CurrentTopicStageOutDto } from "../../../../contracts/services/evolution/index.js";

/** 读取失败不提升页面权限；只有当前阶段明确签发的操作才可由用户继续。 */
export function readCurrentTopicRecovery(userAction: CurrentTopicStageOutDto["userAction"], waitingFor: string, nextAction: string, updatedAt: string): CurrentTopicStageOutDto["readRecovery"] {
  const requiresUserAction = userAction !== "none";
  return {
    policyId: `${updatedAt}:${userAction}`,
    waitingFor: requiresUserAction ? waitingFor : "当前交付投影",
    requiresUserAction,
    nextAction: requiresUserAction ? `${nextAction} 完成后重新读取当前交付投影。` : "系统将自动重新读取当前交付投影；读取成功后再显示当前结论。",
  };
}
