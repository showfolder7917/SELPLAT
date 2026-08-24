import type { ConvertNangongConversationToTopicRequest, CreateEvolutionProposalRequest, CreateEvolutionTopicRequest, CreateLinghuRepairProposalRequest, DecideEvolutionProposalRequest, EvolutionProposal, NangongEvolutionState, ReviseEvolutionProposalRequest, SendNangongConversationMessageRequest } from "../../../contracts/nangong-evolution.js";
import type { SendMessageResponse } from "../../../contracts/conversation.js";
import type { CollaborationCoordinator } from "./collaboration-coordinator.js";
import { NangongEvolutionStore } from "./nangong-evolution-store.js";

export interface NangongEvolutionFacadeOptions {
  store: NangongEvolutionStore;
  collaboration: CollaborationCoordinator;
  conversation: {
    send(request: SendNangongConversationMessageRequest, context: string): Promise<SendMessageResponse>;
    newChat(): Promise<void>;
  };
  recordEvent(type: string, details: Record<string, unknown>, taskId?: string): void;
}

/** 保持自动演化、自动审批和自动执行三道独立开关，并只在审批通过后调用协同分发。 */
export class NangongEvolutionFacade {
  readonly #store: NangongEvolutionStore;
  readonly #collaboration: CollaborationCoordinator;
  readonly #conversation: NangongEvolutionFacadeOptions["conversation"];
  readonly #recordEvent: NangongEvolutionFacadeOptions["recordEvent"];
  #timer: ReturnType<typeof setInterval> | null = null;
  #running = false;

