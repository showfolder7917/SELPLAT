import { randomUUID } from "node:crypto";

import type { CollaborationTimelineBusinessEventOutDto } from "../../../../../contracts/services/workflow/index.js";
import type { EvolutionApprovalDecisionValue, EvolutionApprovalSourceValue, EvolutionFeedbackTargetValue, EvolutionProposalOutDto, EvolutionStateOutDto } from "../../../../../contracts/services/evolution/index.js";
import type { EvolutionStatePort } from "../../../evolution/index.js";

type TimelineSink = (event: CollaborationTimelineBusinessEventOutDto) => void;

/** 方向审批唯一服务：只写申请、决定和补充待办，不规划或分发任务。 */
export class EvolutionApprovalService {
  constructor(private readonly store: EvolutionStatePort, private readonly timeline: TimelineSink | null) {}

  recordApplication(proposalId: string): EvolutionStateOutDto {
    const state = this.store.state();
    const proposal = requireProposal(state, proposalId);
    this.#publishApplication(state, proposal);
    if (proposal.supersedesProposalId) this.#publishSupplementCompleted(state, proposal);
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
    const next = this.store.decide(proposalId, decision, advice, source, referencedApprovalIds, feedbackTarget, capabilityScope);
    const proposal = requireProposal(next, proposalId);
    const approval = proposal.approvals.at(-1)!;
    const topic = requireTopic(next, proposal.topicId);
    this.timeline?.({
      eventId: `approval-application-closed-${approval.approvalId}`,
      eventType: "approval.application",
      group: group(topic, proposal, decision === "approved" ? "running" : "waiting-approval", approval.advice, approval.createdAt),
      fact: {
        nodeId: `proposal:${proposal.proposalId}`, taskId: null, proposalId: proposal.proposalId,
        sourceFactKey: `approval-application-closed:${approval.approvalId}`, kind: "approval-application",
        contentRole: "approval-content", detailRole: "application-evidence",
        actor: person(proposal.submitterMemberId, proposal.submitterDisplayName), recipients: [person("han-li", "韩立")],
        status: "completed", action: proposal.supersedesProposalId ? "补充后再次申请" : "审批申请",
        summary: proposal.content, content: proposal.content, detail: proposal.evidence.join("\n"), startedAt: proposal.createdAt,
        completedAt: approval.createdAt, automaticOpen: false, manualApprovalProposalId: null, occurredAt: approval.createdAt,
      },
    });
    this.timeline?.({
      eventId: approval.approvalId,
      eventType: "approval.decision",
      group: group(topic, proposal, decision === "approved" ? "running" : "waiting-approval", approval.advice, approval.createdAt),
      fact: {
        nodeId: `approval:${approval.approvalId}`, taskId: null, proposalId: proposal.proposalId,
        sourceFactKey: `approval:${approval.approvalId}`, kind: "approval-decision",
        contentRole: "approval-reason", detailRole: "approval-scope",
        actor: person(approval.approverMemberId, approval.approverDisplayName), recipients: [person(proposal.submitterMemberId, proposal.submitterDisplayName)],
        status: approval.decision === "approved" ? "completed" : "failed",
        action: approval.decision === "approved" ? "审批通过" : approval.decision === "supplement-required" ? "审批退回补充" : "审批驳回",
        summary: approval.advice, content: approval.advice, detail: approval.capabilityScope || "", startedAt: approval.createdAt,
        completedAt: approval.createdAt, automaticOpen: false, manualApprovalProposalId: null, occurredAt: approval.createdAt,
      },
    });
    if (approval.decision !== "approved") this.#publishSupplementWaiting(next, proposal, approval.advice, approval.createdAt);
    return next;
  }

