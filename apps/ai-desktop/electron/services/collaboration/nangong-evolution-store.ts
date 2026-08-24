import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { ConvertNangongConversationToTopicRequest, CreateEvolutionProposalRequest, CreateEvolutionTopicRequest, CreateLinghuRepairProposalRequest, EvolutionApproval, EvolutionApprovalDecision, EvolutionApprovalSource, EvolutionProposal, NangongEvolutionState } from "../../../contracts/nangong-evolution.js";

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
        status: "registered", currentProposalVersion: 0, recoveryPoint: "topic-registered",
        createdAt: now, updatedAt: now,
      });
      state.activeTopicId = topicId;
    });
  }

  createProposal(topicId: string, request: CreateEvolutionProposalRequest): NangongEvolutionState {
    const topic = requireTopic(this.#state, topicId);
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
        content: required(request.content, "提案内容", 30_000), evidence: [...mutableTopic.evidence],
        impactScope: [...mutableTopic.scope], exclusions: [...mutableTopic.exclusions],
        risks: normalizedList(request.risks, "风险"), rollbackPlan: required(request.rollbackPlan, "回退方案", 8_000),
        acceptanceCriteria: [...mutableTopic.acceptanceCriteria],
        distributionUnits: normalizeDistributionUnits(request.distributionUnits, mutableTopic), status: "pending-approval",
        approvals: [], distributedTaskIds: [], resultSummary: null, createdAt: now, updatedAt: now,
      });
    });
  }

  appendConversation(role: "user" | "nangong", content: string): NangongEvolutionState {
    const messageId = `evolution-message-${randomUUID()}`;
    const now = new Date().toISOString();
    return this.#commit("conversation.message_added", null, null, (state) => {
      state.conversation.messages.push({ messageId, role, content: required(content, "对话内容", 30_000), createdAt: now });
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
    const evidence = messages.filter((item) => item.role === "nangong").map((item) => item.content).slice(-20);
    const fallbackEvidence = messages.map((item) => item.content).slice(-20);
    return this.createTopic({ ...request, evidence: evidence.length ? evidence : fallbackEvidence }, messages.map((item) => item.messageId));
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
        origin: "linghu", sourceConversationMessageIds: [], status: "pending-approval", currentProposalVersion: 1,
        recoveryPoint: "linghu-proposal-awaiting-approval", createdAt: now, updatedAt: now,
      });
      state.proposals.push({
        proposalId, topicId, version: 1, title: required(request.title, "修正标题", 160), type: "Bug修复", origin: "linghu",
        submitterMemberId: "linghu-ancestor", submitterDisplayName: "令狐老祖", content: required(request.content, "修正内容", 30_000),
        evidence: normalizedList(request.evidence, "调查证据"), impactScope: normalizedList(request.impactScope, "影响范围"), exclusions: [],
        risks: normalizedList(request.risks, "风险"), rollbackPlan: required(request.rollbackPlan, "回退方案", 8_000),
        acceptanceCriteria: normalizedList(request.acceptanceCriteria, "验收条件"),
        distributionUnits: request.impactScope.map((scope) => ({ title: `${request.title} · ${scope}`, scope, acceptanceCriteria: [...request.acceptanceCriteria] })),
        status: "pending-approval", approvals: [], distributedTaskIds: [], resultSummary: null, createdAt: now, updatedAt: now,
      });
      state.activeTopicId = topicId;
    });
  }

  decide(proposalId: string, decision: EvolutionApprovalDecision, advice: string, source: EvolutionApprovalSource, referencedApprovalIds: string[]): NangongEvolutionState {
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
      if ((raw.version === 1 || raw.version === 2) && Array.isArray(raw.topics) && Array.isArray(raw.proposals)) {
        const value = raw as NangongEvolutionState;
        const legacy = raw;
        value.version = 2;
        value.automaticNangongApprovalEnabled ??= legacy.automaticApprovalEnabled === true;
        value.automaticLinghuApprovalEnabled ??= false;
        value.conversation ??= createConversation();
        for (const proposal of value.proposals) {
          const topic = value.topics.find((item) => item.topicId === proposal.topicId);
          topic && (topic.origin ??= "nangong");
          topic && (topic.sourceConversationMessageIds ??= []);
          proposal.origin ??= topic?.origin || "nangong";
          proposal.distributionUnits ??= topic ? topic.scope.map((scope) => ({ title: `${topic.title} · ${scope}`, scope, acceptanceCriteria: [...topic.acceptanceCriteria] })) : [];
          proposal.resultSummary ??= null;
        }
        return value;
      }
    } catch { /* 首次启动或损坏状态使用安全关闭的空状态，历史文件不会被扫描猜测。 */ }
    return { version: 2, automaticEvolutionEnabled: false, automaticNangongApprovalEnabled: false, automaticLinghuApprovalEnabled: false, automaticExecutionEnabled: false, preferenceSnapshotVersion: 0, activeTopicId: null, topics: [], proposals: [], conversation: createConversation(), updatedAt: new Date().toISOString() };
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
function requireTopic(state: NangongEvolutionState, topicId: string) { const topic = state.topics.find((item) => item.topicId === topicId); if (!topic) throw new Error("专项课题不存在。"); return topic; }
function requireProposal(state: NangongEvolutionState, proposalId: string) { const proposal = state.proposals.find((item) => item.proposalId === proposalId); if (!proposal) throw new Error("演化提案不存在。"); return proposal; }
function createConversation(): NangongEvolutionState["conversation"] { const now = new Date().toISOString(); return { conversationId: `nangong-conversation-${randomUUID()}`, messages: [], updatedAt: now }; }