  constructor(options: NangongEvolutionFacadeOptions) { this.#store = options.store; this.#collaboration = options.collaboration; this.#conversation = options.conversation; this.#recordEvent = options.recordEvent; }
  state(): NangongEvolutionState { return this.#store.state(); }
  subscribe(listener: Parameters<NangongEvolutionStore["subscribe"]>[0]) { return this.#store.subscribe(listener); }
  start(): void { if (!this.#timer) { void this.#tick(); this.#timer = setInterval(() => void this.#tick(), 30_000); } }
  stop(): void { if (this.#timer) clearInterval(this.#timer); this.#timer = null; }
  createTopic(request: CreateEvolutionTopicRequest): NangongEvolutionState { return this.#store.createTopic(request); }
  setAutomation(kind: "evolution" | "nangong-approval" | "linghu-approval" | "execution", enabled: boolean): NangongEvolutionState { return this.#store.setAutomation(kind, enabled); }
  async sendConversationMessage(request: SendNangongConversationMessageRequest): Promise<NangongEvolutionState> {
    let state = this.#store.appendConversation("user", request.message, request.attachmentIds || []);
    const context = state.conversation.messages.slice(-12).map((item) => `${item.role === "user" ? "用户" : "南宫婉"}：${item.content}`).join("\n\n");
    const response = await this.#conversation.send(request, context);
    state = this.#store.appendConversation("nangong", response.text);
    this.#recordEvent("nangong.evolution.conversation_replied", { conversationId: state.conversation.conversationId, messageCount: state.conversation.messages.length });
    return state;
  }
  async newConversation(): Promise<NangongEvolutionState> { await this.#conversation.newChat(); return this.#store.newConversation(); }
  convertConversationToTopic(request: ConvertNangongConversationToTopicRequest): NangongEvolutionState { return this.#store.convertConversationToTopic(request); }
  createProposal(topicId: string, request: CreateEvolutionProposalRequest): NangongEvolutionState { return this.#store.createProposal(topicId, request); }
  createLinghuRepairProposal(request: CreateLinghuRepairProposalRequest): NangongEvolutionState { return this.#store.createLinghuRepairProposal(request); }
  decideProposal(proposalId: string, request: DecideEvolutionProposalRequest): NangongEvolutionState {
    return this.#store.decide(proposalId, request.decision, request.advice || "", "manual-user", [], request.feedbackTarget || "proposal-content", request.capabilityScope || "");
  }
  reviseProposal(proposalId: string, request: ReviseEvolutionProposalRequest): NangongEvolutionState {
    const member = this.#collaboration.state().members.find((item) => item.memberId === request.submitterMemberId && item.enabled);
    if (!member) throw new Error("重新提交人不是当前已启用的协同人物。");
    return this.#store.revise(proposalId, request, member.displayName);
  }
  /** 自动职责只复用通用修订合同；已有子版本时返回现状，避免定时检测重复提交。 */
  reviseReturnedProposalAutomatically(proposalId: string): NangongEvolutionState {
    const state = this.state();
    const proposal = requireProposal(state, proposalId);
    if (state.proposals.some((item) => item.supersedesProposalId === proposal.proposalId)) return state;
    const feedback = proposal.approvals.at(-1);
    if (!feedback?.advice.trim()) throw new Error("自动修订缺少明确的人工审批意见。");
    const capabilityInstruction = feedback.feedbackTarget === "submitter-capability"
      ? `\n\n自身能力升级：修改${proposal.submitterDisplayName}自身使用的规则、提示、工作流或实现，能力范围为“${feedback.capabilityScope}”。`
      : "";
    const revised = this.reviseProposal(proposal.proposalId, {
      submitterMemberId: proposal.submitterMemberId,
      content: `${proposal.content}\n\n根据审批意见修订：${feedback.advice}${capabilityInstruction}`,
      evidence: [...proposal.evidence, `人工审批事实：${feedback.advice}`],
      impactScope: feedback.feedbackTarget === "submitter-capability" ? [...proposal.impactScope, `${proposal.submitterDisplayName}自身能力配置`] : proposal.impactScope,
      risks: [...proposal.risks], rollbackPlan: proposal.rollbackPlan,
      acceptanceCriteria: [...proposal.acceptanceCriteria, "修订版本逐项回应人工审批意见并保留版本与审批追溯"],
    });
    this.#recordEvent("member.evolution.proposal_revised", { proposalId: proposal.proposalId, submitterMemberId: proposal.submitterMemberId, feedbackApprovalId: feedback.approvalId });
    return revised;
  }

  autoApprove(proposalId: string): NangongEvolutionState {
    const state = this.state();
    const proposal = requireProposal(state, proposalId);
    const manualHistory = state.proposals.flatMap((item) => item.approvals.map((approval) => ({ item, approval })))
      .filter(({ item, approval }) => item.type === proposal.type && item.origin === proposal.origin && approval.source === "manual-user");
    if (!proposal.content || !proposal.evidence.length || !proposal.impactScope.length || !proposal.risks.length || !proposal.rollbackPlan || !proposal.acceptanceCriteria.length) {
      return this.#store.decide(proposalId, "supplement-required", `事实、范围、风险、回退或验收条件不完整，请${proposal.submitterDisplayName}补充调查。`, "automatic-han-li", []);
    }
    if (!manualHistory.length) return this.#store.decide(proposalId, "supplement-required", "没有同类型人工审批记录，不能以低置信度猜测通过。", "automatic-han-li", []);
    const latest = manualHistory.at(-1)!;
    const decision = latest.approval.decision === "approved" ? "approved" : latest.approval.decision;
    return this.#store.decide(proposalId, decision, `参考同类型人工审批 ${latest.approval.approvalId}，按偏好快照作出决定。`, "automatic-han-li", [latest.approval.approvalId]);
  }

  dispatch(proposalId: string): NangongEvolutionState {
    const state = this.state();
    const proposal = requireProposal(state, proposalId);
    const topic = state.topics.find((item) => item.topicId === proposal.topicId)!;
    if (proposal.status !== "approved") throw new Error("只有审批通过并返还提交人的提案才能分发。");
    let result = state;
    const distributedTaskIds = [...proposal.distributedTaskIds];
    const latestApproval = proposal.approvals.at(-1);
    const revisionFeedback = proposal.revisionFeedbackApprovalId
      ? state.proposals.flatMap((item) => item.approvals).find((approval) => approval.approvalId === proposal.revisionFeedbackApprovalId)
      : null;
    const targetMember = proposal.targetMemberId ? this.#collaboration.state().members.find((member) => member.memberId === proposal.targetMemberId) : null;
    for (const [index, unit] of proposal.distributionUnits.entries()) {
      const selfUpgradeContext = proposal.purpose === "self-capability-upgrade"
        ? `\n\n自身能力升级目标：${proposal.targetMemberDisplayName}（${proposal.targetMemberId}）\n能力范围：${proposal.capabilityScope}\n原人工反馈：${revisionFeedback?.advice || "—"}\n必须修改该人物自身使用的规则、提示、工作流或实现，并用回归测试证明以后同类提交会更具体。`
        : "";
      const next = this.#collaboration.submitTask({
        title: unit.title, problemStatement: topic.goal,
        confirmedIntent: `${proposal.content}\n\n本任务范围：${unit.scope}\n\n回退方案：${proposal.rollbackPlan}${selfUpgradeContext}`,
        constraints: [...proposal.exclusions.map((item) => `不涉及：${item}`), ...proposal.risks.map((item) => `风险：${item}`)],
        acceptanceCriteria: unit.acceptanceCriteria, workspaceState: topic.workspaceState, locale: topic.locale,
        mergeStrategy: index === 0 ? "INDEPENDENT" : "DEPENDENCY_CHAIN", dependencyTaskIds: index === 0 ? [] : [distributedTaskIds[index - 1]],
        initiatorMemberId: proposal.submitterMemberId,
        preferredExecutorMemberId: proposal.purpose === "self-capability-upgrade" && targetMember?.kind === "worker" ? targetMember.memberId : proposal.origin === "linghu" ? "linghu-ancestor" : undefined,
        evolutionProposalId: proposal.proposalId,
        selfUpgradeTargetMemberId: proposal.targetMemberId || undefined,
        selfUpgradeCapabilityScope: proposal.capabilityScope || undefined,
        sourceEvolutionApprovalId: latestApproval?.approvalId,
      });
      const taskId = next.tasks.find((task) => task.evolutionProposalId === proposal.proposalId && !distributedTaskIds.includes(task.taskId))?.taskId;
      if (!taskId) throw new Error("协同任务已经创建，但未能建立提案关联。");
      distributedTaskIds.push(taskId);
      this.#recordEvent(`${proposal.origin}.evolution.proposal_distributed`, { proposalId, topicId: topic.topicId, unit: unit.title, index }, taskId);
      result = this.#store.markDispatched(proposalId, taskId);
    }
    return result;
  }

  async #tick(): Promise<void> {
    if (this.#running) return;
    this.#running = true;
    try {
      let state = this.state();
      if (state.automaticEvolutionEnabled) {
        for (const proposal of state.proposals.filter((item) => ["supplement-required", "rejected"].includes(item.status))) {
          if (state.proposals.some((item) => item.supersedesProposalId === proposal.proposalId)) continue;
          if (!proposal.approvals.at(-1)?.advice.trim()) continue;
          state = this.reviseReturnedProposalAutomatically(proposal.proposalId);
        }
      }
      for (const proposal of state.proposals.filter((item) => item.distributedTaskIds.length && ["executing", "verifying"].includes(item.status))) {
        const tasks = this.#collaboration.state().tasks.filter((task) => proposal.distributedTaskIds.includes(task.taskId));
        if (tasks.length !== proposal.distributedTaskIds.length) continue;
        const blocked = tasks.some((task) => ["blocked", "cancelled", "test-failed"].includes(task.state));
        const completed = tasks.every((task) => task.state === "integrated");
        const verifying = tasks.some((task) => ["ready-for-integration", "queued-integration", "integrating", "unified-testing"].includes(task.state));
        const status = blocked ? "blocked" : completed ? "completed" : verifying ? "verifying" : "executing";
        if (proposal.status !== status) state = this.#store.markProgress(proposal.proposalId, status, completed ? "全部关联任务通过统一测试，原演化目标已完成。" : blocked ? "至少一个关联任务阻塞，等待恢复条件。" : "关联任务正在执行或验证。" );
      }
      for (const proposal of state.proposals.filter((item) => item.status === "pending-approval")) {
        const enabled = proposal.origin === "nangong" ? state.automaticNangongApprovalEnabled : state.automaticLinghuApprovalEnabled;
        if (enabled) state = this.autoApprove(proposal.proposalId);
      }
      for (const proposal of state.proposals.filter((item) => item.status === "approved" && item.distributedTaskIds.length === 0)) {
        if (proposal.origin === "linghu" || state.automaticExecutionEnabled) state = this.dispatch(proposal.proposalId);
      }
      if (!state.automaticEvolutionEnabled) return;
      const topic = state.topics.find((item) => ["registered", "investigating", "supplement-required"].includes(item.status));
      if (!topic || state.proposals.some((item) => item.topicId === topic.topicId && item.status === "pending-approval")) return;
      const content = `课题：${topic.title}\n\n目标：${topic.goal}\n\n调查事实：\n${topic.evidence.map((item) => `- ${item}`).join("\n")}\n\n推荐方向：在已登记范围内实施，并保持排除项不变。`;
      let next = this.createProposal(topic.topicId, { type: "代码修正", content, risks: ["实施结果可能与既有调用方产生兼容影响"], rollbackPlan: "保留提案版本和关联任务，失败时撤销任务分支且不覆盖历史提案。" });
      const proposal = next.proposals.at(-1)!;
      if (next.automaticNangongApprovalEnabled) next = this.autoApprove(proposal.proposalId);
      const decided = requireProposal(next, proposal.proposalId);
      if (next.automaticExecutionEnabled && decided.status === "approved") this.dispatch(proposal.proposalId);
    } finally { this.#running = false; }
  }
}

function requireProposal(state: NangongEvolutionState, proposalId: string): EvolutionProposal { const proposal = state.proposals.find((item) => item.proposalId === proposalId); if (!proposal) throw new Error("演化提案不存在。"); return proposal; }
