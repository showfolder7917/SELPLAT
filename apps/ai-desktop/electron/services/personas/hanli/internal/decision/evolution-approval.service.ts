import { randomUUID } from "node:crypto";

import type { CollaborationTimelineBusinessEventOutDto } from "../../../../../../contracts/services/workflow/index.js";
import type {
  EvolutionApprovalDecisionValue,
  EvolutionApprovalSourceValue,
  EvolutionFeedbackTargetValue,
  EvolutionProposalOutDto,
  EvolutionStateOutDto,
} from "../../../../../../contracts/services/evolution/index.js";
import type { EvolutionStatePort } from "../../../../evolution/index.js";

type TimelineSink = (event: CollaborationTimelineBusinessEventOutDto) => void;

/** 方向审批唯一服务：只写申请、决定和补充待办，不规划或分发任务。 */
export class EvolutionApprovalService {
  /** Evolution Store 保存方向审批的权威业务状态。 */
  readonly #store: EvolutionStatePort;
  /** 时间线端口发布审批申请、决定和补充状态；未接入时允许为空。 */
  readonly #timeline: TimelineSink | null;

  /** 装配审批状态与时间线端口，构造阶段不产生审批事件。 */
  constructor(store: EvolutionStatePort, timeline: TimelineSink | null) {
    // 保存权威审批状态端口，后续读取和决定都使用同一实例。
    this.#store = store;
    // 保存可选时间线端口，避免审批服务直接依赖数据库投影实现。
    this.#timeline = timeline;
  }

  recordApplication(proposalId: string): EvolutionStateOutDto {
    const state = this.#store.state();
    const proposal = requireProposal(state, proposalId);
    this.#publishApplication(state, proposal);
    if (proposal.supersedesProposalId) {
      // 修订提案重新申请时，先关闭上一条等待补充节点。
      this.#publishSupplementCompleted(state, proposal);
    }
    return state;
  }