  #publishApplication(state: EvolutionStateOutDto, proposal: EvolutionProposalOutDto): void {
    const topic = requireTopic(state, proposal.topicId);
    const manual = !(proposal.origin === "linghu" ? state.automaticLinghuApprovalEnabled : state.automaticNangongApprovalEnabled);
    this.timeline?.({
      eventId: `approval-application-${proposal.proposalId}`,
      eventType: "approval.application",
      group: group(topic, proposal, "waiting-approval", proposal.content, proposal.createdAt),
      fact: {
        nodeId: `proposal:${proposal.proposalId}`, taskId: null, proposalId: proposal.proposalId,
        sourceFactKey: `approval-application:${proposal.proposalId}`, kind: "approval-application",
        contentRole: "approval-content", detailRole: "application-evidence",
        actor: person(proposal.submitterMemberId, proposal.submitterDisplayName), recipients: [person("han-li", "韩立")],
        status: "current", action: proposal.supersedesProposalId ? "补充后再次申请" : "审批申请",
        summary: proposal.content, content: proposal.content, detail: proposal.evidence.join("\n"), startedAt: proposal.createdAt,
        completedAt: null, automaticOpen: true, manualApprovalProposalId: manual ? proposal.proposalId : null, occurredAt: proposal.createdAt,
      },
    });
  }

  #publishSupplementWaiting(state: EvolutionStateOutDto, proposal: EvolutionProposalOutDto, advice: string, occurredAt: string): void {
    const topic = requireTopic(state, proposal.topicId);
    const automatic = state.automaticEvolutionEnabled || state.oneShotRun?.status === "running";
    this.timeline?.({
      eventId: `approval-supplement-${proposal.proposalId}-${randomUUID()}`,
      eventType: "approval.supplement_waiting",
      group: group(topic, proposal, "waiting-approval", advice, occurredAt),
      fact: {
        nodeId: `supplement:${proposal.proposalId}`, taskId: null, proposalId: proposal.proposalId,
        sourceFactKey: `approval-supplement-waiting:${proposal.approvals.at(-1)!.approvalId}`, kind: "analysis",
        contentRole: "status", detailRole: "none",
        actor: person(proposal.submitterMemberId, proposal.submitterDisplayName), recipients: [person("han-li", "韩立")],
        status: automatic ? "current" : "waiting", action: automatic ? "正在补充审批材料" : "等待手动补充审批材料",
        summary: "南宫婉正在根据韩立的审批意见补充材料。",
        content: `待补充审批材料；原审批意见保留在上一条韩立审批节点中。`, detail: "",
        startedAt: occurredAt, completedAt: null, automaticOpen: automatic, manualApprovalProposalId: null, occurredAt,
      },
    });
  }

  #publishSupplementCompleted(state: EvolutionStateOutDto, revision: EvolutionProposalOutDto): void {
    const previousId = revision.supersedesProposalId!;
    const previous = requireProposal(state, previousId);
    const feedback = previous.approvals.at(-1);
    const topic = requireTopic(state, revision.topicId);
    this.timeline?.({
      eventId: `approval-supplement-completed-${revision.proposalId}`,
      eventType: "approval.supplement_completed",
      group: group(topic, revision, "waiting-approval", revision.content, revision.createdAt),
      fact: {
        nodeId: `supplement:${previousId}`, taskId: null, proposalId: previousId,
        sourceFactKey: `approval-supplement-completed:${revision.proposalId}`, kind: "analysis",
        contentRole: "analysis-output", detailRole: "result-evidence",
        actor: person(revision.submitterMemberId, revision.submitterDisplayName), recipients: [person("han-li", "韩立")],
        status: "completed", action: "补充材料已重新提交", summary: "已根据韩立的退回原因补充方案并重新申请审批。",
        content: ["补充调查证据：", ...revision.evidence].join("\n"),
        detail: [
          revision.impactScope.length ? `影响范围：${revision.impactScope.join("；")}` : "",
          revision.risks.length ? `风险：${revision.risks.join("；")}` : "",
          revision.acceptanceCriteria.length ? `验收条件：${revision.acceptanceCriteria.join("；")}` : "",
        ].filter(Boolean).join("\n"), startedAt: feedback?.createdAt || revision.createdAt,
        completedAt: revision.createdAt, automaticOpen: false, manualApprovalProposalId: null, occurredAt: revision.createdAt,
      },
    });
  }
}

function group(topic: EvolutionStateOutDto["topics"][number], proposal: EvolutionProposalOutDto, status: CollaborationTimelineBusinessEventOutDto["group"]["status"], summary: string, updatedAt: string): CollaborationTimelineBusinessEventOutDto["group"] {
  return { groupId: `topic:${topic.topicId}`, topicId: topic.topicId, proposalId: proposal.proposalId, title: topic.title, status, summary, startedAt: topic.createdAt, updatedAt };
}
function person(memberId: string, displayName: string) { return { memberId, displayName }; }
function requireProposal(state: EvolutionStateOutDto, proposalId: string) { const value = state.proposals.find((item) => item.proposalId === proposalId); if (!value) throw new Error("演化提案不存在。"); return value; }
function requireTopic(state: EvolutionStateOutDto, topicId: string) { const value = state.topics.find((item) => item.topicId === topicId); if (!value) throw new Error("专项课题不存在。"); return value; }
