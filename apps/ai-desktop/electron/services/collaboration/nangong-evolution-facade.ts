import { randomUUID } from "node:crypto";

import type { CollaborationMemoryPort, ConversationRoundTopicDecision } from "../../../contracts/collaboration/collaboration-memory.js";
import type { ConfigureEvolutionAutomationRequest, ConvertNangongConversationToTopicRequest, CreateEvolutionProposalRequest, CreateEvolutionTopicRequest, CreateLinghuRepairProposalRequest, DecideEvolutionProposalRequest, DecideEvolutionResultRequest, EvolutionAutomationAction, EvolutionDistributionAudit, EvolutionDistributionPlan, EvolutionDistributionUnit, EvolutionMutationRequest, EvolutionProposal, EvolutionSourceMessageSnapshot, EvolutionTopicDossier, EvolutionWorkbenchPage, EvolutionWorkbenchPreference, GenerateNangongTopicDraftRequest, HanLiAcceptancePlan, HanLiAcceptanceRun, HanLiEvolutionDeliberation, HanLiTopicCandidate, NangongEvolutionState, NangongTopicDraft, QueryEvolutionWorkbenchRequest, ReviseEvolutionProposalRequest, SaveEvolutionWorkbenchPreferenceRequest, SendNangongConversationMessageRequest, UpdateEvolutionTopicRequest } from "../../../contracts/collaboration/nangong-evolution.js";
import type { SendMessageResponse } from "../../../contracts/codex/conversation.js";
import type { CollaborationCoordinator } from "./collaboration-coordinator.js";
import { EvolutionMutationCoordinator } from "./evolution-mutation-coordinator.js";
import { NangongEvolutionStore } from "./nangong-evolution-store.js";

/** 南宫婉语义判断成熟后必须在可见正文中使用该句，Store 据此建立可恢复的等待确认事实。 */
export const NANGONG_ONE_SHOT_INVITATION = "若确认启动本轮完整演化，请回复 1。";

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
  investigateRevision?: (prompt: string, workspaceState: NangongEvolutionState["topics"][number]["workspaceState"], locale: NangongEvolutionState["topics"][number]["locale"]) => Promise<string>;
  planDistribution?: (prompt: string, workspaceState: NangongEvolutionState["topics"][number]["workspaceState"], locale: NangongEvolutionState["topics"][number]["locale"]) => Promise<string>;
  auditDistribution?: (prompt: string, workspaceState: NangongEvolutionState["topics"][number]["workspaceState"], locale: NangongEvolutionState["topics"][number]["locale"]) => Promise<string>;
  planAcceptance?: (prompt: string, workspaceState: NangongEvolutionState["topics"][number]["workspaceState"], locale: NangongEvolutionState["topics"][number]["locale"]) => Promise<string>;
  recordEvent(type: string, details: Record<string, unknown>, taskId?: string): void;
  memory?: CollaborationMemoryPort | null;
  readDossier?: (topicId: string, state: NangongEvolutionState) => EvolutionTopicDossier;
  queryWorkbench?: (request: QueryEvolutionWorkbenchRequest) => EvolutionWorkbenchPage;
  getWorkbenchPreference?: (perspective: "nangong" | "hanli", nodeId: string) => EvolutionWorkbenchPreference | null;
  saveWorkbenchPreference?: (request: SaveEvolutionWorkbenchPreferenceRequest) => EvolutionWorkbenchPreference;
  beginMutation?: (topicId: string, action: string, request: EvolutionMutationRequest, currentStateVersion: string) => "started" | "completed";
  completeMutation?: (idempotencyKey: string, resultStateVersion: string) => void;
  failMutation?: (idempotencyKey: string, error: unknown) => void;
  newConversationRetryDelaysMs?: number[];
}

/** 保持自动演化、自动审批和自动执行三道独立开关，并只在审批通过后调用协同分发。 */
export class NangongEvolutionFacade {
  readonly #store: NangongEvolutionStore;
  readonly #collaboration: CollaborationCoordinator;
  readonly #conversation: NangongEvolutionFacadeOptions["conversation"];
  readonly #hanLi: NonNullable<NangongEvolutionFacadeOptions["hanLi"]>;
  readonly #nangongDeliberation: NonNullable<NangongEvolutionFacadeOptions["nangongDeliberation"]>;
  readonly #investigateRevision: NonNullable<NangongEvolutionFacadeOptions["investigateRevision"]>;
  readonly #planDistribution: NonNullable<NangongEvolutionFacadeOptions["planDistribution"]>;
  readonly #auditDistribution: NonNullable<NangongEvolutionFacadeOptions["auditDistribution"]>;
  readonly #planAcceptance: NonNullable<NangongEvolutionFacadeOptions["planAcceptance"]>;
  readonly #recordEvent: NangongEvolutionFacadeOptions["recordEvent"];
  readonly #memory: CollaborationMemoryPort | null;
  readonly #readDossier: NangongEvolutionFacadeOptions["readDossier"];
  readonly #queryWorkbench: NangongEvolutionFacadeOptions["queryWorkbench"];
  readonly #getWorkbenchPreference: NangongEvolutionFacadeOptions["getWorkbenchPreference"];
  readonly #saveWorkbenchPreference: NangongEvolutionFacadeOptions["saveWorkbenchPreference"];
  readonly #mutations: EvolutionMutationCoordinator;
  readonly #newConversationRetryDelaysMs: number[];
  #timer: ReturnType<typeof setInterval> | null = null;
  #running = false;
  #oneShotAcceptanceRunner: ((plan: HanLiAcceptancePlan) => Promise<HanLiAcceptanceRun>) | null = null;

