import { randomUUID } from "node:crypto";

import type { CollaborationTimelineBusinessEvent } from "../../../contracts/collaboration/collaboration-timeline-event.js";
import type { CollaborationTask } from "../../../contracts/collaboration/collaboration.js";
import type { EvolutionDistributionAudit, EvolutionDistributionPlan, EvolutionDistributionUnit, EvolutionProposal, NangongEvolutionState } from "../../../contracts/collaboration/nangong-evolution.js";
import type { CollaborationCoordinator } from "./collaboration-coordinator.js";
import { NangongEvolutionStore } from "./nangong-evolution-store.js";

type PlanResult = { summary: string; units: EvolutionDistributionUnit[] };

export interface EvolutionTaskDistributionServiceOptions {
  store: NangongEvolutionStore;
  collaboration: CollaborationCoordinator;
  plan(proposal: EvolutionProposal, topic: NangongEvolutionState["topics"][number], feedback: string): Promise<PlanResult>;
  audit(proposal: EvolutionProposal, topic: NangongEvolutionState["topics"][number], plan: PlanResult, hardFindings: string[]): Promise<EvolutionDistributionAudit>;
  recordEvent(type: string, details: Record<string, unknown>, taskId?: string): void;
  timeline?: (event: CollaborationTimelineBusinessEvent) => void;
}

/** 任务分发唯一服务：只消费“已通过审批”命令，不作审批判断。 */
export class EvolutionTaskDistributionService {
  constructor(private readonly options: EvolutionTaskDistributionServiceOptions) {}

  async dispatch(proposalId: string): Promise<NangongEvolutionState> {
    let state = this.options.store.state();
    let proposal = requireProposal(state, proposalId);
    const topic = requireTopic(state, proposal.topicId);
    if (proposal.status !== "approved") throw new Error("只有审批通过后才能分发任务。");
    if (!topic.workspaceState?.roots.length) throw new Error("当前专题缺少可用的实施工作区，无法分发。");

    if (!proposal.distributionPlan || proposal.distributionPlan.audit.decision !== "passed") {
      let feedback = proposal.distributionPlan?.audit.findings.join("；") || "";
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        const planned = await this.options.plan(proposal, topic, feedback);
        const hardFindings = distributionHardFindings(planned.units);
        const audit = await this.options.audit(proposal, topic, planned, hardFindings);
        const plan: EvolutionDistributionPlan = { version: 1, summary: planned.summary, units: planned.units, audit, plannedAt: new Date().toISOString() };
        state = this.options.store.saveDistributionPlan(proposalId, plan);
        proposal = requireProposal(state, proposalId);
        this.options.recordEvent("nangong.evolution.distribution_planned", { proposalId, attempt, unitCount: plan.units.length, expectedFiles: plan.units.flatMap((unit) => unit.expectedFiles), auditDecision: audit.decision, auditFindings: audit.findings });
        this.options.recordEvent("linghu.distribution_audit.completed", { proposalId, attempt, decision: audit.decision, reason: audit.reason, findings: audit.findings });
        if (audit.decision === "passed") break;
        feedback = [audit.reason, ...audit.findings].filter(Boolean).join("；");
      }
    }

    proposal = requireProposal(this.options.store.state(), proposalId);
    if (!proposal.distributionPlan || proposal.distributionPlan.audit.decision !== "passed") throw new Error("令狐确认当前任务拆分仍存在重叠，已阻止分发并退回南宫婉重新规划。");

