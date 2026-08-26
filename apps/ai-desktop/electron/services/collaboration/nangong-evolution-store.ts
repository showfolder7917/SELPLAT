import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { ConfigureEvolutionAutomationRequest, ConvertNangongConversationToTopicRequest, CreateEvolutionProposalRequest, CreateEvolutionTopicRequest, CreateLinghuRepairProposalRequest, EvolutionApproval, EvolutionApprovalDecision, EvolutionApprovalSource, EvolutionArchiveActor, EvolutionArchiveCategory, EvolutionAutomationAction, EvolutionFeedbackTarget, EvolutionProposal, EvolutionSourceMessageSnapshot, HanLiTopicCandidate, NangongEvolutionState, ReviseEvolutionProposalRequest, UpdateEvolutionTopicRequest } from "../../../contracts/nangong-evolution.js";

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
      if (kind === "evolution") {
        state.automaticEvolutionEnabled = enabled;
        state.automationRuntime.status = enabled ? "running" : "paused";
        state.automationRuntime.startedAt ??= enabled ? new Date().toISOString() : null;
        state.automationRuntime.pausedAt = enabled ? null : new Date().toISOString();
      }
      if (kind === "nangong-approval") state.automaticNangongApprovalEnabled = enabled;
      if (kind === "linghu-approval") state.automaticLinghuApprovalEnabled = enabled;
      if (kind === "execution") state.automaticExecutionEnabled = enabled;
    });
  }

  configureAutomation(request: ConfigureEvolutionAutomationRequest): NangongEvolutionState {
    const maximum = request.maxRoundsPerTopic;
    if (maximum !== null && (!Number.isInteger(maximum) || maximum < 1 || maximum > 100)) throw new Error("专题研讨轮次必须为 1 至 100，或选择无限模式。");
    if (!Number.isInteger(request.maxCorrectionRounds) || request.maxCorrectionRounds < 1 || request.maxCorrectionRounds > 20) throw new Error("纠偏轮次必须为 1 至 20。");
    return this.#commit("automation.configured", null, null, (state) => {
      state.automationSettings = { maxRoundsPerTopic: maximum, maxCorrectionRounds: request.maxCorrectionRounds };
      if (request.workspaceState) state.automationContext.workspaceState = structuredClone(request.workspaceState);
      if (request.locale) state.automationContext.locale = request.locale;
    });
  }

  controlAutomation(action: EvolutionAutomationAction): NangongEvolutionState {
    return this.#commit(`automation.${action}`, null, null, (state) => {
      const now = new Date().toISOString();
      if (action === "start" || action === "resume") {
        state.automaticEvolutionEnabled = true;
        state.automationRuntime.status = "running";
        state.automationRuntime.startedAt ??= now;
        state.automationRuntime.pausedAt = null;
        state.automationRuntime.stopReason = null;
      } else if (action === "pause") {
        state.automaticEvolutionEnabled = false;
        state.automationRuntime.status = "paused";
        state.automationRuntime.pausedAt = now;
      } else {
        state.automaticEvolutionEnabled = false;
        state.automationRuntime.status = "stopped";
        state.automationRuntime.stopReason = "韩立手动停止自动演化。";
        state.automationRuntime.pausedAt = null;
      }
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
        origin: "nangong", sourceConversationMessageIds: [...sourceConversationMessageIds], deliberationId: null,
        continuationOfTopicId: null, nextTopicId: null, seriesId: topicId, roundNumber: 1,
        status: "registered", topicRevision: 1, currentProposalVersion: 0, recoveryPoint: "topic-registered",
        createdAt: now, updatedAt: now,
      });
      state.activeTopicId = topicId;
    });
  }

  /** 韩立先冻结完整对话库原文，再登记第一轮问题；此时尚未产生正式专题。 */
  beginDeliberation(deliberationId: string, snapshots: EvolutionSourceMessageSnapshot[], question: string, questionReason: string): NangongEvolutionState {
    if (!snapshots.length) throw new Error("对话库没有可供韩立综合的南宫婉或 Codex 原始会话。 ");
    const now = new Date().toISOString();
    return this.#commit("deliberation.started", null, null, (state) => {
      if (state.deliberations.some((item) => item.deliberationId === deliberationId)) return;
      state.deliberations.push({
        deliberationId, topicId: null, status: "questioning", sourceSnapshots: structuredClone(snapshots),
        rounds: [{ roundId: `han-li-round-${randomUUID()}`, roundNumber: 1, question: required(question, "韩立问题", 30_000), questionReason: required(questionReason, "发问依据", 8_000), answer: null, assessment: null, decision: null, createdAt: now, answeredAt: null, assessedAt: null }],
        candidate: null, createdAt: now, updatedAt: now,
      });
    });
  }

  recordDeliberationAnswer(deliberationId: string, roundId: string, answer: string): NangongEvolutionState {
    return this.#commit("deliberation.nangong_answered", null, null, (state) => {
      const deliberation = requireDeliberation(state, deliberationId);
      const round = requireDeliberationRound(deliberation, roundId);
      if (round.answer !== null) return;
      round.answer = required(answer, "南宫婉回答", 60_000);
      round.answeredAt = new Date().toISOString();
      deliberation.updatedAt = round.answeredAt;
    });
  }

  assessDeliberation(deliberationId: string, roundId: string, assessment: string, nextQuestion: { question: string; reason: string } | null, candidate: HanLiTopicCandidate | null): NangongEvolutionState {
    return this.#commit(candidate ? "deliberation.topic_ready" : "deliberation.follow_up_planned", null, null, (state) => {
      const deliberation = requireDeliberation(state, deliberationId);
      const round = requireDeliberationRound(deliberation, roundId);
      if (!round.answer) throw new Error("南宫婉尚未回答当前问题。 ");
      if (round.assessment !== null) return;
      const now = new Date().toISOString();
      round.assessment = required(assessment, "韩立判断", 30_000);
      round.assessedAt = now;
      if (candidate) {
        round.decision = "establish-topic";
        deliberation.candidate = normalizeCandidate(candidate);
        deliberation.status = "ready-to-establish";
      } else {
        if (!nextQuestion) throw new Error("继续研讨必须给出韩立的下一轮问题。 ");
        round.decision = "continue";
        deliberation.rounds.push({ roundId: `han-li-round-${randomUUID()}`, roundNumber: round.roundNumber + 1, question: required(nextQuestion.question, "韩立下一轮问题", 30_000), questionReason: required(nextQuestion.reason, "下一轮发问依据", 8_000), answer: null, assessment: null, decision: null, createdAt: now, answeredAt: null, assessedAt: null });
      }
      deliberation.updatedAt = now;
    });
  }

  blockDeliberation(deliberationId: string, roundId: string, assessment: string, reason: string): NangongEvolutionState {
    return this.#commit("deliberation.blocked", null, null, (state) => {
      const deliberation = requireDeliberation(state, deliberationId);
      const round = requireDeliberationRound(deliberation, roundId);
      const now = new Date().toISOString();
      round.assessment = required(assessment, "韩立阻断判断", 30_000);
      round.decision = "blocked";
      round.assessedAt = now;
      deliberation.status = "blocked";
      deliberation.updatedAt = now;
      state.automaticEvolutionEnabled = false;
      state.automationRuntime.status = "blocked";
      state.automationRuntime.stopReason = required(reason, "研讨阻断原因", 8_000);
    });
  }

  /** 韩立确立后才通知南宫婉把研讨成果登记进长期专题池。 */
  establishDeliberationTopic(deliberationId: string): NangongEvolutionState {
    const current = requireDeliberation(this.#state, deliberationId);
    if (current.status !== "ready-to-establish" || !current.candidate) throw new Error("韩立尚未完成专题确立判断。 ");
    if (!this.#state.automationContext.workspaceState?.roots?.length) throw new Error("自动演化尚未登记实施工作区。 ");
    const topicId = `evolution-topic-${randomUUID()}`;
    const now = new Date().toISOString();
    return this.#commit("topic.established_from_deliberation", topicId, null, (state) => {
      const deliberation = requireDeliberation(state, deliberationId);
      if (deliberation.topicId) return;
      const candidate = deliberation.candidate!;
      state.topics.push({
        topicId, title: candidate.title, goal: candidate.goal, scope: [...candidate.scope], exclusions: [...candidate.exclusions],
        evidence: [...candidate.evidence], acceptanceCriteria: [...candidate.acceptanceCriteria], workspaceState: structuredClone(state.automationContext.workspaceState!),
        locale: state.automationContext.locale, origin: "nangong", sourceConversationMessageIds: deliberation.sourceSnapshots.map((item) => item.sourceMessageId),
        deliberationId, continuationOfTopicId: null, nextTopicId: null, seriesId: topicId, roundNumber: 1, status: "registered", topicRevision: 1,
        currentProposalVersion: 0, recoveryPoint: "han-li-established-nangong-topic-pool", createdAt: now, updatedAt: now,
      });
      deliberation.topicId = topicId;
      deliberation.status = "established";
      deliberation.updatedAt = now;
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

  recordConversationIntent(messageId: string, inferredIntent: string): NangongEvolutionState {
    const now = new Date().toISOString();
    return this.#commit("conversation.intent_recorded", null, null, (state) => {
      const message = state.conversation.messages.find((item) => item.messageId === messageId && item.role === "user");
      if (!message) throw new Error("需要登记意图的用户消息不存在。");
      message.inferredIntent = required(inferredIntent, "用户意图摘要", 2_000);
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
        origin: "linghu", sourceConversationMessageIds: [], deliberationId: null, status: "pending-approval", topicRevision: 1, currentProposalVersion: 1,
        continuationOfTopicId: null, nextTopicId: null, seriesId: topicId, roundNumber: 1,
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
        approvalId: `evolution-approval-${randomUUID()}`, proposalId, decision, source, stage: "direction",
        approverMemberId: "han-li",
        approverDisplayName: "韩立",
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

  /** 执行结果必须由韩立单独验收；任务完成事实不能直接替代最终业务判断。 */
  decideResult(proposalId: string, decision: EvolutionApprovalDecision, advice: string): NangongEvolutionState {
    const proposal = requireProposal(this.#state, proposalId);
    if (proposal.status !== "pending-acceptance") throw new Error("当前提案还没有进入结果验收状态。");
    const now = new Date().toISOString();
    return this.#commit("proposal.result_decided", proposal.topicId, proposalId, (state) => {
      const mutable = requireProposal(state, proposalId);
      state.preferenceSnapshotVersion += 1;
      mutable.approvals.push({
        approvalId: `evolution-approval-${randomUUID()}`, proposalId, decision, source: "manual-user", stage: "result",
        approverMemberId: "han-li", approverDisplayName: "韩立", advice: advice.trim().slice(0, 8_000),
        referencedApprovalIds: mutable.approvals.slice(-1).map((item) => item.approvalId), feedbackTarget: "proposal-content",
        capabilityScope: null, preferenceSnapshotVersion: state.preferenceSnapshotVersion, createdAt: now,
      });
      const topic = requireTopic(state, mutable.topicId);
      if (decision === "approved") {
        mutable.status = "completed";
        topic.status = "completed";
        topic.recoveryPoint = "han-li-result-accepted";
        state.automationRuntime.completedRounds += 1;
        state.automationRuntime.correctionRounds = 0;
      } else {
        mutable.status = "supplement-required";
        topic.status = "supplement-required";
        topic.recoveryPoint = "han-li-result-correction-required";
        state.automationRuntime.correctionRounds += 1;
        if (state.automationRuntime.correctionRounds >= state.automationSettings.maxCorrectionRounds) {
          state.automaticEvolutionEnabled = false;
          state.automationRuntime.status = "blocked";
          state.automationRuntime.stopReason = `结果纠偏达到 ${state.automationSettings.maxCorrectionRounds} 轮，等待韩立调整方向。`;
        }
      }
      mutable.updatedAt = now;
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

  markProgress(proposalId: string, status: "executing" | "verifying" | "pending-acceptance" | "blocked", resultSummary: string): NangongEvolutionState {
    const proposal = requireProposal(this.#state, proposalId);
    return this.#commit("proposal.progress_reconciled", proposal.topicId, proposalId, (state) => {
      const mutable = requireProposal(state, proposalId);
      mutable.status = status;
      mutable.resultSummary = resultSummary;
      mutable.updatedAt = new Date().toISOString();
      const topic = requireTopic(state, mutable.topicId);
      topic.status = status;
      topic.recoveryPoint = status === "pending-acceptance" ? "awaiting-han-li-result-acceptance" : status === "blocked" ? "distributed-task-blocked" : `distributed-tasks-${status}`;
      topic.updatedAt = mutable.updatedAt;
    });
  }

  #commit(reason: string, topicId: string | null, proposalId: string | null, mutate: (state: NangongEvolutionState) => void): NangongEvolutionState {
    const next = structuredClone(this.#state);
    mutate(next);
    const occurredAt = new Date().toISOString();
    next.updatedAt = occurredAt;
    const topic = topicId ? next.topics.find((item) => item.topicId === topicId) || null : null;
    const proposal = proposalId ? next.proposals.find((item) => item.proposalId === proposalId) || null : null;
    const deliberation = topic?.deliberationId
      ? next.deliberations.find((item) => item.deliberationId === topic.deliberationId) || null
      : [...next.deliberations].reverse().find((item) => item.status !== "established" || item.topicId === topicId) || null;
    // 专题档案只追加业务事实；普通聊天和纯配置变化没有专题或研讨关联时不伪造档案。
    if (topic || proposal || deliberation) next.archiveRecords.push({
      recordId: `evolution-archive-${randomUUID()}`,
      deliberationId: deliberation?.deliberationId || topic?.deliberationId || null,
      topicId: topicId || deliberation?.topicId || proposal?.topicId || null,
      proposalId,
      taskId: reason === "proposal.distributed" ? proposal?.distributedTaskIds.at(-1) || null : null,
      sequenceNumber: next.archiveRecords.length + 1,
      category: archiveCategory(reason),
      eventType: reason,
      actor: archiveActor(reason),
      title: archiveTitle(reason),
      payload: archivePayload(topic, proposal, deliberation),
      occurredAt,
    });
    this.#write(next);
    this.#state = next;
    const snapshot = this.state();
    for (const listener of this.#listeners) listener(snapshot, reason, topicId, proposalId);
    return snapshot;
  }

  #load(): NangongEvolutionState {
    try {
      const raw = JSON.parse(readFileSync(this.#filePath, "utf8")) as Omit<Partial<NangongEvolutionState>, "version"> & { version?: number; automaticApprovalEnabled?: boolean };
      if ((raw.version === 1 || raw.version === 2 || raw.version === 3 || raw.version === 4 || raw.version === 5 || raw.version === 6 || raw.version === 7) && Array.isArray(raw.topics) && Array.isArray(raw.proposals)) {
        const value = raw as NangongEvolutionState;
        const legacy = raw;
        value.version = 7;
        value.automaticNangongApprovalEnabled ??= legacy.automaticApprovalEnabled === true;
        value.automaticLinghuApprovalEnabled ??= false;
        value.conversation ??= createConversation();
        value.automationSettings ??= { maxRoundsPerTopic: 5, maxCorrectionRounds: 5 };
        value.automationRuntime ??= { status: value.automaticEvolutionEnabled ? "running" : "idle", completedRounds: 0, correctionRounds: 0, stopReason: null, startedAt: null, pausedAt: null };
        value.automationContext ??= { workspaceState: null, locale: "zh-CN" };
        value.deliberations ??= [];
        value.archiveRecords ??= [];
        // 旧状态即使尚未生成提案，也必须获得首个课题修订号才能安全编辑。
        for (const topic of value.topics) {
          topic.topicRevision ??= 1;
          topic.continuationOfTopicId ??= null;
          topic.nextTopicId ??= null;
          topic.seriesId ??= topic.continuationOfTopicId || topic.topicId;
          topic.roundNumber ??= 1;
          topic.deliberationId ??= null;
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
            approval.stage ??= "direction";
          }
        }
        return value;
      }
    } catch { /* 首次启动或损坏状态使用安全关闭的空状态，历史文件不会被扫描猜测。 */ }
    return { version: 7, automaticEvolutionEnabled: false, automaticNangongApprovalEnabled: false, automaticLinghuApprovalEnabled: false, automaticExecutionEnabled: false, automationSettings: { maxRoundsPerTopic: 5, maxCorrectionRounds: 5 }, automationRuntime: { status: "idle", completedRounds: 0, correctionRounds: 0, stopReason: null, startedAt: null, pausedAt: null }, automationContext: { workspaceState: null, locale: "zh-CN" }, preferenceSnapshotVersion: 0, activeTopicId: null, topics: [], proposals: [], deliberations: [], archiveRecords: [], conversation: createConversation(), updatedAt: new Date().toISOString() };
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
function normalizeCandidate(candidate: HanLiTopicCandidate): HanLiTopicCandidate {
  return {
    title: required(candidate.title, "演进专项标题", 160), goal: required(candidate.goal, "演进专项目标", 8_000),
    scope: normalizedList(candidate.scope, "演进专项范围"), exclusions: normalizedOptionalList(candidate.exclusions),
    evidence: normalizedList(candidate.evidence, "演进专项证据"), acceptanceCriteria: normalizedList(candidate.acceptanceCriteria, "演进专项验收条件"),
    establishmentReason: required(candidate.establishmentReason, "韩立确立理由", 8_000),
  };
}
function normalizeDistributionUnits(values: CreateEvolutionProposalRequest["distributionUnits"], topic: NangongEvolutionState["topics"][number]): EvolutionProposal["distributionUnits"] {
  const units = Array.isArray(values) ? values.map((item) => ({ title: item.title?.trim(), scope: item.scope?.trim(), acceptanceCriteria: normalizedOptionalList(item.acceptanceCriteria) })).filter((item) => item.title && item.scope && item.acceptanceCriteria.length) : [];
  return units.length ? units : topic.scope.map((scope) => ({ title: `${topic.title} · ${scope}`, scope, acceptanceCriteria: [...topic.acceptanceCriteria] }));
}
function normalizeRevisedDistributionUnits(previous: EvolutionProposal, request: ReviseEvolutionProposalRequest): EvolutionProposal["distributionUnits"] {
  return normalizedList(request.impactScope, "修订影响范围").map((scope) => ({ title: `${previous.title} · v${previous.version + 1} · ${scope}`, scope, acceptanceCriteria: normalizedList(request.acceptanceCriteria, "修订验收条件") }));
}
function requireTopic(state: NangongEvolutionState, topicId: string) { const topic = state.topics.find((item) => item.topicId === topicId); if (!topic) throw new Error("专项课题不存在。"); return topic; }
function requireProposal(state: NangongEvolutionState, proposalId: string) { const proposal = state.proposals.find((item) => item.proposalId === proposalId); if (!proposal) throw new Error("演化提案不存在。"); return proposal; }
function requireDeliberation(state: NangongEvolutionState, deliberationId: string) { const deliberation = state.deliberations.find((item) => item.deliberationId === deliberationId); if (!deliberation) throw new Error("韩立专题研讨不存在。"); return deliberation; }
function requireDeliberationRound(deliberation: NangongEvolutionState["deliberations"][number], roundId: string) { const round = deliberation.rounds.find((item) => item.roundId === roundId); if (!round) throw new Error("韩立专题研讨轮次不存在。"); return round; }
function assertTopicEditableBeforeProposal(state: NangongEvolutionState, topic: NangongEvolutionState["topics"][number]): void {
  if (!["registered", "investigating"].includes(topic.status) || topic.currentProposalVersion !== 0 || state.proposals.some((item) => item.topicId === topic.topicId)) {
    throw new Error("课题已进入提案流程，不能再修改或重复提交提案。");
  }
}
function createConversation(): NangongEvolutionState["conversation"] { const now = new Date().toISOString(); return { conversationId: `nangong-conversation-${randomUUID()}`, messages: [], updatedAt: now }; }

function archiveCategory(reason: string): EvolutionArchiveCategory {
  if (reason.startsWith("deliberation.")) return "deliberation";
  if (reason.includes("distributed")) return "distribution";
  if (reason.includes("result_decided")) return "acceptance";
  if (reason.includes("decided")) return "approval";
  if (reason.includes("progress")) return "execution";
  if (reason.startsWith("proposal.")) return "proposal";
  if (reason.includes("recovery") || reason.includes("blocked")) return "recovery";
  return "topic";
}

function archiveActor(reason: string): EvolutionArchiveActor {
  if (reason.includes("nangong_answered") || reason.includes("proposal.created") || reason.includes("distributed")) return "nangong-wan";
  if (reason.startsWith("deliberation.") || reason.includes("established_from_deliberation") || reason.includes("proposal.decided") || reason.includes("result_decided")) return "han-li";
  if (reason.startsWith("linghu.")) return "linghu-ancestor";
  return "system";
}

function archiveTitle(reason: string): string {
  const titles: Record<string, string> = {
    "deliberation.started": "韩立综合对话库并提出首个问题",
    "deliberation.nangong_answered": "南宫婉回答韩立问题",
    "deliberation.follow_up_planned": "韩立判断并形成下一轮追问",
    "deliberation.topic_ready": "韩立确认研讨已经足以确立专项",
    "deliberation.blocked": "韩立在研讨上限处保留证据缺口并阻断",
    "topic.established_from_deliberation": "南宫婉按韩立通知登记专题池",
    "proposal.created": "南宫婉拆解并提交实施方案",
    "proposal.decided": "韩立完成方向审批",
    "proposal.distributed": "南宫婉分发实施任务",
    "proposal.progress_reconciled": "专题执行状态更新",
    "proposal.result_decided": "韩立完成实施结果验收",
  };
  return titles[reason] || reason;
}

function archivePayload(topic: NangongEvolutionState["topics"][number] | null, proposal: EvolutionProposal | null, deliberation: NangongEvolutionState["deliberations"][number] | null): Record<string, unknown> {
  const round = deliberation?.rounds.at(-1);
  return {
    topic: topic ? { topicId: topic.topicId, title: topic.title, status: topic.status, recoveryPoint: topic.recoveryPoint, roundNumber: topic.roundNumber } : null,
    proposal: proposal ? { proposalId: proposal.proposalId, version: proposal.version, status: proposal.status, distributedTaskIds: proposal.distributedTaskIds, resultSummary: proposal.resultSummary } : null,
    deliberation: deliberation ? { deliberationId: deliberation.deliberationId, status: deliberation.status, sourceSnapshotCount: deliberation.sourceSnapshots.length, roundCount: deliberation.rounds.length, latestRound: round || null, candidate: deliberation.candidate } : null,
  };
}
