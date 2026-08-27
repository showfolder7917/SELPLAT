/**
 * 审批治理协议，统一表达规则演进、协作复核和 Codex 命令审批的可审计结果。
 *
 * 生产者：主进程审批与工作流服务。
 * 消费者：Renderer 治理视图、审计查询和恢复流程。
 * 数据方向：main -> preload -> renderer。
 * 本文件不执行审批决定，也不持久化审批记录。
 */
export type ApprovalGovernanceDomain = "evolution" | "collaboration-review" | "codex-command";

/** 三类审批保持各自决策语义，只通过公共信封形成统一检索和审计视图。 */
export interface ApprovalGovernanceRecord {
  governanceId: string;
  domain: ApprovalGovernanceDomain;
  subjectId: string;
  correlationId: string | null;
  title: string;
  requestKind: string;
  decision: string;
  initiatorId: string | null;
  initiatorDisplayName: string | null;
  approverId: string;
  approverDisplayName: string;
  source: string;
  reason: string;
  evidence: Record<string, unknown>;
  decidedAt: string;
}
