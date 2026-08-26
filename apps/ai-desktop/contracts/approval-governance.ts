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