  decide(
    proposalId: string,
    decision: EvolutionApprovalDecisionValue,
    advice: string,
    source: EvolutionApprovalSourceValue,
    referencedApprovalIds: string[],
    feedbackTarget: EvolutionFeedbackTargetValue = "proposal-content",
    capabilityScope = "",
  ): EvolutionStateOutDto {
    const next = this.#store.decide(proposalId, decision, advice, source, referencedApprovalIds, feedbackTarget, capabilityScope);
    const proposal = requireProposal(next, proposalId);
    const approval = proposal.approvals.at(-1)!;
    const topic = requireTopic(next, proposal.topicId);
    // 审批通过后专题继续运行，其他结果仍停在等待审批阶段。
    const groupStatus = approvalGroupStatus(decision);
    // 关闭申请节点时明确区分首次申请和补充后再次申请。
    const applicationAction = approvalApplicationAction(proposal);
    // 将原申请节点标记为完成，保留提案内容和证据。
    this.#timeline?.({
      eventId: `approval-application-closed-${approval.approvalId}`,
      eventType: "approval.application",
      group: group(topic, proposal, groupStatus, approval.advice, approval.createdAt),
      fact: {
        nodeId: `proposal:${proposal.proposalId}`,
        taskId: null,
        proposalId: proposal.proposalId,
        sourceFactKey: `approval-application-closed:${approval.approvalId}`,
        kind: "approval-application",
        contentRole: "approval-content",
        detailRole: "application-evidence",
        actor: person(proposal.submitterMemberId, proposal.submitterDisplayName),
        recipients: [person("han-li", "韩立")],
        status: "completed",
        action: applicationAction,
        summary: proposal.content,
        content: proposal.content,
        detail: proposal.evidence.join("\n"),
        startedAt: proposal.createdAt,
        completedAt: approval.createdAt,
        automaticOpen: false,
        manualApprovalProposalId: null,
        occurredAt: approval.createdAt,
      },
    });
    // 显式计算决定节点的状态和动作，避免嵌套三元掩盖三个业务分支。
    const decisionStatus = approvalDecisionTimelineStatus(approval.decision);
    // action 使用独立函数把决定枚举映射成人类可读动作。
    const decisionAction = approvalDecisionAction(approval.decision);
    // 发布韩立真实审批决定，申请人与审批人身份保持分离。
    this.#timeline?.({
      eventId: approval.approvalId,
      eventType: "approval.decision",
      group: group(topic, proposal, groupStatus, approval.advice, approval.createdAt),
      fact: {
        nodeId: `approval:${approval.approvalId}`,
        taskId: null,
        proposalId: proposal.proposalId,
        sourceFactKey: `approval:${approval.approvalId}`,
        kind: "approval-decision",
        contentRole: "approval-reason",
        detailRole: "approval-scope",
        actor: person(approval.approverMemberId, approval.approverDisplayName),
        recipients: [person(proposal.submitterMemberId, proposal.submitterDisplayName)],
        status: decisionStatus,
        action: decisionAction,
        summary: approval.advice,
        content: approval.advice,
        detail: approval.capabilityScope || "",
        startedAt: approval.createdAt,
        completedAt: approval.createdAt,
        automaticOpen: false,
        manualApprovalProposalId: null,
        occurredAt: approval.createdAt,
      },
    });
    if (approval.decision !== "approved") {
      // 退回补充或驳回都需要发布清晰的后续等待节点。
      this.#publishSupplementWaiting(next, proposal, approval.advice, approval.createdAt);
    }
    return next;
  }

  #publishApplication(state: EvolutionStateOutDto, proposal: EvolutionProposalOutDto): void {
    const topic = requireTopic(state, proposal.topicId);
    const manual = state.automationRuntime.status !== "running" && state.oneShotRun?.status !== "running";
    const applicationAction = approvalApplicationAction(proposal);
    let manualApprovalProposalId: string | null = null;
    if (manual) {
      manualApprovalProposalId = proposal.proposalId;
    }
    this.#timeline?.({
      eventId: `approval-application-${proposal.proposalId}`,
      eventType: "approval.application",
      group: group(topic, proposal, "waiting-approval", proposal.content, proposal.createdAt),
      fact: {
        nodeId: `proposal:${proposal.proposalId}`,
        taskId: null,
        proposalId: proposal.proposalId,
        sourceFactKey: `approval-application:${proposal.proposalId}`,
        kind: "approval-application",
        contentRole: "approval-content",
        detailRole: "application-evidence",
        actor: person(proposal.submitterMemberId, proposal.submitterDisplayName),
        recipients: [person("han-li", "韩立")],
        status: "current",
        action: applicationAction,
        summary: proposal.content,
        content: proposal.content,
        detail: proposal.evidence.join("\n"),
        startedAt: proposal.createdAt,
        completedAt: null,
        automaticOpen: true,
        manualApprovalProposalId,
        occurredAt: proposal.createdAt,
      },
    });
  }

  #publishSupplementWaiting(state: EvolutionStateOutDto, proposal: EvolutionProposalOutDto, advice: string, occurredAt: string): void {
    const topic = requireTopic(state, proposal.topicId);
    const automatic = state.automationRuntime.status === "running" || state.oneShotRun?.status === "running";
    let supplementStatus: "current" | "waiting" = "waiting";
    let supplementAction = "等待手动补充审批材料";
    if (automatic) {
      supplementStatus = "current";
      supplementAction = "正在补充审批材料";
    }
    this.#timeline?.({
      eventId: `approval-supplement-${proposal.proposalId}-${randomUUID()}`,
      eventType: "approval.supplement_waiting",
      group: group(topic, proposal, "waiting-approval", advice, occurredAt),
      fact: {
        nodeId: `supplement:${proposal.proposalId}`,
        taskId: null,
        proposalId: proposal.proposalId,
        sourceFactKey: `approval-supplement-waiting:${proposal.approvals.at(-1)!.approvalId}`,
        kind: "analysis",
        contentRole: "status",
        detailRole: "none",
        actor: person(proposal.submitterMemberId, proposal.submitterDisplayName),
        recipients: [person("han-li", "韩立")],
        status: supplementStatus,
        action: supplementAction,
        summary: "南宫婉正在根据韩立的审批意见补充材料。",
        content: "待补充审批材料；原审批意见保留在上一条韩立审批节点中。",
        detail: "",
        startedAt: occurredAt,
        completedAt: null,
        automaticOpen: automatic,
        manualApprovalProposalId: null,
        occurredAt,
      },
    });
  }

  #publishSupplementCompleted(state: EvolutionStateOutDto, revision: EvolutionProposalOutDto): void {
    const previousId = revision.supersedesProposalId!;
    const previous = requireProposal(state, previousId);
    const feedback = previous.approvals.at(-1);
    const topic = requireTopic(state, revision.topicId);
    const detailLines: string[] = [];
    if (revision.impactScope.length > 0) {
      detailLines.push(`影响范围：${revision.impactScope.join("；")}`);
    }
    if (revision.risks.length > 0) {
      detailLines.push(`风险：${revision.risks.join("；")}`);
    }
    if (revision.acceptanceCriteria.length > 0) {
      detailLines.push(`验收条件：${revision.acceptanceCriteria.join("；")}`);
    }
    const startedAt = feedback?.createdAt || revision.createdAt;
    this.#timeline?.({
      eventId: `approval-supplement-completed-${revision.proposalId}`,
      eventType: "approval.supplement_completed",
      group: group(topic, revision, "waiting-approval", revision.content, revision.createdAt),
      fact: {
        nodeId: `supplement:${previousId}`,
        taskId: null,
        proposalId: previousId,
        sourceFactKey: `approval-supplement-completed:${revision.proposalId}`,
        kind: "analysis",
        contentRole: "analysis-output",
        detailRole: "result-evidence",
        actor: person(revision.submitterMemberId, revision.submitterDisplayName),
        recipients: [person("han-li", "韩立")],
        status: "completed",
        action: "补充材料已重新提交",
        summary: "已根据韩立的退回原因补充方案并重新申请审批。",
        content: ["补充调查证据：", ...revision.evidence].join("\n"),
        detail: detailLines.join("\n"),
        startedAt,
        completedAt: revision.createdAt,
        automaticOpen: false,
        manualApprovalProposalId: null,
        occurredAt: revision.createdAt,
      },
    });
  }
}