  constructor(options: NangongEvolutionFacadeOptions) { this.#store = options.store; this.#collaboration = options.collaboration; this.#conversation = options.conversation; this.#hanLi = options.hanLi || { send: async () => { throw new Error("韩立研讨会话尚未接入。 "); } }; this.#nangongDeliberation = options.nangongDeliberation || { send: async () => { throw new Error("南宫婉研讨会话尚未接入。 "); } }; this.#investigateRevision = options.investigateRevision || (async () => { throw new Error("南宫婉返修调查能力尚未接入。"); }); this.#planDistribution = options.planDistribution || (async () => { throw new Error("南宫婉任务拆分调查尚未接入。"); }); this.#auditDistribution = options.auditDistribution || (async () => { throw new Error("令狐分发合理性审计尚未接入。"); }); this.#planAcceptance = options.planAcceptance || (async () => { throw new Error("韩立界面验收计划能力尚未接入。"); }); this.#recordEvent = options.recordEvent; this.#memory = options.memory || null; this.#readDossier = options.readDossier; this.#queryWorkbench = options.queryWorkbench; this.#getWorkbenchPreference = options.getWorkbenchPreference; this.#saveWorkbenchPreference = options.saveWorkbenchPreference; this.#mutations = new EvolutionMutationCoordinator({ begin: options.beginMutation, complete: options.completeMutation, fail: options.failMutation }); this.#newConversationRetryDelaysMs = options.newConversationRetryDelaysMs || [0, 500, 1_500, 3_000]; }
  state(): NangongEvolutionState { return this.#store.state(); }
  dossier(topicId: string): EvolutionTopicDossier {
    const state = this.state();
    if (this.#readDossier) return this.#readDossier(topicId, state);
    const topic = state.topics.find((item) => item.topicId === topicId);
    if (!topic) throw new Error("专题池中不存在该专题。 ");
    const deliberation = topic.deliberationId ? state.deliberations.find((item) => item.deliberationId === topic.deliberationId) || null : null;
    return { topic, deliberation, proposals: state.proposals.filter((item) => item.topicId === topicId), archiveRecords: state.archiveRecords.filter((item) => item.topicId === topicId || item.deliberationId === topic.deliberationId), executionRecords: [] };
  }
  queryWorkbench(request: QueryEvolutionWorkbenchRequest): EvolutionWorkbenchPage {
    if (!this.#queryWorkbench) throw new Error("专题演化数据库读模型不可用，请检查数据库初始化状态。");
    return this.#queryWorkbench(request);
  }
  getWorkbenchPreference(perspective: "nangong" | "hanli", nodeId: string): EvolutionWorkbenchPreference | null { return this.#getWorkbenchPreference?.(perspective, nodeId) || null; }
  saveWorkbenchPreference(request: SaveEvolutionWorkbenchPreferenceRequest): EvolutionWorkbenchPreference {
    if (!this.#saveWorkbenchPreference) throw new Error("专题演化视图偏好数据库不可用。");
    return this.#saveWorkbenchPreference(request);
  }
  subscribe(listener: Parameters<NangongEvolutionStore["subscribe"]>[0]) { return this.#store.subscribe(listener); }
  start(): void { if (!this.#timer) { void this.#tick(); this.#timer = setInterval(() => void this.#tick(), 30_000); } }
  stop(): void { if (this.#timer) clearInterval(this.#timer); this.#timer = null; }
  /** 主进程窗口层登记真实应用验收执行器；业务状态仍由本 Facade 和原结果审批接口推进。 */
  setOneShotAcceptanceRunner(runner: (plan: HanLiAcceptancePlan) => Promise<HanLiAcceptanceRun>): void { this.#oneShotAcceptanceRunner = runner; }
  /** 协作任务状态变化时立即核对一次性流程，避免等待固定轮询间隔。 */
  notifyWorkflowChanged(): void { void this.#tick(); }
  createTopic(request: CreateEvolutionTopicRequest): NangongEvolutionState { return this.#store.createTopic(request); }
  setAutomation(kind: "evolution" | "nangong-approval" | "linghu-approval" | "execution", enabled: boolean): NangongEvolutionState { return this.#store.setAutomation(kind, enabled); }
  configureAutomation(request: ConfigureEvolutionAutomationRequest): NangongEvolutionState { return this.#store.configureAutomation(request); }
  controlAutomation(action: EvolutionAutomationAction): NangongEvolutionState { return this.#store.controlAutomation(action); }
  async sendConversationMessage(request: SendNangongConversationMessageRequest): Promise<NangongEvolutionState> {
    const current = this.state();
    const confirmation = current.oneShotConfirmation;
    const ready = confirmation?.status === "awaiting-user-confirmation" && confirmation.conversationId === current.conversation.conversationId;
    if (request.message.trim() === "1") return this.#startOneShotFromConversation(request, ready);
    let state = this.#store.appendConversation("user", request.message, request.attachmentIds || []);
    const userMessage = state.conversation.messages.at(-1)!;
    const context = this.#memory?.buildNangongContext(state.conversation)
      || state.conversation.messages.slice(-12).map((item) => `${item.role === "user" ? "用户" : "南宫婉"}：${item.content}`).join("\n\n");
    const response = await this.#conversation.send(request, context);
    const parsed = parseConversationResponse(response.text);
    state = this.#store.appendConversation("nangong", parsed.reply);
    if (parsed.topic.userIntent) state = this.#store.recordConversationIntent(userMessage.messageId, parsed.topic.userIntent);
    const nangongMessage = state.conversation.messages.at(-1)!;
    state = this.#store.setOneShotConfirmation(!request.topicId && parsed.invitesOneShot ? nangongMessage.messageId : null);
    if (parsed.topic.userIntent) this.#memory?.registerRound(state.conversation, userMessage.messageId, nangongMessage.messageId, parsed.topic);
    if (request.topicId) state = this.#store.recordTopicConversation(request.topicId, userMessage.messageId, nangongMessage.messageId);
    this.#recordEvent("nangong.evolution.conversation_replied", {
      conversationId: state.conversation.conversationId,
      messageCount: state.conversation.messages.length,
      conversationTopicTitle: parsed.topic.title,
      conversationTopicType: parsed.topic.type,
      switchedTopic: parsed.topic.switchTopic,
      topicId: request.topicId || null,
    });
    return state;
  }

  /**
   * 作用：把南宫婉已经明确提出的一次确认转换为当前课题的单轮全流程托管。
   * 真实传参示例：界面已显示可恢复的“等待用户确认”状态，用户回复“1”后使用当前 SELPLAT 工作区开始整理课题。
   * 真实返回示例：返回已保存的课题和 oneShotRun；后续审批、分发、执行、测试与验收由原状态机继续。
   * 异常或副作用示例：没有南宫婉明确邀请时只保存解释回复；生成失败会持久化阻塞原因，不把已保存消息伪装成发送失败。
   */
  async #startOneShotFromConversation(request: SendNangongConversationMessageRequest, ready: boolean): Promise<NangongEvolutionState> {
    let state = this.#store.appendConversation("user", request.message, request.attachmentIds || []);
    const userMessage = state.conversation.messages.at(-1)!;
    if (!ready) return this.#store.appendConversation("nangong", "当前没有等待确认的一次性演化。请继续补充事实，或点击“整理为演化课题”检查内容；南宫婉明确显示本轮已可启动后，再回复 1。", []);
    state = this.#store.recordConversationIntent(userMessage.messageId, "确认将当前南宫婉调查对话整理为演化课题，并自动完成本轮既有审批、分发、测试与验收流程");
    state = this.#store.beginOneShotRun(request.workspaceState, request.locale);
    state = this.#store.appendConversation("nangong", "已确认启动本轮一次性演化。我正在整理课题；后续韩立审批、南宫婉分发、执行、令狐测试和韩立验收会沿现有流程连续推进，当前人物和动作会实时显示。", []);
    const confirmationMessage = state.conversation.messages.at(-1)!;
    try {
      const draft = await this.generateTopicDraft({ workspaceState: request.workspaceState, locale: request.locale });
      state = this.#store.convertConversationToTopic({ confirmedByUser: true, ...draft, workspaceState: request.workspaceState, locale: request.locale });
      const topicId = state.activeTopicId!;
      state = this.#store.updateOneShotRun("forming-proposal", "nangong-wan", "南宫婉", "正在根据已确认课题形成实施提案", topicId, null);
      state = this.#store.recordTopicConversation(topicId, userMessage.messageId, confirmationMessage.messageId);
      await this.#tick();
      return this.state();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      state = this.#store.blockOneShotRun(reason);
      return this.#store.appendConversation("nangong", `本轮一次性演化已保留当前进度，但遇到无法自动继续的阻塞：${reason}`, []);
    }
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
    const proposal = requireProposal(this.state(), proposalId);
    return this.#mutations.run(proposal.topicId, "人工审批", request.mutation, () => this.state().updatedAt, () => this.state(), () => this.#store.decide(proposalId, request.decision, request.advice || "", "manual-user", [], request.feedbackTarget || "proposal-content", request.capabilityScope || ""));
  }
  decideResult(proposalId: string, request: DecideEvolutionResultRequest): NangongEvolutionState {
    return this.#decideResult(proposalId, request, "manual-user");
  }

  #decideResult(proposalId: string, request: DecideEvolutionResultRequest, source: "manual-user" | "automatic-han-li"): NangongEvolutionState {
    const proposal = requireProposal(this.state(), proposalId);
    return this.#mutations.run(proposal.topicId, "结果验收", request.mutation, () => this.state().updatedAt, () => this.state(), () => this.#store.decideResult(proposalId, request.decision, request.advice || "", source));
  }

  /** 只让韩立根据当前专题语义生成检查计划；生成动作不会自动判定通过或改变审批线路。 */
  async generateAcceptancePlan(proposalId: string): Promise<HanLiAcceptancePlan> {
    const state = this.state();
    const proposal = requireProposal(state, proposalId);
    if (proposal.status !== "pending-acceptance") throw new Error("只有等待结果验收的提案才能生成韩立界面验收计划。 ");
    const topic = state.topics.find((item) => item.topicId === proposal.topicId);
    if (!topic) throw new Error("验收计划对应的专题不存在。 ");
    const priorFindings = state.archiveRecords.filter((item) => item.eventType === "acceptance.experience_promoted").slice(-10).map((item) => item.payload);
    const response = await this.#planAcceptance(acceptancePlanningPrompt(topic, proposal, priorFindings), topic.workspaceState, topic.locale);
    const plan = parseAcceptancePlan(response, topic.topicId, proposal.proposalId);
    this.#store.recordAcceptancePlan(plan);
    this.#recordEvent("hanli.acceptance.plan_generated", { topicId: topic.topicId, proposalId, planId: plan.planId, checkCount: plan.checks.length });
    return plan;
  }
  acceptancePlan(planId: string): HanLiAcceptancePlan {
    for (const record of [...this.state().archiveRecords].reverse()) {
      const value = record.eventType === "acceptance.plan_generated" ? record.payload.acceptancePlan : null;
      if (value && typeof value === "object" && (value as HanLiAcceptancePlan).planId === planId) return structuredClone(value as HanLiAcceptancePlan);
    }
    throw new Error("韩立验收计划不存在或已清理。 ");
  }
  recordAcceptanceRun(run: HanLiAcceptanceRun): NangongEvolutionState {
    const plan = this.acceptancePlan(run.planId);
    if (plan.topicId !== run.topicId || plan.proposalId !== run.proposalId) throw new Error("真实验收记录与计划关联不一致。 ");
    return this.#store.recordAcceptanceRun(run);
  }

  reviseProposal(proposalId: string, request: ReviseEvolutionProposalRequest): NangongEvolutionState {
    const proposal = requireProposal(this.state(), proposalId);
    const member = this.#collaboration.state().members.find((item) => item.memberId === request.submitterMemberId && item.enabled);
    if (!member) throw new Error("重新提交人不是当前已启用的协同人物。");
    return this.#mutations.run(proposal.topicId, "返修重提", request.mutation, () => this.state().updatedAt, () => this.state(), () => this.#store.revise(proposalId, request, member.displayName));
  }
  /** 驳回后先由南宫婉只读核查工作区；只有形成新的可验证事实才创建不可覆盖的新版本。 */
  async investigateAndReviseReturnedProposal(proposalId: string): Promise<NangongEvolutionState> {
    const state = this.state();
    const proposal = requireProposal(state, proposalId);
    if (state.proposals.some((item) => item.supersedesProposalId === proposal.proposalId)) return state;
    const feedback = proposal.approvals.at(-1);
    const topic = state.topics.find((item) => item.topicId === proposal.topicId);
    if (!feedback?.advice.trim() || !topic) throw new Error("返修调查缺少课题或明确审批意见。");
    const response = await this.#investigateRevision(revisionInvestigationPrompt(topic, proposal, feedback.advice, feedback.feedbackTarget, feedback.capabilityScope), topic.workspaceState, topic.locale);
    const investigation = parseRevisionInvestigation(response);
    if (!hasMaterialRevisionEvidence(proposal, investigation, feedback.advice)) {
      const reason = `南宫婉只读调查没有产生可核验的新事实，未创建提案 v${proposal.version + 1}；请补充实际组件、状态或复现证据后从当前卡点继续。`;
      this.#recordEvent("nangong.evolution.revision_no_material_evidence", { topicId: topic.topicId, proposalId, feedbackApprovalId: feedback.approvalId });
      return state.oneShotRun?.status === "running" ? this.#store.blockOneShotRun(reason) : this.state();
    }
    const revised = this.reviseProposal(proposal.proposalId, {
      mutation: { expectedStateVersion: state.updatedAt, idempotencyKey: `automatic-revise:${proposal.proposalId}:${state.updatedAt}` },
      submitterMemberId: proposal.submitterMemberId,
      content: investigation.content,
      evidence: investigation.evidence,
      impactScope: investigation.impactScope,
      exclusions: investigation.exclusions,
      risks: investigation.risks,
      rollbackPlan: investigation.rollbackPlan,
      acceptanceCriteria: investigation.acceptanceCriteria,
    });
    this.#recordEvent("member.evolution.proposal_revised_after_investigation", { proposalId: proposal.proposalId, submitterMemberId: proposal.submitterMemberId, feedbackApprovalId: feedback.approvalId, evidenceCount: investigation.evidence.length });
    return revised;
  }

  /** 从当前持久化卡点恢复同一轮；恢复后立即沿原状态机推进，不触碰长期自动开关。 */
  async resumeOneShotRun(): Promise<NangongEvolutionState> {
    this.#store.resumeOneShotRun();
    await this.#tick();
    return this.state();
  }

  autoApprove(proposalId: string, request?: EvolutionMutationRequest): NangongEvolutionState {
    const state = this.state();
    const proposal = requireProposal(state, proposalId);
    const mutation = request || { expectedStateVersion: state.updatedAt, idempotencyKey: `automatic-approve:${proposalId}:${state.updatedAt}` };
    return this.#mutations.run(proposal.topicId, "韩立审批", mutation, () => this.state().updatedAt, () => this.state(), () => this.#autoApproveOnce(proposalId));
  }

  #autoApproveOnce(proposalId: string): NangongEvolutionState {
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

  async dispatch(proposalId: string, request?: EvolutionMutationRequest): Promise<NangongEvolutionState> {
    const initialState = this.state();
    const initialProposal = requireProposal(initialState, proposalId);
    const mutation = request || { expectedStateVersion: initialState.updatedAt, idempotencyKey: `automatic-dispatch:${proposalId}:${initialState.updatedAt}` };
    return this.#mutations.runAsync(initialProposal.topicId, "返还南宫婉并分发", mutation, () => this.state().updatedAt, () => this.state(), () => this.#dispatchOnce(proposalId));
  }

  async #dispatchOnce(proposalId: string): Promise<NangongEvolutionState> {
    let state = this.state();
    let proposal = requireProposal(state, proposalId);
    const topic = state.topics.find((item) => item.topicId === proposal.topicId);
    if (!topic) throw new Error("当前提案关联的专题不存在，无法返还执行。");
    // 手动返还和自动分发都属于当前专题，必须使用专题冻结的工作区，不能误读可能尚未配置的自动演化上下文。
    const topicWorkspaceState = requireTopicWorkspaceState(topic);
    if (proposal.status !== "approved") throw new Error("只有审批通过并返还提交人的提案才能分发。");
    if (!proposal.distributionPlan || proposal.distributionPlan.audit.decision !== "passed") {
      let feedback = proposal.distributionPlan?.audit.findings.join("；") || "";
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        const planned = parseDistributionPlan(await this.#planDistribution(distributionPlanningPrompt(proposal, topic, feedback), topicWorkspaceState, topic.locale));
        const hardFindings = distributionHardFindings(planned.units);
        const audit = parseDistributionAudit(await this.#auditDistribution(distributionAuditPrompt(proposal, topic, planned, hardFindings), topicWorkspaceState, topic.locale), hardFindings);
        const plan: EvolutionDistributionPlan = { version: 1, summary: planned.summary, units: planned.units, audit, plannedAt: new Date().toISOString() };
        state = this.#store.saveDistributionPlan(proposalId, plan);
        proposal = requireProposal(state, proposalId);
        this.#recordEvent("nangong.evolution.distribution_planned", { proposalId, attempt, unitCount: plan.units.length, expectedFiles: plan.units.flatMap((unit) => unit.expectedFiles), auditDecision: audit.decision, auditFindings: audit.findings });
        this.#recordEvent("linghu.distribution_audit.completed", { proposalId, attempt, decision: audit.decision, reason: audit.reason, findings: audit.findings });
        if (audit.decision === "passed") break;
        feedback = [audit.reason, ...audit.findings].filter(Boolean).join("；");
      }
    }
    proposal = requireProposal(this.state(), proposalId);
    if (!proposal.distributionPlan || proposal.distributionPlan.audit.decision !== "passed") throw new Error("令狐确认当前任务拆分仍存在重叠，已阻止分发并退回南宫婉重新规划。");
    let result = state;
    const distributedTaskIds = [...proposal.distributedTaskIds];
    const latestApproval = proposal.approvals.at(-1);
    const revisionFeedback = proposal.revisionFeedbackApprovalId
      ? state.proposals.flatMap((item) => item.approvals).find((approval) => approval.approvalId === proposal.revisionFeedbackApprovalId)
      : null;
    const targetMember = proposal.targetMemberId ? this.#collaboration.state().members.find((member) => member.memberId === proposal.targetMemberId) : null;
    const existingTaskTitles = new Set((this.#collaboration.state?.().tasks || []).filter((task) => task.evolutionProposalId === proposal.proposalId).map((task) => task.snapshot.title));
    for (const [index, unit] of proposal.distributionPlan.units.entries()) {
      // 失败重试从已持久化的任务关联继续，已创建的任务单元不得再次分发。
      if (existingTaskTitles.has(unit.title)) continue;
      const selfUpgradeContext = proposal.purpose === "self-capability-upgrade"
        ? `\n\n自身能力升级目标：${proposal.targetMemberDisplayName}（${proposal.targetMemberId}）\n能力范围：${proposal.capabilityScope}\n原人工反馈：${revisionFeedback?.advice || "—"}\n必须修改该人物自身使用的规则、提示、工作流或实现，并用回归测试证明以后同类提交会更具体。`
        : "";
      const next = this.#collaboration.submitTask({
        title: unit.title, problemStatement: topic.goal,
        confirmedIntent: `${proposal.content}\n\n本任务范围：${unit.scope}\n\n回退方案：${proposal.rollbackPlan}${selfUpgradeContext}`,
        constraints: [...proposal.exclusions.map((item) => `不涉及：${item}`), ...proposal.risks.map((item) => `风险：${item}`)],
        acceptanceCriteria: unit.acceptanceCriteria, workspaceState: topicWorkspaceState, locale: topic.locale,
        mergeStrategy: "ATOMIC_GROUP", atomicGroupId: proposal.proposalId, dependencyTaskIds: [],
        initiatorMemberId: proposal.submitterMemberId,
        preferredExecutorMemberId: proposal.purpose === "self-capability-upgrade" && targetMember?.kind === "worker" ? targetMember.memberId : proposal.origin === "linghu" ? "linghu-ancestor" : undefined,
        evolutionProposalId: proposal.proposalId,
        evolutionRoundId: proposal.proposalId,
        selfUpgradeTargetMemberId: proposal.targetMemberId || undefined,
        selfUpgradeCapabilityScope: proposal.capabilityScope || undefined,
        sourceEvolutionApprovalId: latestApproval?.approvalId,
      });
      const taskId = next.tasks.find((task) => task.evolutionProposalId === proposal.proposalId && !distributedTaskIds.includes(task.taskId))?.taskId;
      if (!taskId) throw new Error("协同任务已经创建，但未能建立提案关联。");
      distributedTaskIds.push(taskId);
      existingTaskTitles.add(unit.title);
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
        "取材优先级：近期 Codex 用户原话与南宫婉会话是主要事实；Codex 最终答复短预览只用于理解执行结果；你自己的既有问答和判断不是主要训练来源。越早期的记录成熟度越低，只用于观察演变，不能覆盖近期明确要求。",
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

  /** 一次性托管只调度现有动作；每次推进到需要等待真实任务状态的位置即返回。 */
  async #advanceOneShot(): Promise<NangongEvolutionState> {
    const transitionLimit = Math.max(12, this.state().automationSettings.maxCorrectionRounds * 3 + 8);
    for (let transition = 0; transition < transitionLimit; transition += 1) {
      let state = this.state();
      const run = state.oneShotRun;
      if (!run || run.status !== "running" || !run.topicId) return state;
      const topic = state.topics.find((item) => item.topicId === run.topicId);
      if (!topic) return this.#store.blockOneShotRun("一次性运行关联的演化课题不存在。");
      const proposals = state.proposals.filter((item) => item.topicId === topic.topicId).sort((left, right) => left.version - right.version);
      let proposal = proposals.at(-1) || null;

      if (!proposal) {
        state = this.#store.updateOneShotRun("forming-proposal", "nangong-wan", "南宫婉", "正在根据课题事实形成实施提案", topic.topicId, null);
        const content = `课题：${topic.title}\n\n目标：${topic.goal}\n\n调查事实：\n${topic.evidence.map((item) => `- ${item}`).join("\n")}\n\n推荐方向：在已登记范围内实施，并保持排除项不变。`;
        state = this.createProposal(topic.topicId, { type: "代码修正", content, risks: ["实施可能影响既有调用方，必须通过原测试和验收门禁确认"], rollbackPlan: "保留课题、提案、任务和版本记录；失败时沿原恢复点返修，不覆盖已完成事实。" });
        proposal = state.proposals.at(-1)!;
        this.#store.updateOneShotRun("approving", "han-li", "韩立", "正在审批南宫婉提交的演化方向", topic.topicId, proposal.proposalId);
        continue;
      }

      if (proposal.status === "pending-approval") {
        this.#store.updateOneShotRun("approving", "han-li", "韩立", `正在审批提案 v${proposal.version}`, topic.topicId, proposal.proposalId);
        const decision = await this.#reviewOneShotProposal(proposal);
        this.#store.decide(proposal.proposalId, decision.decision, decision.advice, "automatic-han-li", []);
        continue;
      }

      if (["supplement-required", "rejected"].includes(proposal.status)) {
        const correctionRounds = proposals.filter((item) => item.supersedesProposalId !== null).length;
        if (correctionRounds >= state.automationSettings.maxCorrectionRounds) return this.#store.blockOneShotRun(`提案返修已经达到 ${state.automationSettings.maxCorrectionRounds} 轮，韩立仍未确认方向可执行。`);
        this.#store.updateOneShotRun("revising", "nangong-wan", "南宫婉", `正在按韩立退回项重新调查提案 v${proposal.version}`, topic.topicId, proposal.proposalId);
        try { await this.investigateAndReviseReturnedProposal(proposal.proposalId); }
        catch (error) { return this.#store.blockOneShotRun(`南宫婉重新调查失败：${error instanceof Error ? error.message : String(error)}`); }
        continue;
      }

      if (proposal.status === "approved" && proposal.distributedTaskIds.length === 0) {
        this.#store.updateOneShotRun("distributing", "nangong-wan", "南宫婉", "审批已通过，正在拆分并分发任务", topic.topicId, proposal.proposalId);
        await this.dispatch(proposal.proposalId);
        continue;
      }

      if (["executing", "verifying", "blocked"].includes(proposal.status)) {
        const tasks = this.#collaboration.state().tasks.filter((task) => proposal!.distributedTaskIds.includes(task.taskId));
        if (proposal.status === "blocked") {
          this.#store.updateOneShotRun("testing", "linghu-ancestor", "令狐老祖", "检测到执行或测试失败，正在按原恢复线路修正并继续", topic.topicId, proposal.proposalId);
          for (const task of tasks.filter((item) => ["blocked", "test-failed", "review-failed"].includes(item.state))) await this.#collaboration.recoverTask(task.taskId, itemFailureReason(task));
          return this.state();
        }
        const testing = proposal.status === "verifying" || tasks.some((item) => item.unifiedTest?.status === "running" || ["unified-testing", "integrating", "queued-integration"].includes(item.state));
        const activeTask = tasks.find((item) => !["integrated", "cancelled"].includes(item.state)) || tasks.at(-1);
        const actorName = testing ? "令狐老祖" : activeTask?.currentHandler?.displayName || activeTask?.originalExecutor?.displayName || "执行成员";
        this.#store.updateOneShotRun(testing ? "testing" : "executing", testing ? "linghu-ancestor" : "codex", actorName, testing ? "正在执行统一测试、集成和恢复门禁" : `正在执行：${activeTask?.snapshot.title || proposal.title}`, topic.topicId, proposal.proposalId);
        return this.state();
      }

      if (proposal.status === "pending-acceptance") {
        this.#store.updateOneShotRun("accepting", "han-li", "韩立", "正在生成检查计划并验收真实应用界面", topic.topicId, proposal.proposalId);
        if (!this.#oneShotAcceptanceRunner) return this.#store.blockOneShotRun("韩立真实应用验收执行器尚未接入。");
        const existingPlan = [...state.archiveRecords].reverse().find((record) => record.proposalId === proposal!.proposalId && record.eventType === "acceptance.plan_generated")?.payload.acceptancePlan as HanLiAcceptancePlan | undefined;
        const plan = existingPlan || await this.generateAcceptancePlan(proposal.proposalId);
        const runResult = await this.#oneShotAcceptanceRunner(plan);
        this.recordAcceptanceRun(runResult);
        state = this.state();
        this.#decideResult(proposal.proposalId, {
          mutation: { expectedStateVersion: state.updatedAt, idempotencyKey: `one-shot-result:${run.runId}:${proposal.proposalId}:${runResult.runId}` },
          decision: runResult.status === "passed" ? "approved" : "supplement-required",
          advice: runResult.status === "passed" ? "韩立已按真实用户路径完成检查，全部适用项目通过。" : "真实应用检查未通过，已携带复现步骤、实际结果、期望结果和截图证据返还南宫婉修订。",
        }, "automatic-han-li");
        continue;
      }

      if (proposal.status === "completed" || topic.status === "completed") {
        state = this.#store.finishOneShotRun();
        return this.#store.appendConversation("nangong", `本轮演化已经完整完成：课题“${topic.title}”已通过韩立审批、任务执行、令狐统一测试和韩立真实界面验收，全部记录已归档到专题工作台。`, []);
      }
      return state;
    }
    return this.#store.blockOneShotRun("一次性流程在单次推进中出现过多连续状态变化，已保留恢复点等待检查。");
  }

  /** 韩立在一次性运行中仍形成正式方向审批记录，不读取长期自动开关，也不跳过事实审查。 */
  async #reviewOneShotProposal(proposal: EvolutionProposal): Promise<{ decision: "approved" | "rejected" | "supplement-required"; advice: string }> {
    const state = this.state();
    const response = await this.#hanLi.send([
      "你是韩立，正在执行现有演化方向审批。用户只授权这一轮连续托管，没有授权跳过审批。",
      "请审查事实证据、影响范围、排除项、风险、回退方案和验收条件。材料足够且方向可执行时通过；缺少事实时退回补充；方向明显不成立时驳回。",
      "仅返回 JSON：{\"decision\":\"approved|supplement-required|rejected\",\"advice\":\"具体审批依据或需要补充的内容\"}。",
      JSON.stringify({ proposal, topic: state.topics.find((item) => item.topicId === proposal.topicId) }),
    ].join("\n\n"), state);
    return parseOneShotApproval(response);
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
          state = await this.investigateAndReviseReturnedProposal(proposal.proposalId);
        }
      }
      for (const proposal of state.proposals.filter((item) => item.distributedTaskIds.length && ["executing", "verifying"].includes(item.status))) {
        let tasks = this.#collaboration.state().tasks.filter((task) => proposal.distributedTaskIds.includes(task.taskId));
        if (tasks.length !== proposal.distributedTaskIds.length) continue;
        const blocked = tasks.some((task) => ["blocked", "cancelled", "test-failed"].includes(task.state));
        const allReturned = tasks.every((task) => task.state === "returned-to-nangong");
        if (!blocked && allReturned) {
          this.#collaboration.sealEvolutionRound(proposal.proposalId, proposal.distributedTaskIds);
          tasks = this.#collaboration.state().tasks.filter((task) => proposal.distributedTaskIds.includes(task.taskId));
        }
        const completed = tasks.every((task) => task.state === "integrated");
        const verifying = tasks.some((task) => ["returned-to-nangong", "ready-for-integration", "queued-integration", "integrating", "unified-testing", "awaiting-restart"].includes(task.state));
        const status = blocked ? "blocked" : completed ? "pending-acceptance" : verifying ? "verifying" : "executing";
        if (proposal.status !== status) state = this.#store.markProgress(proposal.proposalId, status, completed ? "全部关联任务已经完成，等待韩立按真实用户路径验收结果。" : blocked ? "至少一个关联任务阻塞，等待恢复条件。" : "关联任务正在执行或验证。" );
      }
      if (state.oneShotRun?.status === "running") {
        await this.#advanceOneShot();
        return;
      }
      // 一个专题完成后重新进入韩立读库与发问流程；禁止复制旧专题标题伪造下一专题。
      for (const proposal of state.proposals.filter((item) => item.status === "pending-approval")) {
        const enabled = proposal.origin === "nangong" ? state.automaticNangongApprovalEnabled : state.automaticLinghuApprovalEnabled;
        if (enabled) state = this.autoApprove(proposal.proposalId);
      }
      for (const proposal of state.proposals.filter((item) => item.status === "approved" && item.distributedTaskIds.length === 0)) {
        if (proposal.origin === "linghu" || state.automaticExecutionEnabled) state = await this.dispatch(proposal.proposalId);
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
      if (next.automaticExecutionEnabled && decided.status === "approved") await this.dispatch(proposal.proposalId);
    } finally { this.#running = false; }
  }
}

function requireProposal(state: NangongEvolutionState, proposalId: string): EvolutionProposal { const proposal = state.proposals.find((item) => item.proposalId === proposalId); if (!proposal) throw new Error("演化提案不存在。"); return proposal; }

/** 旧状态或损坏数据缺少专题工作区时返回可理解的业务错误，禁止把 null 继续传给 Codex 后读取 roots。 */
function requireTopicWorkspaceState(topic: NangongEvolutionState["topics"][number]): NangongEvolutionState["topics"][number]["workspaceState"] {
  if (!topic.workspaceState?.roots?.length) throw new Error("当前专题缺少可用的实施工作区，无法返还执行；请重新登记专题工作区后再试。");
  return topic.workspaceState;
}

function distributionPlanningPrompt(proposal: EvolutionProposal, topic: NangongEvolutionState["topics"][number], feedback: string): string {
  return [
    "你是南宫婉，负责在真实工程中调查后形成最小、可独立合并的执行任务。现在只读调查，不修改源码。",
    "影响范围只是调查边界，不等于任务数量。单个按钮、单个页面、同一组件、预计修改文件重叠或必须一起验收的内容必须合并为一个任务。约束、风险、保持功能不变和测试要求不能单独成为任务。只有可以独立修改、独立回退、独立验收且预计文件不重叠时才允许并行。",
    "请读取工作区相关实现，列出预计修改文件。返回 JSON：{\"summary\":\"为什么采用这个任务数量\",\"units\":[{\"title\":\"任务标题\",\"scope\":\"完整职责边界\",\"acceptanceCriteria\":[\"独立验收条件\"],\"expectedFiles\":[\"工程相对路径\"],\"independentReason\":\"为什么能独立执行；只有一个任务时说明为什么不拆分\"}]}。不要返回 Markdown。",
    `课题：${topic.title}\n目标：${topic.goal}`,
    `提案：${proposal.content}`,
    `影响范围：${proposal.impactScope.join("；")}`,
    `验收条件：${proposal.acceptanceCriteria.join("；")}`,
    `排除范围：${proposal.exclusions.join("；") || "无"}`,
    feedback ? `令狐上一轮审计意见：${feedback}` : "这是首次拆分。",
  ].join("\n\n");
}

function distributionAuditPrompt(
  proposal: EvolutionProposal,
  topic: NangongEvolutionState["topics"][number],
  plan: Pick<EvolutionDistributionPlan, "summary" | "units">,
  hardFindings: string[],
): string {
  return [
    "你是令狐老祖，只负责分发合理性与合并安全审计，不审批演化方向。请依据事实判断，不使用固定评分。",
    "检查每个任务是否可独立修改、独立回退、独立验收，是否把约束伪装成任务，是否语义重复，预计文件是否重叠，以及并行收益是否确实高于协作与合并成本。小型同域改动应由一个人完成。",
    "返回 JSON：{\"decision\":\"passed 或 revise\",\"reason\":\"结论依据\",\"findings\":[\"需要南宫婉修正的具体事实\"]}。不要返回 Markdown。",
    `课题：${topic.title}\n目标：${topic.goal}\n提案：${proposal.content}`,
    `南宫婉拆分：${JSON.stringify(plan)}`,
    `程序核对到的确定事实：${hardFindings.length ? hardFindings.join("；") : "未发现确定性冲突"}`,
  ].join("\n\n");
}

interface RevisionInvestigation {
  content: string;
  evidence: string[];
  impactScope: string[];
  exclusions: string[];
  risks: string[];
  rollbackPlan: string;
  acceptanceCriteria: string[];
}

function revisionInvestigationPrompt(topic: NangongEvolutionState["topics"][number], proposal: EvolutionProposal, advice: string, feedbackTarget: string, capabilityScope: string | null): string {
  return [
    "你是南宫婉。韩立已经退回当前提案；先只读检查实际工作区，再决定是否存在足以重新提交的新事实。不得修改文件、启动构建或把审批意见改写成事实。",
    "重点核对韩立指出的实际组件、选择器或文件位置，当前可用、悬停、忙碌或禁用状态，明确影响范围与排除项，具体风险与回退边界，以及能在真实应用中观察的验收条件。",
    "只写亲自从源码、配置或可重复读取结果中核实的内容；每条 evidence 必须带可定位对象和观察结果。若没有新事实，evidence 返回空数组，程序不会创建新版本。",
    `反馈目标：${feedbackTarget}${capabilityScope ? `；能力范围：${capabilityScope}` : ""}`,
    `韩立退回意见：${advice}`,
    `课题：${JSON.stringify({ title: topic.title, goal: topic.goal, scope: topic.scope, exclusions: topic.exclusions, evidence: topic.evidence, acceptanceCriteria: topic.acceptanceCriteria })}`,
    `当前提案：${JSON.stringify({ version: proposal.version, content: proposal.content, evidence: proposal.evidence, impactScope: proposal.impactScope, exclusions: proposal.exclusions, risks: proposal.risks, rollbackPlan: proposal.rollbackPlan, acceptanceCriteria: proposal.acceptanceCriteria })}`,
    "仅返回 JSON：{\"content\":\"基于本次实查形成的完整修订方案\",\"evidence\":[\"文件/组件/状态 + 实际观察\"],\"impactScope\":[\"明确影响范围\"],\"exclusions\":[\"明确不改内容\"],\"risks\":[\"具体风险和缓解方式\"],\"rollbackPlan\":\"限定到本次改动的回退方案\",\"acceptanceCriteria\":[\"可在真实应用观察的结果\"]}。不要返回 Markdown。",
  ].join("\n\n");
}

function parseRevisionInvestigation(text: string): RevisionInvestigation {
  const value = parseJsonObject(text);
  const content = typeof value.content === "string" ? value.content.trim().slice(0, 30_000) : "";
  const evidence = normalizeDraftList(value.evidence);
  const impactScope = normalizeDraftList(value.impactScope);
  const exclusions = normalizeDraftList(value.exclusions);
  const risks = normalizeDraftList(value.risks);
  const rollbackPlan = typeof value.rollbackPlan === "string" ? value.rollbackPlan.trim().slice(0, 8_000) : "";
  const acceptanceCriteria = normalizeDraftList(value.acceptanceCriteria);
  if (!content || !impactScope.length || !risks.length || !rollbackPlan || !acceptanceCriteria.length) throw new Error("南宫婉返修调查没有形成完整的范围、风险、回退和验收结构。");
  return { content, evidence, impactScope, exclusions, risks, rollbackPlan, acceptanceCriteria };
}

function hasMaterialRevisionEvidence(proposal: EvolutionProposal, investigation: RevisionInvestigation, advice: string): boolean {
  const oldEvidence = new Set(proposal.evidence.map(normalizedComparisonText));
  const approvalText = normalizedComparisonText(advice);
  const hasNewEvidence = investigation.evidence.some((item) => {
    const normalized = normalizedComparisonText(item);
    return normalized.length >= 12 && !oldEvidence.has(normalized) && normalized !== approvalText && !normalized.startsWith("人工审批事实");
  });
  if (!hasNewEvidence) return false;
  const nextStructure = normalizedComparisonText(JSON.stringify({ content: investigation.content, impactScope: investigation.impactScope, exclusions: investigation.exclusions, risks: investigation.risks, rollbackPlan: investigation.rollbackPlan, acceptanceCriteria: investigation.acceptanceCriteria }));
  const previousStructure = normalizedComparisonText(JSON.stringify({ content: proposal.content, impactScope: proposal.impactScope, exclusions: proposal.exclusions, risks: proposal.risks, rollbackPlan: proposal.rollbackPlan, acceptanceCriteria: proposal.acceptanceCriteria }));
  return nextStructure !== previousStructure;
}

function normalizedComparisonText(value: string): string { return value.normalize("NFKC").replaceAll(/\s+/gu, "").toLowerCase(); }

function parseDistributionPlan(text: string): Pick<EvolutionDistributionPlan, "summary" | "units"> {
  const value = parseJsonObject(text);
  const summary = typeof value.summary === "string" ? value.summary.trim().slice(0, 4_000) : "";
  const rawUnits = Array.isArray(value.units) ? value.units : [];
  const units = rawUnits.flatMap((raw): EvolutionDistributionUnit[] => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Record<string, unknown>;
    const title = typeof item.title === "string" ? item.title.trim().slice(0, 200) : "";
    const scope = typeof item.scope === "string" ? item.scope.trim().slice(0, 8_000) : "";
    const acceptanceCriteria = normalizeDraftList(item.acceptanceCriteria);
    const expectedFiles = normalizeDraftList(item.expectedFiles).map((file) => file.replaceAll("\\", "/").replace(/^\.\//u, "")).filter((file) => !file.startsWith("/") && !file.split("/").includes(".."));
    const independentReason = typeof item.independentReason === "string" ? item.independentReason.trim().slice(0, 4_000) : "";
    return title && scope && acceptanceCriteria.length && expectedFiles.length && independentReason ? [{ title, scope, acceptanceCriteria, expectedFiles, independentReason }] : [];
  });
  if (!summary || !units.length) throw new Error("南宫婉没有形成包含文件边界和独立验收条件的有效任务拆分计划。");
  return { summary, units };
}

function distributionHardFindings(units: EvolutionDistributionUnit[]): string[] {
  const findings: string[] = [];
  const owners = new Map<string, string[]>();
  for (const unit of units) for (const file of unit.expectedFiles) owners.set(file, [...(owners.get(file) || []), unit.title]);
  for (const [file, titles] of owners) if (titles.length > 1) findings.push(`预计文件 ${file} 同时属于 ${titles.join("、")}`);
  const scopes = new Map<string, string[]>();
  for (const unit of units) {
    const key = unit.scope.replaceAll(/\s+/gu, "").toLowerCase();
    scopes.set(key, [...(scopes.get(key) || []), unit.title]);
  }
  for (const titles of scopes.values()) if (titles.length > 1) findings.push(`任务职责重复：${titles.join("、")}`);
  return findings;
}

function parseDistributionAudit(text: string, hardFindings: string[]): EvolutionDistributionAudit {
  const value = parseJsonObject(text);
  const modelDecision = value.decision === "passed" ? "passed" : "revise";
  const reason = typeof value.reason === "string" && value.reason.trim() ? value.reason.trim().slice(0, 4_000) : "令狐没有提供充分的分发审计依据。";
  const findings = [...new Set([...hardFindings, ...normalizeDraftList(value.findings)])];
  return { decision: hardFindings.length ? "revise" : modelDecision, reason, findings, auditedAt: new Date().toISOString() };
}

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

function acceptancePlanningPrompt(topic: NangongEvolutionState["topics"][number], proposal: EvolutionProposal, priorFindings: Record<string, unknown>[]): string {
  return [
    "你是韩立，负责在令狐门禁完成后制定真实应用界面验收计划。只制定计划，不声称已打开应用或已经通过。",
    "必须从本次专题事实中理解用户关注点，并主动覆盖容易遗漏的交互细节：入口可达、按钮响应、状态切换、表格分页与滚动、弹窗或侧栏溢出、窗口缩放、键盘操作、加载/空态/错误态、数据写入与刷新一致性。不要机械复制固定清单；只保留与本专题有关的检查，并补充你根据界面影响合理推断的隐含检查。",
    "每项必须能在真实应用里执行并留下证据，不得用源码、构建成功或测试报告替代操作检查。若项目经验为空，不得编造历史经验。",
    `专题：${JSON.stringify({ title: topic.title, goal: topic.goal, scope: topic.scope, exclusions: topic.exclusions, evidence: topic.evidence, acceptanceCriteria: topic.acceptanceCriteria })}`,
    `提案：${JSON.stringify({ title: proposal.title, content: proposal.content, impactScope: proposal.impactScope, risks: proposal.risks, resultSummary: proposal.resultSummary })}`,
    `已验证项目经验：${JSON.stringify(priorFindings)}`,
    "每个检查项还必须给出受控 operations，只能使用：focus-window；resize-window(width,height)；click(target)；scroll(target,direction,amount)；press-key(target,key)；inspect-text(text)；capture(label)。click 只用于导航、展开、切换等无破坏操作，禁止生成删除、清空、提交审批、分发、验收通过等写动作。",
    "仅返回 JSON：{\"summary\":\"本次验收重点\",\"concerns\":[\"用户关注点\"],\"checks\":[{\"category\":\"AI自由判断类别\",\"target\":\"页面或控件\",\"action\":\"真实操作步骤\",\"expected\":\"可观察预期\",\"evidenceRequired\":\"截图、状态或数据证据\",\"operations\":[{\"type\":\"capture\",\"label\":\"初始状态\"}]}]}。checks 至少 2 项、最多 30 项，每项至少一个 operation。",
  ].join("\n\n");
}

function parseAcceptancePlan(text: string, topicId: string, proposalId: string): HanLiAcceptancePlan {
  const value = parseJsonObject(text);
  const summary = typeof value.summary === "string" ? value.summary.trim().slice(0, 2_000) : "";
  const concerns = normalizeDraftList(value.concerns).slice(0, 20);
  const rawChecks = Array.isArray(value.checks) ? value.checks.slice(0, 30) : [];
  const checks = rawChecks.flatMap((raw, index) => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Record<string, unknown>;
    const category = typeof item.category === "string" ? item.category.trim().slice(0, 120) : "";
    const target = typeof item.target === "string" ? item.target.trim().slice(0, 300) : "";
    const action = typeof item.action === "string" ? item.action.trim().slice(0, 2_000) : "";
    const expected = typeof item.expected === "string" ? item.expected.trim().slice(0, 2_000) : "";
    const evidenceRequired = typeof item.evidenceRequired === "string" ? item.evidenceRequired.trim().slice(0, 1_000) : "";
    const operations = Array.isArray(item.operations) ? item.operations.slice(0, 20).flatMap(parseAcceptanceOperation) : [];
    return category && target && action && expected && evidenceRequired && operations.length ? [{ checkId: `check-${index + 1}`, category, target, action, expected, evidenceRequired, operations }] : [];
  });
  if (!summary || !concerns.length || checks.length < 2) throw new Error("韩立没有形成包含用户关注点和真实操作证据的有效验收计划。 ");
  return { version: 1, planId: `hanli-acceptance-plan-${randomUUID()}`, topicId, proposalId, summary, concerns, checks, generatedAt: new Date().toISOString() };
}

function parseAcceptanceOperation(raw: unknown): HanLiAcceptancePlan["checks"][number]["operations"] {
  if (!raw || typeof raw !== "object") return [];
  const item = raw as Record<string, unknown>;
  if (item.type === "focus-window") return [{ type: "focus-window" }];
  if (item.type === "resize-window" && Number.isInteger(item.width) && Number.isInteger(item.height)) return [{ type: "resize-window", width: Number(item.width), height: Number(item.height) }];
  if (item.type === "click" && typeof item.target === "string" && item.target.trim()) return [{ type: "click", target: item.target.trim().slice(0, 200) }];
  if (item.type === "scroll" && typeof item.target === "string" && (item.direction === "up" || item.direction === "down") && Number.isFinite(item.amount)) return [{ type: "scroll", target: item.target.trim().slice(0, 200), direction: item.direction, amount: Math.max(40, Math.min(2_000, Math.round(Number(item.amount)))) }];
  if (item.type === "press-key" && ["Tab", "Enter", "Escape", "ArrowDown", "ArrowUp", "PageDown", "PageUp"].includes(String(item.key))) return [{ type: "press-key", target: typeof item.target === "string" ? item.target.trim().slice(0, 200) : undefined, key: item.key as "Tab" | "Enter" | "Escape" | "ArrowDown" | "ArrowUp" | "PageDown" | "PageUp" }];
  if (item.type === "inspect-text" && typeof item.text === "string" && item.text.trim()) return [{ type: "inspect-text", text: item.text.trim().slice(0, 500) }];
  if (item.type === "capture" && typeof item.label === "string" && item.label.trim()) return [{ type: "capture", label: item.label.trim().slice(0, 160) }];
  return [];
}

const CONVERSATION_TOPIC_META_PREFIX = "NANGONG_TOPIC_META=";

/** 南宫婉正文保持自然语言；最后一行只提供机器可读主题坐标，解析失败也不丢失正文。 */
function parseConversationResponse(text: string): { reply: string; topic: ConversationRoundTopicDecision; invitesOneShot: boolean } {
  const lines = text.trim().split(/\r?\n/);
  let markerIndex = -1;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index].trim().startsWith(CONVERSATION_TOPIC_META_PREFIX)) { markerIndex = index; break; }
  }
  if (markerIndex < 0) {
    const corpus = parseCorpusMetadata(text);
    const reply = text.trim();
    return { reply, topic: corpus || { title: "待 AI 归类", type: "待归类", switchTopic: false, userIntent: "", tags: [], summary: "" }, invitesOneShot: reply.includes(NANGONG_ONE_SHOT_INVITATION) };
  }
  const marker = lines[markerIndex].trim().slice(CONVERSATION_TOPIC_META_PREFIX.length);
  try {
    const value = JSON.parse(marker) as Partial<ConversationRoundTopicDecision>;
    const title = typeof value.title === "string" ? value.title.trim().slice(0, 120) : "";
    const type = typeof value.type === "string" ? value.type.trim().slice(0, 120) : "";
    const userIntent = typeof value.userIntent === "string" ? value.userIntent.trim().slice(0, 2_000) : "";
    const tags = Array.isArray(value.tags) ? [...new Set(value.tags.filter((item): item is string => typeof item === "string").map((item) => item.replaceAll(/\s+/g, " ").trim()).filter(Boolean))].slice(0, 12) : [];
    const summary = typeof value.summary === "string" && Array.from(value.summary.trim()).length <= 300 ? value.summary.trim() : "";
    const reply = lines.filter((_line, index) => index !== markerIndex).join("\n").trim();
    if (!reply || !title || !type || !userIntent || !tags.length || !summary) throw new Error("incomplete conversation topic metadata");
    return { reply, topic: { title, type, switchTopic: value.switchTopic === true, userIntent, tags, summary }, invitesOneShot: reply.includes(NANGONG_ONE_SHOT_INVITATION) };
  } catch {
    const reply = lines.filter((_line, index) => index !== markerIndex).join("\n").trim() || text.trim();
    return { reply, topic: { title: "待 AI 归类", type: "待归类", switchTopic: false, userIntent: "", tags: [], summary: "" }, invitesOneShot: reply.includes(NANGONG_ONE_SHOT_INVITATION) };
  }
}

/** Codex 最终回答可能只带工程语料元数据；该元数据同样来自 AI 语义判断，可用于避免保存后误报整轮失败。 */
function parseCorpusMetadata(text: string): ConversationRoundTopicDecision | null {
  const match = text.match(/<!--\s*SELPLAT_CORPUS_META\s+(\{[\s\S]*?\})\s*-->/);
  if (!match) return null;
  try {
    const value = JSON.parse(match[1]) as Record<string, unknown>;
    const title = typeof value.title === "string" ? value.title.trim().slice(0, 120) : "";
    const type = typeof value.type === "string" ? value.type.trim().slice(0, 120) : "";
    const userIntent = typeof value.intent === "string" ? value.intent.trim().slice(0, 2_000) : "";
    const tags = normalizeDraftList(value.tags).slice(0, 12);
    const summary = typeof value.summary === "string" && Array.from(value.summary.trim()).length <= 300 ? value.summary.trim() : "";
    return title && type && userIntent && tags.length && summary ? { title, type, switchTopic: false, userIntent, tags, summary } : null;
  } catch { return null; }
}

function normalizeDraftList(value: unknown): string[] { return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))].slice(0, 100) : []; }

function parseJsonObject(text: string): Record<string, unknown> {
  const candidate = text.match(/\{[\s\S]*\}/)?.[0];
  if (!candidate) throw new Error("AI 没有返回可解析的结构化判断。 ");
  try { return JSON.parse(candidate) as Record<string, unknown>; } catch { throw new Error("AI 返回的结构化判断不是有效 JSON。 "); }
}

function parseOneShotApproval(text: string): { decision: "approved" | "rejected" | "supplement-required"; advice: string } {
  const value = parseJsonObject(text);
  const decision = value.decision;
  const advice = typeof value.advice === "string" ? value.advice.trim().slice(0, 8_000) : "";
  if (!(["approved", "rejected", "supplement-required"] as unknown[]).includes(decision) || !advice) throw new Error("韩立一次性方向审批缺少有效决定或具体意见。");
  return { decision: decision as "approved" | "rejected" | "supplement-required", advice };
}

function itemFailureReason(task: ReturnType<CollaborationCoordinator["state"]>["tasks"][number]): string {
  return task.blockingReason || task.repairFailureReason || task.unifiedTest?.failureReason || `任务 ${task.snapshot.title} 未能继续，交给令狐按原恢复线路处理。`;
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
  const newestTime = Math.max(...snapshots.map((item) => Date.parse(item.originalCreatedAt)).filter(Number.isFinite), 0);
  return [...groups.entries()]
    .sort(([, left], [, right]) => latestMessageTime(right) - latestMessageTime(left))
    .map(([key, messages]) => [
    `会话组 ${key}（${maturityLabel(newestTime, latestMessageTime(messages))}）`,
    ...messages.sort((left, right) => left.sequenceNumber - right.sequenceNumber).map((item) => `[${item.originalCreatedAt}] ${item.role}${item.responsePhase ? `/${item.responsePhase}` : ""}：${item.content}`),
  ].join("\n")).join("\n\n---\n\n");
}

function latestMessageTime(messages: EvolutionSourceMessageSnapshot[]): number {
  return Math.max(...messages.map((item) => Date.parse(item.originalCreatedAt)).filter(Number.isFinite), 0);
}

function maturityLabel(newestTime: number, groupTime: number): string {
  const ageDays = Math.max(0, newestTime - groupTime) / 86_400_000;
  if (ageDays <= 30) return "近期高权重";
  if (ageDays <= 180) return "中期参考";
  return "早期低权重，仅用于演变追溯";
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
