/**
 * 提案验收计划输出协议。
 * 生产者：Evolution 状态服务；消费者：韩立验收、Workflow 与候选集成门禁。
 * 数据方向：提案版本 -> 已冻结的验收条件、证据要求和验收轮次。
 * 禁止职责：不保存截图正文、不替代验收运行，也不直接改变专题完成状态。
 */
export type EvolutionAcceptanceEvidenceTypeValue = "page-experience" | "code-conformance";

export interface EvolutionAcceptancePlanConditionOutDto {
  /** 绑定提案版本的稳定条件编号，例如 criterion-1。 */
  conditionId: string;
  /** 冻结时的原始验收条件文本；后续专题编辑不能改变其含义。 */
  criterion: string;
  /** 此条件唯一允许使用的证据类别。 */
  evidenceType: EvolutionAcceptanceEvidenceTypeValue;
  /** 完成门禁的可读要求，例如页面截图和布局判断或代码/测试引用。 */
  completionRequirement: string;
}

export interface EvolutionAcceptanceRoundOutDto {
  roundId: string;
  roundNumber: number;
  /** 首轮为 null；重开时指向保留的完成决定档案。 */
  reopenedFromRecordId: string | null;
  reopenReason: string | null;
  reopenSourceRecordId: string | null;
  openedAt: string;
}

export interface EvolutionAcceptancePlanOutDto {
  version: 1;
  planId: string;
  topicId: string;
  proposalId: string;
  proposalVersion: number;
  conditions: EvolutionAcceptancePlanConditionOutDto[];
  rounds: EvolutionAcceptanceRoundOutDto[];
  currentRoundId: string;
  createdAt: string;
}
