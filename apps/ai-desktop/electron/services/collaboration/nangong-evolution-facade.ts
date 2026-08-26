import { randomUUID } from "node:crypto";

import type { CollaborationMemoryPort, ConversationRoundTopicDecision } from "../../../contracts/collaboration-memory.js";
import type { ConfigureEvolutionAutomationRequest, ConvertNangongConversationToTopicRequest, CreateEvolutionProposalRequest, CreateEvolutionTopicRequest, CreateLinghuRepairProposalRequest, DecideEvolutionProposalRequest, DecideEvolutionResultRequest, EvolutionAutomationAction, EvolutionProposal, EvolutionSourceMessageSnapshot, EvolutionTopicDossier, GenerateNangongTopicDraftRequest, HanLiEvolutionDeliberation, HanLiTopicCandidate, NangongEvolutionState, NangongTopicDraft, ReviseEvolutionProposalRequest, SendNangongConversationMessageRequest, UpdateEvolutionTopicRequest } from "../../../contracts/nangong-evolution.js";
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
  hanLi?: {
    send(prompt: string, state: NangongEvolutionState): Promise<string>;
  };
  nangongDeliberation?: {
    send(question: string, context: string, state: NangongEvolutionState): Promise<string>;
  };
  recordEvent(type: string, details: Record<string, unknown>, taskId?: string): void;
  memory?: CollaborationMemoryPort | null;
  readDossier?: (topicId: string, state: NangongEvolutionState) => EvolutionTopicDossier;
  newConversationRetryDelaysMs?: number[];
}

/** 保持自动演化、自动审批和自动执行三道独立开关，并只在审批通过后调用协同分发。 */
export class NangongEvolutionFacade {
  readonly #store: NangongEvolutionStore;
  readonly #collaboration: CollaborationCoordinator;
  readonly #conversation: NangongEvolutionFacadeOptions["conversation"];
  readonly #hanLi: NonNullable<NangongEvolutionFacadeOptions["hanLi"]>;
  readonly #nangongDeliberation: NonNullable<NangongEvolutionFacadeOptions["nangongDeliberation"]>;
  readonly #recordEvent: NangongEvolutionFacadeOptions["recordEvent"];
  readonly #memory: CollaborationMemoryPort | null;
  readonly #readDossier: NangongEvolutionFacadeOptions["readDossier"];
  readonly #newConversationRetryDelaysMs: number[];
  #timer: ReturnType<typeof setInterval> | null = null;
  #running = false;