/** 根据提案是否替代旧版本返回清楚的审批申请动作名称。 */
function approvalApplicationAction(proposal: EvolutionProposalOutDto): string {
  if (proposal.supersedesProposalId) {
    return "补充后再次申请";
  }
  return "审批申请";
}

function group(
  topic: EvolutionStateOutDto["topics"][number],
  proposal: EvolutionProposalOutDto,
  status: CollaborationTimelineBusinessEventOutDto["group"]["status"],
  summary: string,
  updatedAt: string,
): CollaborationTimelineBusinessEventOutDto["group"] {
  return {
    groupId: `topic:${topic.topicId}`,
    topicId: topic.topicId,
    proposalId: proposal.proposalId,
    title: topic.title,
    status,
    summary,
    startedAt: topic.createdAt,
    updatedAt,
  };
}

/** 把成员稳定标识和显示名组合成时间线人物引用。 */
function person(memberId: string, displayName: string) {
  return { memberId, displayName };
}

/** 根据审批结果返回专题卡应显示的阶段。 */
function approvalGroupStatus(decision: EvolutionApprovalDecisionValue): CollaborationTimelineBusinessEventOutDto["group"]["status"] {
  if (decision === "approved") {
    return "running";
  }
  return "waiting-approval";
}

/** 根据审批结果返回决定节点的完成状态。 */
function approvalDecisionTimelineStatus(decision: EvolutionApprovalDecisionValue): "completed" | "failed" {
  if (decision === "approved") {
    return "completed";
  }
  return "failed";
}

/** 把审批枚举映射成用户可读动作，禁止使用嵌套三元隐藏分支。 */
function approvalDecisionAction(decision: EvolutionApprovalDecisionValue): string {
  if (decision === "approved") {
    return "审批通过";
  }
  if (decision === "supplement-required") {
    return "审批退回补充";
  }
  return "审批驳回";
}

/** 读取指定提案；不存在时阻断审批时间线写入。 */
function requireProposal(state: EvolutionStateOutDto, proposalId: string): EvolutionProposalOutDto {
  const proposal = state.proposals.find((item) => item.proposalId === proposalId);
  if (!proposal) {
    throw new Error("演化提案不存在。");
  }
  return proposal;
}

/** 读取指定专题；不存在时阻断孤立审批事件。 */
function requireTopic(state: EvolutionStateOutDto, topicId: string): EvolutionStateOutDto["topics"][number] {
  const topic = state.topics.find((item) => item.topicId === topicId);
  if (!topic) {
    throw new Error("专项课题不存在。");
  }
  return topic;
}