    const distributedTaskIds = [...proposal.distributedTaskIds];
    const latestApproval = proposal.approvals.at(-1);
    const revisionFeedback = proposal.revisionFeedbackApprovalId
      ? state.proposals.flatMap((item) => item.approvals).find((approval) => approval.approvalId === proposal.revisionFeedbackApprovalId)
      : null;
    const collaborationState = typeof this.options.collaboration.state === "function" ? this.options.collaboration.state() : { members: [], tasks: [] };
    const targetMember = proposal.targetMemberId ? collaborationState.members.find((member) => member.memberId === proposal.targetMemberId) : null;
    const observedTasks: CollaborationTask[] = collaborationState.tasks.filter((task) => task.evolutionProposalId === proposal.proposalId);
    const existingTaskTitles = new Set(observedTasks.map((task) => task.snapshot.title));
    for (const [index, unit] of proposal.distributionPlan.units.entries()) {
      if (existingTaskTitles.has(unit.title)) continue;
      const selfUpgradeContext = proposal.purpose === "self-capability-upgrade"
        ? `\n\n自身能力升级目标：${proposal.targetMemberDisplayName}（${proposal.targetMemberId}）\n能力范围：${proposal.capabilityScope}\n原人工反馈：${revisionFeedback?.advice || "—"}\n必须修改该人物自身使用的规则、提示、工作流或实现，并用回归测试证明以后同类提交会更具体。`
        : "";
      const next = this.options.collaboration.submitTask({
        title: unit.title, problemStatement: topic.goal,
        confirmedIntent: `${proposal.content}\n\n本任务范围：${unit.scope}\n\n回退方案：${proposal.rollbackPlan}${selfUpgradeContext}`,
        constraints: [...proposal.exclusions.map((item) => `不涉及：${item}`), ...proposal.risks.map((item) => `风险：${item}`)],
        acceptanceCriteria: unit.acceptanceCriteria, workspaceState: topic.workspaceState, locale: topic.locale,
        mergeStrategy: "ATOMIC_GROUP", atomicGroupId: proposal.proposalId, dependencyTaskIds: [], initiatorMemberId: proposal.submitterMemberId,
        preferredExecutorMemberId: proposal.purpose === "self-capability-upgrade" && targetMember?.kind === "worker" ? targetMember.memberId : proposal.origin === "linghu" ? "linghu-ancestor" : undefined,
        evolutionProposalId: proposal.proposalId, evolutionRoundId: proposal.proposalId,
        selfUpgradeTargetMemberId: proposal.targetMemberId || undefined, selfUpgradeCapabilityScope: proposal.capabilityScope || undefined,
        sourceEvolutionApprovalId: latestApproval?.approvalId,
      });
      const createdTask = next.tasks.find((task) => task.evolutionProposalId === proposal.proposalId && !distributedTaskIds.includes(task.taskId));
      if (!createdTask) throw new Error("协同任务已经创建，但未能建立提案关联。");
      distributedTaskIds.push(createdTask.taskId);
      observedTasks.push(createdTask);
      existingTaskTitles.add(unit.title);
      this.options.recordEvent(`${proposal.origin}.evolution.proposal_distributed`, { proposalId, topicId: topic.topicId, unit: unit.title, index }, createdTask.taskId);
      state = this.options.store.markDispatched(proposalId, createdTask.taskId);
    }
    this.#publishDistribution(requireProposal(state, proposalId), topic, observedTasks);
    return state;
  }

  #publishDistribution(proposal: EvolutionProposal, topic: NangongEvolutionState["topics"][number], observedTasks: CollaborationTask[]): void {
    const tasks = observedTasks.filter((task) => proposal.distributedTaskIds.includes(task.taskId));
    // 接收人只来自冻结的执行分配；currentHandler 可能仍是提交人，不能据此反推出“南宫婉发给南宫婉”。
    const recipients = tasks.map((task) => task.executionRecords?.[0]?.executor || task.originalExecutor || { memberId: `pending:${task.taskId}`, displayName: "等待分配" })
      .filter((recipient) => recipient.memberId !== proposal.submitterMemberId)
      .filter((value, index, values) => values.findIndex((candidate) => candidate.memberId === value.memberId) === index);
    const occurredAt = proposal.distributionPlan?.plannedAt || proposal.updatedAt;
    const priorAdvice = proposal.revisionFeedbackApprovalId
      ? this.options.store.state().proposals.flatMap((item) => item.approvals).find((approval) => approval.approvalId === proposal.revisionFeedbackApprovalId)?.advice || ""
      : "";
    this.options.timeline?.({
      eventId: `distribution-${proposal.proposalId}-${randomUUID()}`,
      eventType: "task.distribution",
      group: { groupId: `topic:${topic.topicId}`, topicId: topic.topicId, proposalId: proposal.proposalId, title: topic.title, status: "running", summary: proposal.distributionPlan?.summary || proposal.content, startedAt: topic.createdAt, updatedAt: occurredAt },
      fact: {
        nodeId: `distribution:${proposal.proposalId}`, taskId: null, proposalId: proposal.proposalId,
        sourceFactKey: `distribution:${proposal.proposalId}`, kind: "distribution", actor: { memberId: proposal.submitterMemberId, displayName: proposal.submitterDisplayName }, recipients,
        contentRole: "task-content", detailRole: "task-breakdown",
        status: "completed", action: "任务分发", summary: proposal.distributionPlan?.summary || proposal.content,
        content: [proposal.content, priorAdvice ? `审批退回后的补充：${priorAdvice}` : "", ...proposal.distributionPlan!.units.map((unit) => `${unit.title}：${unit.scope}`)].filter(Boolean).join("\n\n"),
        detail: proposal.distributionPlan!.units.map((unit) => `${unit.title}：${unit.scope}`).join("\n"), startedAt: occurredAt,
        completedAt: occurredAt, automaticOpen: false, manualApprovalProposalId: null, occurredAt,
      },
    });
  }
}

function distributionHardFindings(units: EvolutionDistributionUnit[]): string[] {
  const findings: string[] = [];
  for (let index = 0; index < units.length; index += 1) for (let other = index + 1; other < units.length; other += 1) {
    const overlap = units[index].expectedFiles.filter((file) => units[other].expectedFiles.includes(file));
    if (overlap.length) findings.push(`文件同时属于任务“${units[index].title}”与“${units[other].title}”：${overlap.join("、")}`);
  }
  return findings;
}
function requireProposal(state: NangongEvolutionState, proposalId: string) { const value = state.proposals.find((item) => item.proposalId === proposalId); if (!value) throw new Error("演化提案不存在。"); return value; }
function requireTopic(state: NangongEvolutionState, topicId: string) { const value = state.topics.find((item) => item.topicId === topicId); if (!value) throw new Error("专项课题不存在。"); return value; }
