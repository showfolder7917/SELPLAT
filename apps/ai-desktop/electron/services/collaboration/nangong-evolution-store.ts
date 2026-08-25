import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { ConvertNangongConversationToTopicRequest, CreateEvolutionProposalRequest, CreateEvolutionTopicRequest, CreateLinghuRepairProposalRequest, EvolutionApproval, EvolutionApprovalDecision, EvolutionApprovalSource, EvolutionFeedbackTarget, EvolutionProposal, NangongEvolutionState, ReviseEvolutionProposalRequest, UpdateEvolutionTopicRequest } from "../../../contracts/nangong-evolution.js";

type StateListener = (state: NangongEvolutionState, reason: string, topicId: string | null, proposalId: string | null) => void;

/** 原子保存专项课题、不可覆盖的提案版本和审批历史，避免把演化状态混入普通协同任务。 */
export class NangongEvolutionStore {
  readonly #filePath: string;
  readonly #listeners = new Set<StateListener>();
  #state: NangongEvolutionState;

  constructor(filePath: string) {
    this.#filePath = filePath;
    this.#state = this.#load();
  }

  state(): NangongEvolutionState { return structuredClone(this.#state); }
  subscribe(listener: StateListener): () => void { this.#listeners.add(listener); return () => this.#listeners.delete(listener); }

  setAutomation(kind: "evolution" | "nangong-approval" | "linghu-approval" | "execution", enabled: boolean): NangongEvolutionState {
    return this.#commit(`automation.${kind}.${enabled ? "enabled" : "disabled"}`, null, null, (state) => {
      if (kind === "evolution") state.automaticEvolutionEnabled = enabled;
      if (kind === "nangong-approval") state.automaticNangongApprovalEnabled = enabled;
      if (kind === "linghu-approval") state.automaticLinghuApprovalEnabled = enabled;
      if (kind === "execution") state.automaticExecutionEnabled = enabled;
    });
  }

  createTopic(request: CreateEvolutionTopicRequest, sourceConversationMessageIds: string[] = []): NangongEvolutionState {
    const title = required(request?.title, "专项标题", 160);
    const goal = required(request?.goal, "专项目标", 8_000);
    if (!request.workspaceState?.roots?.length) throw new Error("专项课题至少需要一个已登记工作区。");
    const now = new Date().toISOString();
    const topicId = `evolution-topic-${randomUUID()}`;
    return this.#commit("topic.created", topicId, null, (state) => {
      state.topics.push({
        topicId, title, goal,
        scope: normalizedList(request.scope, "影响范围"),
        exclusions: normalizedOptionalList(request.exclusions),
        evidence: normalizedList(request.evidence, "调查证据"),
        acceptanceCriteria: normalizedList(request.acceptanceCriteria, "验收条件"),
        workspaceState: structuredClone(request.workspaceState), locale: request.locale,
        origin: "nangong", sourceConversationMessageIds: [...sourceConversationMessageIds],
        continuationOfTopicId: null, nextTopicId: null,
        status: "registered", topicRevision: 1, currentProposalVersion: 0, recoveryPoint: "topic-registered",
        createdAt: now, updatedAt: now,
      });
      state.activeTopicId = topicId;
    });
  }

  createProposal(topicId: string, request: CreateEvolutionProposalRequest): NangongEvolutionState {
    const topic = requireTopic(this.#state, topicId);
    assertTopicEditableBeforeProposal(this.#state, topic);
    const now = new Date().toISOString();
    const proposalId = `evolution-proposal-${randomUUID()}`;
    const version = topic.currentProposalVersion + 1;
    return this.#commit("proposal.created", topicId, proposalId, (state) => {
      const mutableTopic = requireTopic(state, topicId);
      mutableTopic.status = "pending-approval";
      mutableTopic.currentProposalVersion = version;
      mutableTopic.recoveryPoint = "proposal-awaiting-approval";
      mutableTopic.updatedAt = now;
      state.proposals.push({
        proposalId, topicId, version, title: mutableTopic.title, type: request.type, origin: mutableTopic.origin,
        submitterMemberId: "nangong-wan", submitterDisplayName: "南宫婉",
        purpose: "work-proposal", targetMemberId: null, targetMemberDisplayName: null, capabilityScope: null,
        supersedesProposalId: null, revisionFeedbackApprovalId: null,
        content: required(request.content, "提案内容", 30_000), evidence: [...mutableTopic.evidence],
        impactScope: [...mutableTopic.scope], exclusions: [...mutableTopic.exclusions],
        risks: normalizedList(request.risks, "风险"), rollbackPlan: required(request.rollbackPlan, "回退方案", 8_000),
        acceptanceCriteria: [...mutableTopic.acceptanceCriteria],
        distributionUnits: normalizeDistributionUnits(request.distributionUnits, mutableTopic), status: "pending-approval",
        approvals: [], distributedTaskIds: [], resultSummary: null, createdAt: now, updatedAt: now,
      });
    });
  }

  updateTopic(topicId: string, request: UpdateEvolutionTopicRequest): NangongEvolutionState {
    const topic = requireTopic(this.#state, topicId);
    assertTopicEditableBeforeProposal(this.#state, topic);
    if (request.expectedTopicRevision !== topic.topicRevision) throw new Error("课题已被其他保存操作更新，请刷新后重新编辑。");
    const now = new Date().toISOString();
    return this.#commit("topic.updated", topicId, null, (state) => {
      const mutable = requireTopic(state, topicId);
      // 用户确认保存前允许纠正课题事实；提案形成后该快照不得再被覆盖。
      mutable.title = required(request.title, "专项标题", 160);
      mutable.goal = required(request.goal, "专项目标", 8_000);
      mutable.scope = normalizedList(request.scope, "影响范围");
      mutable.exclusions = normalizedOptionalList(request.exclusions);
      mutable.evidence = normalizedList(request.evidence, "调查证据");
      mutable.acceptanceCriteria = normalizedList(request.acceptanceCriteria, "验收条件");
      mutable.topicRevision += 1;
      mutable.recoveryPoint = "topic-updated-before-proposal";
      mutable.updatedAt = now;
    });
  }

  appendConversation(role: "user" | "nangong", content: string, attachmentIds: string[] = []): NangongEvolutionState {
    const messageId = `evolution-message-${randomUUID()}`;
    const now = new Date().toISOString();
    return this.#commit("conversation.message_added", null, null, (state) => {
      state.conversation.messages.push({ messageId, role, content: required(content, "对话内容", 30_000), attachmentIds: [...new Set(attachmentIds)].slice(0, 5), createdAt: now });
      state.conversation.updatedAt = now;
    });
  }

  newConversation(): NangongEvolutionState {
    return this.#commit("conversation.created", null, null, (state) => {
      state.conversation = createConversation();
    });
  }

  convertConversationToTopic(request: ConvertNangongConversationToTopicRequest): NangongEvolutionState {
    const messages = this.#state.conversation.messages;
    if (!messages.length) throw new Error("当前没有可转换的南宫婉对话。 ");
    if (request.confirmedByUser !== true) throw new Error("只有用户明确确认后，才能把南宫婉对话整理为正式课题。");
    // 用户确认过表单中的事实证据后优先保存该版本；旧调用方缺少该字段时仍保留来源明确的对话材料。
    const sourceMessages = messages.slice(-20);
    const evidence = request.evidence?.length
      ? request.evidence
      : sourceMessages.map((item) => `${item.role === "user" ? "用户提供的材料" : "南宫婉调查记录（含待验证判断）"}：${item.content}`);
    return this.createTopic({ ...request, evidence }, sourceMessages.map((item) => item.messageId));
  }

  createLinghuRepairProposal(request: CreateLinghuRepairProposalRequest): NangongEvolutionState {
    const now = new Date().toISOString();
    const topicId = `evolution-topic-${randomUUID()}`;
    const proposalId = `evolution-proposal-${randomUUID()}`;
    if (!request.workspaceState?.roots?.length) throw new Error("令狐修正方案至少需要一个已登记工作区。");
    return this.#commit("linghu.proposal.created", topicId, proposalId, (state) => {
      state.topics.push({
        topicId, title: required(request.title, "修正标题", 160), goal: required(request.content, "修正内容", 30_000),
        scope: normalizedList(request.impactScope, "影响范围"), exclusions: [], evidence: normalizedList(request.evidence, "调查证据"),
        acceptanceCriteria: normalizedList(request.acceptanceCriteria, "验收条件"), workspaceState: structuredClone(request.workspaceState), locale: request.locale,
        origin: "linghu", sourceConversationMessageIds: [], status: "pending-approval", topicRevision: 1, currentProposalVersion: 1,
        continuationOfTopicId: null, nextTopicId: null,
        recoveryPoint: "linghu-proposal-awaiting-approval", createdAt: now, updatedAt: now,
      });
      state.proposals.push({
        proposalId, topicId, version: 1, title: required(request.title, "修正标题", 160), type: "Bug修复", origin: "linghu",
        submitterMemberId: "linghu-ancestor", submitterDisplayName: "令狐老祖", content: required(request.content, "修正内容", 30_000),
        purpose: "work-proposal", targetMemberId: null, targetMemberDisplayName: null, capabilityScope: null,
        supersedesProposalId: null, revisionFeedbackApprovalId: null,
        evidence: normalizedList(request.evidence, "调查证据"), impactScope: normalizedList(request.impactScope, "影响范围"), exclusions: [],
        risks: normalizedList(request.risks, "风险"), rollbackPlan: required(request.rollbackPlan, "回退方案", 8_000),
        acceptanceCriteria: normalizedList(request.acceptanceCriteria, "验收条件"),
        distributionUnits: request.impactScope.map((scope) => ({ title: `${request.title} · ${scope}`, scope, acceptanceCriteria: [...request.acceptanceCriteria] })),
        status: "pending-approval", approvals: [], distributedTaskIds: [], resultSummary: null, createdAt: now, updatedAt: now,
      });
      state.activeTopicId = topicId;
    });
  }

  decide(proposalId: string, decision: EvolutionApprovalDecision, advice: string, source: EvolutionApprovalSource, referencedApprovalIds: string[], feedbackTarget: EvolutionFeedbackTarget = "proposal-content", capabilityScope = ""): NangongEvolutionState {
    const proposal = requireProposal(this.#state, proposalId);
    const latestApproval = proposal.approvals.at(-1);
    const correctsAutomaticDecision = source === "manual-user"
      && latestApproval?.source === "automatic-han-li"
      && proposal.distributedTaskIds.length === 0;
    if (!["pending-approval", "supplement-required"].includes(proposal.status) && !correctsAutomaticDecision) throw new Error("当前提案不在可审批状态。");
    const now = new Date().toISOString();
    return this.#commit("proposal.decided", proposal.topicId, proposalId, (state) => {
      if (source === "manual-user") state.preferenceSnapshotVersion += 1;
      const mutable = requireProposal(state, proposalId);
      const approval: EvolutionApproval = {
        approvalId: `evolution-approval-${randomUUID()}`, proposalId, decision, source,
        approverMemberId: source === "manual-user" ? "user" : "han-li",
        approverDisplayName: source === "manual-user" ? "用户" : "韩立",
        advice: advice.trim().slice(0, 8_000), referencedApprovalIds,
        feedbackTarget,
        capabilityScope: feedbackTarget === "submitter-capability" ? required(capabilityScope, "自身能力升级范围", 2_000) : null,
        preferenceSnapshotVersion: state.preferenceSnapshotVersion, createdAt: now,
      };
      mutable.approvals.push(approval);
      mutable.status = decision;
      mutable.updatedAt = now;
      const topic = requireTopic(state, mutable.topicId);
      topic.status = decision;
      topic.recoveryPoint = decision === "approved" ? `approved-returned-to-${mutable.origin}` : decision;
      topic.updatedAt = now;
    });
  }

  /** 原提交人只能修订退回的本人提案；新版本保留原审批、反馈目标和完整替代链。 */
  revise(proposalId: string, request: ReviseEvolutionProposalRequest, submitterDisplayName: string): NangongEvolutionState {
    const previous = requireProposal(this.#state, proposalId);
    if (!['supplement-required', 'rejected'].includes(previous.status)) throw new Error("只有退回补充或驳回的提案可以重新提交。");
    if (previous.submitterMemberId !== request.submitterMemberId) throw new Error("只能由原提交人重新提交该提案。");
    const feedback = previous.approvals.at(-1);
    if (!feedback) throw new Error("重新提交缺少可追溯的审批意见。");
    const topic = requireTopic(this.#state, previous.topicId);
    const now = new Date().toISOString();
    const nextProposalId = `evolution-proposal-${randomUUID()}`;
    const version = topic.currentProposalVersion + 1;
    return this.#commit("proposal.revised", topic.topicId, nextProposalId, (state) => {
      const mutableTopic = requireTopic(state, topic.topicId);
      mutableTopic.status = "pending-approval";
      mutableTopic.currentProposalVersion = version;
      mutableTopic.recoveryPoint = `revised-from:${previous.proposalId}`;
      mutableTopic.updatedAt = now;
      state.proposals.push({
        proposalId: nextProposalId,
        topicId: previous.topicId,
        version,
        title: previous.title,
        type: feedback.feedbackTarget === "submitter-capability" ? "规则优化" : previous.type,
        origin: previous.origin,
        submitterMemberId: previous.submitterMemberId,
        submitterDisplayName,
        purpose: feedback.feedbackTarget === "submitter-capability" ? "self-capability-upgrade" : previous.purpose,
        targetMemberId: feedback.feedbackTarget === "submitter-capability" ? previous.submitterMemberId : previous.targetMemberId,
        targetMemberDisplayName: feedback.feedbackTarget === "submitter-capability" ? submitterDisplayName : previous.targetMemberDisplayName,
        capabilityScope: feedback.capabilityScope || previous.capabilityScope,
        supersedesProposalId: previous.proposalId,
        revisionFeedbackApprovalId: feedback.approvalId,
        content: required(request.content, "修订方案", 30_000),
        evidence: normalizedList(request.evidence, "补充调查证据"),
        impactScope: normalizedList(request.impactScope, "修订影响范围"),
        exclusions: [...previous.exclusions],
        risks: normalizedList(request.risks, "修订风险"),
        rollbackPlan: required(request.rollbackPlan, "修订回退方案", 8_000),
        acceptanceCriteria: normalizedList(request.acceptanceCriteria, "修订验收条件"),
        distributionUnits: normalizeRevisedDistributionUnits(previous, request),
        status: "pending-approval",
        approvals: [], distributedTaskIds: [], resultSummary: null, createdAt: now, updatedAt: now,
      });
    });
  }

  markDispatched(proposalId: string, taskId: string): NangongEvolutionState {
    const proposal = requireProposal(this.#state, proposalId);
    return this.#commit("proposal.distributed", proposal.topicId, proposalId, (state) => {
      const mutable = requireProposal(state, proposalId);
      if (!mutable.distributedTaskIds.includes(taskId)) mutable.distributedTaskIds.push(taskId);
      mutable.status = "executing";
      mutable.updatedAt = new Date().toISOString();
      const topic = requireTopic(state, mutable.topicId);
      topic.status = "executing";
      topic.recoveryPoint = `distributed:${taskId}`;
      topic.updatedAt = mutable.updatedAt;
    });
  }

  markProgress(proposalId: string, status: "executing" | "verifying" | "completed" | "blocked", resultSummary: string): NangongEvolutionState {
    const proposal = requireProposal(this.#state, proposalId);
    return this.#commit("proposal.progress_reconciled", proposal.topicId, proposalId, (state) => {
      const mutable = requireProposal(state, proposalId);
      mutable.status = status;
      mutable.resultSummary = resultSummary;
      mutable.updatedAt = new Date().toISOString();
      const topic = requireTopic(state, mutable.topicId);
      topic.status = status;
      topic.recoveryPoint = status === "completed" ? "evolution-goal-completed" : status === "blocked" ? "distributed-task-blocked" : `distributed-tasks-${status}`;
      topic.updatedAt = mutable.updatedAt;
    });
  }

  /** 演化启动器只从已完成课题建立一条可追溯的下一轮，重复启动不会重复创建。 */
  createNextRound(previousTopicId: string, resultSummary: string): NangongEvolutionState {
    const previous = requireTopic(this.#state, previousTopicId);
    if (previous.status !== "completed") throw new Error("只有完成验收的课题才能启动下一轮演化。");
    if (previous.nextTopicId) return this.state();
    const nextTopicId = `evolution-topic-${randomUUID()}`;
    const now = new Date().toISOString();
    return this.#commit("launcher.next_evolution_started", nextTopicId, null, (state) => {
      const source = requireTopic(state, previousTopicId);
      if (source.nextTopicId) return;
      source.nextTopicId = nextTopicId;
      source.recoveryPoint = `next-evolution:${nextTopicId}`;
      source.updatedAt = now;
      state.topics.push({
        topicId: nextTopicId,
        title: `${source.title} · 下一轮`,
        goal: `依据上一轮验收结果继续调查可验证的后续演进方向：${resultSummary}`.slice(0, 8_000),
        scope: [...source.scope],
        exclusions: [...source.exclusions],
        evidence: [...source.evidence, `上一轮完成事实：${resultSummary}`],
        acceptanceCriteria: [...source.acceptanceCriteria],
        workspaceState: structuredClone(source.workspaceState),
        locale: source.locale,
        origin: "nangong",
        sourceConversationMessageIds: [],
        continuationOfTopicId: source.topicId,
        nextTopicId: null,
        status: "registered",
        topicRevision: 1,
        currentProposalVersion: 0,
        recoveryPoint: `continued-from:${source.topicId}`,
        createdAt: now,
        updatedAt: now,
      });
      state.activeTopicId = nextTopicId;
    });
  }

  #commit(reason: string, topicId: string | null, proposalId: string | null, mutate: (state: NangongEvolutionState) => void): NangongEvolutionState {
    const next = structuredClone(this.#state);
    mutate(next);
    next.updatedAt = new Date().toISOString();
    this.#write(next);
    this.#state = next;
    const snapshot = this.state();
    for (const listener of this.#listeners) listener(snapshot, reason, topicId, proposalId);
    return snapshot;
  }

  #load(): NangongEvolutionState {
    try {
      const raw = JSON.parse(readFileSync(this.#filePath, "utf8")) as Omit<Partial<NangongEvolutionState>, "version"> & { version?: number; automaticApprovalEnabled?: boolean };
      if ((raw.version === 1 || raw.version === 2 || raw.version === 3 || raw.version === 4 || raw.version === 5) && Array.isArray(raw.topics) && Array.isArray(raw.proposals)) {
        const value = raw as NangongEvolutionState;
        const legacy = raw;
        value.version = 5;
        value.automaticNangongApprovalEnabled ??= legacy.automaticApprovalEnabled === true;
        value.automaticLinghuApprovalEnabled ??= false;
        value.conversation ??= createConversation();
        // 旧状态即使尚未生成提案，也必须获得首个课题修订号才能安全编辑。
        for (const topic of value.topics) {
          topic.topicRevision ??= 1;
          topic.continuationOfTopicId ??= null;
          topic.nextTopicId ??= null;
        }
        for (const proposal of value.proposals) {
          const topic = value.topics.find((item) => item.topicId === proposal.topicId);
          topic && (topic.origin ??= "nangong");
          topic && (topic.sourceConversationMessageIds ??= []);
          proposal.origin ??= topic?.origin || "nangong";
          proposal.distributionUnits ??= topic ? topic.scope.map((scope) => ({ title: `${topic.title} · ${scope}`, scope, acceptanceCriteria: [...topic.acceptanceCriteria] })) : [];
          proposal.resultSummary ??= null;
          proposal.purpose ??= "work-proposal";
          proposal.targetMemberId ??= null;
          proposal.targetMemberDisplayName ??= null;
          proposal.capabilityScope ??= null;
          proposal.supersedesProposalId ??= null;
          proposal.revisionFeedbackApprovalId ??= null;
          for (const approval of proposal.approvals) {
            approval.feedbackTarget ??= "proposal-content";
            approval.capabilityScope ??= null;
          }
        }
        return value;
      }
    } catch { /* 首次启动或损坏状态使用安全关闭的空状态，历史文件不会被扫描猜测。 */ }
    return { version: 5, automaticEvolutionEnabled: false, automaticNangongApprovalEnabled: false, automaticLinghuApprovalEnabled: false, automaticExecutionEnabled: false, preferenceSnapshotVersion: 0, activeTopicId: null, topics: [], proposals: [], conversation: createConversation(), updatedAt: new Date().toISOString() };
  }

  #write(state: NangongEvolutionState): void {
    mkdirSync(path.dirname(this.#filePath), { recursive: true });
    const temporary = `${this.#filePath}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    renameSync(temporary, this.#filePath);
  }
}

function required(value: unknown, label: string, maximum: number): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new Error(`${label}不能为空。`);
  return text.slice(0, maximum);
}
function normalizedList(values: unknown, label: string): string[] { const result = normalizedOptionalList(values); if (!result.length) throw new Error(`${label}至少需要一项。`); return result; }
function normalizedOptionalList(values: unknown): string[] { return Array.isArray(values) ? [...new Set(values.map((item) => typeof item === "string" ? item.trim() : "").filter(Boolean))].slice(0, 100) : []; }
function normalizeDistributionUnits(values: CreateEvolutionProposalRequest["distributionUnits"], topic: NangongEvolutionState["topics"][number]): EvolutionProposal["distributionUnits"] {
  const units = Array.isArray(values) ? values.map((item) => ({ title: item.title?.trim(), scope: item.scope?.trim(), acceptanceCriteria: normalizedOptionalList(item.acceptanceCriteria) })).filter((item) => item.title && item.scope && item.acceptanceCriteria.length) : [];
  return units.length ? units : topic.scope.map((scope) => ({ title: `${topic.title} · ${scope}`, scope, acceptanceCriteria: [...topic.acceptanceCriteria] }));
}
function normalizeRevisedDistributionUnits(previous: EvolutionProposal, request: ReviseEvolutionProposalRequest): EvolutionProposal["distributionUnits"] {
  return normalizedList(request.impactScope, "修订影响范围").map((scope) => ({ title: `${previous.title} · v${previous.version + 1} · ${scope}`, scope, acceptanceCriteria: normalizedList(request.acceptanceCriteria, "修订验收条件") }));
}
function requireTopic(state: NangongEvolutionState, topicId: string) { const topic = state.topics.find((item) => item.topicId === topicId); if (!topic) throw new Error("专项课题不存在。"); return topic; }
function requireProposal(state: NangongEvolutionState, proposalId: string) { const proposal = state.proposals.find((item) => item.proposalId === proposalId); if (!proposal) throw new Error("演化提案不存在。"); return proposal; }
function assertTopicEditableBeforeProposal(state: NangongEvolutionState, topic: NangongEvolutionState["topics"][number]): void {
  if (!["registered", "investigating"].includes(topic.status) || topic.currentProposalVersion !== 0 || state.proposals.some((item) => item.topicId === topic.topicId)) {
    throw new Error("课题已进入提案流程，不能再修改或重复提交提案。");
  }
}
function createConversation(): NangongEvolutionState["conversation"] { const now = new Date().toISOString(); return { conversationId: `nangong-conversation-${randomUUID()}`, messages: [], updatedAt: now }; }
