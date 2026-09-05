/** 新发现与当前客户需求的关系；人物负责判断，工作流负责据此收敛和路由。 */
export type RequirementDiscoveryRelationValue = "required-for-goal" | "follow-up-opportunity" | "customer-decision-required" | "unrelated";

export interface RequirementDiscoveryOutDto {
  issue: string;
  relation: RequirementDiscoveryRelationValue;
  reason: string;
  evidence: string[];
  suggestedAction: string;
}

/**
 * 客户需求进入内部研讨前的中立事实包。
 * 韩立调查只负责写入，Workflow 只负责读取；双方不调用彼此的业务服务。
 */
export interface RequirementDiscussionContextOutDto {
  contextId: string;
  ownerPersonaId: string;
  conversationId: string;
  sourceRequestId: string;
  customerQuestion: string;
  understoodGoal: string;
  verificationTarget: string;
  expectedAnswer: string;
  investigationQuestion: string;
  findingStatus: "verified" | "unknown";
  findingSummary: string;
  evidence: Array<{ source: string; detail: string }>;
  unknowns: string[];
  customerConclusion: string;
  createdAt: string;
}