  constructor(options: NangongEvolutionFacadeOptions) { this.#store = options.store; this.#collaboration = options.collaboration; this.#conversation = options.conversation; this.#hanLi = options.hanLi || { send: async () => { throw new Error("韩立研讨会话尚未接入。 "); } }; this.#nangongDeliberation = options.nangongDeliberation || { send: async () => { throw new Error("南宫婉研讨会话尚未接入。 "); } }; this.#recordEvent = options.recordEvent; this.#memory = options.memory || null; this.#readDossier = options.readDossier; this.#newConversationRetryDelaysMs = options.newConversationRetryDelaysMs || [0, 500, 1_500, 3_000]; }
  state(): NangongEvolutionState { return this.#store.state(); }
  dossier(topicId: string): EvolutionTopicDossier {
    const state = this.state();
    if (this.#readDossier) return this.#readDossier(topicId, state);
    const topic = state.topics.find((item) => item.topicId === topicId);
    if (!topic) throw new Error("专题池中不存在该专题。 ");
    const deliberation = topic.deliberationId ? state.deliberations.find((item) => item.deliberationId === topic.deliberationId) || null : null;
    return { topic, deliberation, proposals: state.proposals.filter((item) => item.topicId === topicId), archiveRecords: state.archiveRecords.filter((item) => item.topicId === topicId || item.deliberationId === topic.deliberationId), executionRecords: [] };
  }
  subscribe(listener: Parameters<NangongEvolutionStore["subscribe"]>[0]) { return this.#store.subscribe(listener); }
  start(): void { if (!this.#timer) { void this.#tick(); this.#timer = setInterval(() => void this.#tick(), 30_000); } }
  stop(): void { if (this.#timer) clearInterval(this.#timer); this.#timer = null; }
  createTopic(request: CreateEvolutionTopicRequest): NangongEvolutionState { return this.#store.createTopic(request); }
  setAutomation(kind: "evolution" | "nangong-approval" | "linghu-approval" | "execution", enabled: boolean): NangongEvolutionState { return this.#store.setAutomation(kind, enabled); }
  configureAutomation(request: ConfigureEvolutionAutomationRequest): NangongEvolutionState { return this.#store.configureAutomation(request); }
  controlAutomation(action: EvolutionAutomationAction): NangongEvolutionState { return this.#store.controlAutomation(action); }
  async sendConversationMessage(request: SendNangongConversationMessageRequest): Promise<NangongEvolutionState> {
    let state = this.#store.appendConversation("user", request.message, request.attachmentIds || []);
    const userMessage = state.conversation.messages.at(-1)!;
    const context = this.#memory?.buildNangongContext(state.conversation)
      || state.conversation.messages.slice(-12).map((item) => `${item.role === "user" ? "用户" : "南宫婉"}：${item.content}`).join("\n\n");
    const response = await this.#conversation.send(request, context);
    const parsed = parseConversationResponse(response.text);
    state = this.#store.appendConversation("nangong", parsed.reply);
    state = this.#store.recordConversationIntent(userMessage.messageId, parsed.topic.userIntent);
    const nangongMessage = state.conversation.messages.at(-1)!;
    this.#memory?.registerRound(state.conversation, userMessage.messageId, nangongMessage.messageId, parsed.topic);
    this.#recordEvent("nangong.evolution.conversation_replied", {
      conversationId: state.conversation.conversationId,
      messageCount: state.conversation.messages.length,
      conversationTopicTitle: parsed.topic.title,
      conversationTopicType: parsed.topic.type,
      switchedTopic: parsed.topic.switchTopic,
    });
    return state;
  }
  async newConversation(): Promise<NangongEvolutionState> {
    for (const [index, retryDelay] of this.#newConversationRetryDelaysMs.entries()) {
      if (retryDelay) await new Promise((resolve) => setTimeout(resolve, retryDelay));
      try {
        await this.#conversation.newChat();
        return this.#store.newConversation();
      } catch (error) {
        // Codex 取消当前回合后可能短暂保留写入租约；只对该明确竞争做有限等待，其他删除错误立即回显。
        if (!String(error).toLowerCase().includes("active writer") || index === this.#newConversationRetryDelaysMs.length - 1) throw error;
      }
    }
    throw new Error("无法重新建立南宫婉对话。");
  }
  async generateTopicDraft(request: GenerateNangongTopicDraftRequest): Promise<NangongTopicDraft> {
    const messages = this.state().conversation.messages.slice(-20);
    if (!messages.length) throw new Error("当前没有可整理为课题的南宫婉对话。");
    const context = this.#memory?.buildNangongContext(this.state().conversation)
      || messages.map((item) => `${item.role === "user" ? "用户" : "南宫婉"}：${item.content}`).join("\n\n");
    // 草稿仅供用户编辑，不写入对话或课题持久化状态，避免绕过显式保存确认。
    const response = await this.#conversation.send({
      message: "请根据上述对话生成课题草稿。仅返回 JSON：{\"title\":\"\",\"goal\":\"\",\"scope\":[\"\"],\"evidence\":[\"\"],\"acceptanceCriteria\":[\"\"]}。事实证据必须说明来自用户陈述或南宫婉调查，不要把推断写成已证实事实；每个数组至少一项。",
      workspaceState: request.workspaceState,
      locale: request.locale,
    }, context);
    return parseTopicDraft(response.text);
  }
  convertConversationToTopic(request: ConvertNangongConversationToTopicRequest): NangongEvolutionState { return this.#store.convertConversationToTopic(request); }
  createProposal(topicId: string, request: CreateEvolutionProposalRequest): NangongEvolutionState { return this.#store.createProposal(topicId, request); }
  updateTopic(topicId: string, request: UpdateEvolutionTopicRequest): NangongEvolutionState { return this.#store.updateTopic(topicId, request); }
  createLinghuRepairProposal(request: CreateLinghuRepairProposalRequest): NangongEvolutionState { return this.#store.createLinghuRepairProposal(request); }
  decideProposal(proposalId: string, request: DecideEvolutionProposalRequest): NangongEvolutionState {
    return this.#store.decide(proposalId, request.decision, request.advice || "", "manual-user", [], request.feedbackTarget || "proposal-content", request.capabilityScope || "");
  }
  decideResult(proposalId: string, request: DecideEvolutionResultRequest): NangongEvolutionState {
    return this.#store.decideResult(proposalId, request.decision, request.advice || "");
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
    const databaseHistory = this.#memory?.approvalEvidence(proposal.type, proposal.origin) || [];
    if (!manualHistory.length && !databaseHistory.length) return this.#store.decide(proposalId, "supplement-required", "没有同类型人工审批记录，不能以低置信度猜测通过。", "automatic-han-li", []);
    const latestState = manualHistory.at(-1);
    const latestDatabase = databaseHistory[0];
    const latest = latestState && (!latestDatabase || Date.parse(latestState.approval.createdAt) >= Date.parse(latestDatabase.approvedAt))
      ? { approvalId: latestState.approval.approvalId, decision: latestState.approval.decision, advice: latestState.approval.advice }
      : latestDatabase!;
    const decision = latest.decision === "approved" ? "approved" : latest.decision;
    const adviceContext = latest.advice.trim() ? `；历史建议：${latest.advice.trim().slice(0, 300)}` : "";
    return this.#store.decide(proposalId, decision, `参考同类型人工审批 ${latest.approvalId}，按用户历史关注点和审批习惯作出决定${adviceContext}。`, "automatic-han-li", [latest.approvalId]);
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

  /** 每次只推进一轮真实研讨，确保页面能看到韩立问题、南宫婉回答和韩立判断的原记录。 */
  async advanceHanLiDeliberation(): Promise<NangongEvolutionState> {
    let state = this.state();
    if (!state.automationContext.workspaceState?.roots?.length) throw new Error("请先为自动演化保存实施工作区。 ");
    let deliberation = [...state.deliberations].reverse().find((item) => ["questioning", "ready-to-establish"].includes(item.status));
    if (!deliberation) {
      if (!this.#memory) throw new Error("AI Memory 数据库不可用，韩立不能读取对话库。 ");
      const deliberationId = `han-li-deliberation-${randomUUID()}`;
      const snapshots = this.#memory.readHanLiEvolutionCorpus(deliberationId);
      const corpus = formatEvolutionCorpus(snapshots);
      const first = parseHanLiQuestion(await this.#hanLi.send([
        "你是韩立，是自动演化专题研讨的发问方和最终确立者。",
        "请综合下面按完整会话分组保存的南宫婉与 Codex 原始对话。现在不能直接生成专题，也不能替南宫婉拆任务。",
        "找出最值得进一步问清、又不能仅靠原记录下结论的一个问题。返回 JSON：{\"question\":\"向南宫婉提出的具体问题\",\"reason\":\"为什么必须先问清\"}。",
        corpus,
      ].join("\n\n"), state));
      state = this.#store.beginDeliberation(deliberationId, snapshots, first.question, first.reason);
      deliberation = state.deliberations.find((item) => item.deliberationId === deliberationId)!;
      this.#recordEvent("han-li.evolution.deliberation_started", { deliberationId, sourceMessageCount: snapshots.length, sourceConversationCount: new Set(snapshots.map((item) => `${item.source}:${item.conversationId}`)).size, question: first.question });
    }
    if (deliberation.status === "ready-to-establish") return this.#store.establishDeliberationTopic(deliberation.deliberationId);
    const round = deliberation.rounds.at(-1)!;
    const context = formatDeliberationContext(deliberation);
    if (!round.answer) {
      const answer = await this.#nangongDeliberation.send(round.question, context, state);
      state = this.#store.recordDeliberationAnswer(deliberation.deliberationId, round.roundId, answer);
      this.#recordEvent("nangong.evolution.deliberation_answered", { deliberationId: deliberation.deliberationId, roundId: round.roundId, roundNumber: round.roundNumber, question: round.question, answer });
    }
    const refreshed = state.deliberations.find((item) => item.deliberationId === deliberation!.deliberationId)!;
    const answeredRound = refreshed.rounds.find((item) => item.roundId === round.roundId)!;
    if (!answeredRound.assessment) {
      const maximum = state.automationSettings.maxRoundsPerTopic;
      const mustConclude = maximum !== null && answeredRound.roundNumber >= maximum;
      const judgment = parseHanLiJudgment(await this.#hanLi.send([
        "你是韩立。请根据对话库证据和本次与南宫婉的逐轮交流判断是否足以确立一个可实施、可验收的演进专项。",
        "不能按固定分数判断；必须指出事实、未确认内容和本轮回答对方向的影响。",
        mustConclude ? `当前已到配置的第 ${maximum} 轮。证据足够时确立专题；仍不足时返回继续追问，但必须明确唯一缺口。` : "证据不足就继续追问，不能为了自动化而提前确立专题。",
        "继续时返回 JSON：{\"decision\":\"continue\",\"assessment\":\"判断\",\"nextQuestion\":\"下一问\",\"questionReason\":\"下一问依据\"}。",
        "确立时返回 JSON：{\"decision\":\"establish-topic\",\"assessment\":\"判断\",\"topic\":{\"title\":\"\",\"goal\":\"\",\"scope\":[\"\"],\"exclusions\":[\"\"],\"evidence\":[\"\"],\"acceptanceCriteria\":[\"\"],\"establishmentReason\":\"\"}}。",
        formatDeliberationContext(refreshed),
      ].join("\n\n"), state));
      if (mustConclude && !judgment.candidate) {
        state = this.#store.blockDeliberation(refreshed.deliberationId, answeredRound.roundId, judgment.assessment, `韩立完成 ${maximum} 轮研讨后仍确认存在证据缺口：${judgment.nextQuestion?.reason || judgment.assessment}`);
        this.#recordEvent("han-li.evolution.deliberation_blocked", { deliberationId: refreshed.deliberationId, roundId: answeredRound.roundId, roundNumber: answeredRound.roundNumber, assessment: judgment.assessment, missingEvidence: judgment.nextQuestion?.reason || null });
        return state;
      }
      state = this.#store.assessDeliberation(refreshed.deliberationId, answeredRound.roundId, judgment.assessment, judgment.nextQuestion, judgment.candidate);
      this.#recordEvent("han-li.evolution.deliberation_assessed", { deliberationId: refreshed.deliberationId, roundId: answeredRound.roundId, roundNumber: answeredRound.roundNumber, decision: judgment.candidate ? "establish-topic" : "continue", assessment: judgment.assessment, nextQuestion: judgment.nextQuestion?.question || null });
    }
    const assessed = state.deliberations.find((item) => item.deliberationId === refreshed.deliberationId)!;
    if (assessed.status === "ready-to-establish") {
      state = this.#store.establishDeliberationTopic(assessed.deliberationId);
      this.#recordEvent("han-li.evolution.topic_established", { deliberationId: assessed.deliberationId, topicId: state.activeTopicId, candidate: assessed.candidate });
    }
    return state;
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
        const status = blocked ? "blocked" : completed ? "pending-acceptance" : verifying ? "verifying" : "executing";
        if (proposal.status !== status) state = this.#store.markProgress(proposal.proposalId, status, completed ? "全部关联任务已经完成，等待韩立按真实用户路径验收结果。" : blocked ? "至少一个关联任务阻塞，等待恢复条件。" : "关联任务正在执行或验证。" );
      }
      // 一个专题完成后重新进入韩立读库与发问流程；禁止复制旧专题标题伪造下一专题。
      for (const proposal of state.proposals.filter((item) => item.status === "pending-approval")) {
        const enabled = proposal.origin === "nangong" ? state.automaticNangongApprovalEnabled : state.automaticLinghuApprovalEnabled;
        if (enabled) state = this.autoApprove(proposal.proposalId);
      }
      for (const proposal of state.proposals.filter((item) => item.status === "approved" && item.distributedTaskIds.length === 0)) {
        if (proposal.origin === "linghu" || state.automaticExecutionEnabled) state = this.dispatch(proposal.proposalId);
      }
      if (!state.automaticEvolutionEnabled) return;
      const hasOpenTopicFlow = state.topics.some((item) => !["completed", "rejected"].includes(item.status));
      if (!hasOpenTopicFlow) state = await this.advanceHanLiDeliberation();
      const topic = state.topics.find((item) => ["registered", "investigating"].includes(item.status));
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

function parseTopicDraft(text: string): NangongTopicDraft {
  const candidate = text.match(/\{[\s\S]*\}/)?.[0];
  if (!candidate) throw new Error("南宫婉未返回可编辑的课题草稿，请重试。");
  try {
    const value = JSON.parse(candidate) as Partial<NangongTopicDraft>;
    const title = typeof value.title === "string" ? value.title.trim() : "";
    const goal = typeof value.goal === "string" ? value.goal.trim() : "";
    const scope = normalizeDraftList(value.scope);
    const evidence = normalizeDraftList(value.evidence);
    const acceptanceCriteria = normalizeDraftList(value.acceptanceCriteria);
    if (!title || !goal || !scope.length || !evidence.length || !acceptanceCriteria.length) throw new Error();
    return { title, goal, scope, evidence, acceptanceCriteria };
  } catch {
    throw new Error("南宫婉生成的课题草稿不完整，请重试。");
  }
}

const CONVERSATION_TOPIC_META_PREFIX = "NANGONG_TOPIC_META=";

/** 南宫婉正文保持自然语言；最后一行只提供机器可读主题坐标，解析失败也不丢失正文。 */
function parseConversationResponse(text: string): { reply: string; topic: ConversationRoundTopicDecision } {
  const lines = text.trim().split(/\r?\n/);
  let markerIndex = -1;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index].trim().startsWith(CONVERSATION_TOPIC_META_PREFIX)) { markerIndex = index; break; }
  }
  if (markerIndex < 0) return { reply: text.trim(), topic: { title: "待分类主题", type: "待分类", switchTopic: false, userIntent: "待确认用户意图" } };
  const marker = lines[markerIndex].trim().slice(CONVERSATION_TOPIC_META_PREFIX.length);
  try {
    const value = JSON.parse(marker) as Partial<ConversationRoundTopicDecision>;
    const title = typeof value.title === "string" ? value.title.trim().slice(0, 120) : "";
    const type = typeof value.type === "string" ? value.type.trim().slice(0, 120) : "";
    const userIntent = typeof value.userIntent === "string" ? value.userIntent.trim().slice(0, 2_000) : "";
    const reply = lines.filter((_line, index) => index !== markerIndex).join("\n").trim();
    if (!reply || !title || !type || !userIntent) throw new Error("incomplete conversation topic metadata");
    return { reply, topic: { title, type, switchTopic: value.switchTopic === true, userIntent } };
  } catch {
    return { reply: lines.filter((_line, index) => index !== markerIndex).join("\n").trim() || text.trim(), topic: { title: "待分类主题", type: "待分类", switchTopic: false, userIntent: "待确认用户意图" } };
  }
}

function normalizeDraftList(value: unknown): string[] { return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))].slice(0, 100) : []; }

function parseJsonObject(text: string): Record<string, unknown> {
  const candidate = text.match(/\{[\s\S]*\}/)?.[0];
  if (!candidate) throw new Error("韩立没有返回可解析的研讨判断。 ");
  try { return JSON.parse(candidate) as Record<string, unknown>; } catch { throw new Error("韩立返回的研讨判断不是有效 JSON。 "); }
}

function parseHanLiQuestion(text: string): { question: string; reason: string } {
  const value = parseJsonObject(text);
  const question = typeof value.question === "string" ? value.question.trim() : "";
  const reason = typeof value.reason === "string" ? value.reason.trim() : "";
  if (!question || !reason) throw new Error("韩立首轮问题缺少问题正文或发问依据。 ");
  return { question, reason };
}

function parseHanLiJudgment(text: string): { assessment: string; nextQuestion: { question: string; reason: string } | null; candidate: HanLiTopicCandidate | null } {
  const value = parseJsonObject(text);
  const assessment = typeof value.assessment === "string" ? value.assessment.trim() : "";
  if (!assessment) throw new Error("韩立研讨判断缺少事实说明。 ");
  if (value.decision === "establish-topic") {
    const topic = value.topic as Partial<HanLiTopicCandidate> | undefined;
    const candidate = topic && {
      title: typeof topic.title === "string" ? topic.title : "", goal: typeof topic.goal === "string" ? topic.goal : "",
      scope: normalizeDraftList(topic.scope), exclusions: normalizeDraftList(topic.exclusions), evidence: normalizeDraftList(topic.evidence),
      acceptanceCriteria: normalizeDraftList(topic.acceptanceCriteria), establishmentReason: typeof topic.establishmentReason === "string" ? topic.establishmentReason : assessment,
    };
    if (!candidate?.title || !candidate.goal || !candidate.scope.length || !candidate.evidence.length || !candidate.acceptanceCriteria.length) throw new Error("韩立确立的专题缺少范围、证据或验收条件。 ");
    return { assessment, nextQuestion: null, candidate };
  }
  const question = typeof value.nextQuestion === "string" ? value.nextQuestion.trim() : "";
  const reason = typeof value.questionReason === "string" ? value.questionReason.trim() : "";
  if (!question || !reason) throw new Error("韩立决定继续研讨，但没有给出下一问和依据。 ");
  return { assessment, nextQuestion: { question, reason }, candidate: null };
}

function formatEvolutionCorpus(snapshots: EvolutionSourceMessageSnapshot[]): string {
  const groups = new Map<string, EvolutionSourceMessageSnapshot[]>();
  for (const snapshot of snapshots) {
    const key = `${snapshot.source}:${snapshot.conversationId}`;
    groups.set(key, [...(groups.get(key) || []), snapshot]);
  }
  return [...groups.entries()].map(([key, messages]) => [
    `完整会话组 ${key}`,
    ...messages.sort((left, right) => left.sequenceNumber - right.sequenceNumber).map((item) => `[${item.originalCreatedAt}] ${item.role}${item.responsePhase ? `/${item.responsePhase}` : ""}：${item.content}`),
  ].join("\n")).join("\n\n---\n\n");
}

function formatDeliberationContext(deliberation: HanLiEvolutionDeliberation): string {
  return [
    `研讨编号：${deliberation.deliberationId}`,
    ...deliberation.rounds.map((round) => [
      `第 ${round.roundNumber} 轮韩立问题：${round.question}`,
      `发问依据：${round.questionReason}`,
      round.answer ? `南宫婉原回答：${round.answer}` : "南宫婉尚未回答",
      round.assessment ? `韩立判断：${round.assessment}` : "",
    ].filter(Boolean).join("\n")),
  ].join("\n\n");
}
