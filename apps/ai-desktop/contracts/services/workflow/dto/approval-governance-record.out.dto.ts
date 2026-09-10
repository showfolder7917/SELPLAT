// ApprovalGovernanceDomainValue 说明这条审批记录属于哪个治理领域。
import type { ApprovalGovernanceDomainValue } from "../value/approval-governance-domain.value.js";

/**
 * Workflow 输出的统一审批治理投影。
 *
 * 生产者：Workflow Repository。
 * 消费者：DesktopApi 与 Renderer 审批治理视图。
 * 数据方向：Workflow -> DesktopApi -> Renderer。
 * 本 DTO 只承载查询结果，不改变 Evolution、协作评审或 Codex 命令审批状态。
 */
/** 一次审批决定形成的、只读且可审计的治理记录。 */
export interface ApprovalGovernanceRecordOutDto {
  /** 治理记录的稳定唯一标识。 */
  governanceId: string;
  /** 该记录所属的审批治理领域。 */
  domain: ApprovalGovernanceDomainValue;
  /** 被审批业务对象的标识。 */
  subjectId: string;
  /** 串联同一业务链事件的标识；没有关联链时为 null。 */
  correlationId: string | null;
  /** 审批事项的显示标题。 */
  title: string;
  /** 发起方申请的业务动作类别。 */
  requestKind: string;
  /** 审批人最终作出的决定。 */
  decision: string;
  /** 发起审批的人物标识；系统发起时为 null。 */
  initiatorId: string | null;
  /** 发起审批的人物名称；系统发起时为 null。 */
  initiatorDisplayName: string | null;
  /** 作出决定的审批人标识。 */
  approverId: string;
  /** 作出决定时的审批人显示名称。 */
  approverDisplayName: string;
  /** 产生审批请求的业务来源。 */
  source: string;
  /** 审批人给出的决定理由。 */
  reason: string;
  /** 支持该决定的结构化业务证据。 */
  evidence: Record<string, unknown>;
  /** 审批决定生效的时间。 */
  decidedAt: string;
}
