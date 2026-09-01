import type { ApprovalGovernanceDomainValue } from "../value/approval-governance-domain.value.js";

/**
 * Workflow 输出的统一审批治理投影。
 *
 * 生产者：Workflow Repository。
 * 消费者：DesktopApi 与 Renderer 审批治理视图。
 * 数据方向：Workflow -> DesktopApi -> Renderer。
 * 本 DTO 只承载查询结果，不改变 Evolution、协作评审或 Codex 命令审批状态。
 */
export interface ApprovalGovernanceRecordOutDto {
  governanceId: string;
  domain: ApprovalGovernanceDomainValue;
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
