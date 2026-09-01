import { randomUUID } from "node:crypto";

import type { CreateLinghuRepairProposalOutDto } from "../../../../contracts/services/personas/linghu/index.js";
import type { EvolutionApprovalOutDto, EvolutionApprovalDecisionValue, EvolutionApprovalSourceValue, EvolutionArchiveActorValue, EvolutionArchiveCategoryValue, EvolutionDistributionPlanOutDto, EvolutionFeedbackTargetValue, EvolutionOneShotPhaseValue, EvolutionProposalOutDto, EvolutionSourceMessageSnapshotOutDto, EvolutionStateOutDto } from "../../../../contracts/services/evolution/index.js";
import type { HanliAcceptancePlanOutDto, HanliAcceptanceRunOutDto, HanliTopicCandidateOutDto } from "../../../../contracts/services/personas/hanli/index.js";
import type { ConvertNangongConversationToTopicInDto, CreateNangongProposalInDto, CreateNangongTopicInDto, ReviseNangongProposalInDto, UpdateNangongTopicInDto } from "../../../../contracts/services/personas/nangong/index.js";
import type { ConfigurePersonaWorkflowInDto, PersonaWorkflowActionInDto } from "../../../../contracts/services/workflow/index.js";
import type { EvolutionStatePersistence } from "./evolution-state.repository.js";

type StateListener = (state: EvolutionStateOutDto, reason: string, topicId: string | null, proposalId: string | null, previousState: EvolutionStateOutDto) => void;

/**
 * Evolution 共同状态的唯一写入者。
 *
 * 业务含义：专题、提案、审批、验收和跨人物运行事实都属于共同演化生命周期，
 * 不能继续归属南宫婉，也不能由三个人物各保存一份。
 */
export class EvolutionStateStore {
  readonly #repository: EvolutionStatePersistence;
  readonly #listeners = new Set<StateListener>();
  #state: EvolutionStateOutDto;

  constructor(repository: EvolutionStatePersistence) {
    this.#repository = repository;
    this.#state = this.#load();
  }

  state(): EvolutionStateOutDto { return structuredClone(this.#state); }
  subscribe(listener: StateListener): () => void { this.#listeners.add(listener); return () => this.#listeners.delete(listener); }

  /** 清除专题测试运行态并安全关闭自动流程，保留人物完整对话、训练意图、轮次上限与语言；返回被移除的业务记录数。示例：1 个专题、2 个提案返回 3；写入失败时抛错。 */
  clearTestData(): number {
    const previousState = this.state();
    const clearedCount = this.#state.topics.length + this.#state.proposals.length + this.#state.deliberations.length + this.#state.archiveRecords.length;
    const next = createInitialState();
    next.automationSettings = structuredClone(this.#state.automationSettings);
    next.automationContext.locale = this.#state.automationContext.locale;
    // 人物原话与已登记意图是韩立训练语料，不属于可重建测试运行态。
    next.conversation = structuredClone(this.#state.conversation);
    this.#write(next);
    this.#state = next;
    const snapshot = this.state();
    for (const listener of this.#listeners) listener(snapshot, "test-data.cleared", null, null, previousState);
    return clearedCount;
  }

  /**
   * 作用：确认一键清空已经同时落到内存和 SQLite，而不是只清理页面投影。
   * 真实传参示例：清空完成后调用，无需额外参数。
   * 真实返回示例：运行态、专题、提案和确认均为空时正常返回。
   * 异常或副作用示例：数据库仍残留 running 或业务记录时抛错并阻止应用按成功结果重启。
   */
  assertTestDataCleared(): void {
    const persisted = this.#repository.load();
    const states = [this.#state, persisted].filter((item): item is EvolutionStateOutDto => Boolean(item));
    if (states.some((state) => state.oneShotRun !== null
      || state.oneShotConfirmation !== null
      || state.activeTopicId !== null
      || state.topics.length > 0
      || state.proposals.length > 0
      || state.deliberations.length > 0
      || state.archiveRecords.length > 0)) {
      throw new Error("测试数据清空后仍检测到专题演化运行记录，已阻止按成功结果重启。");
    }
  }

  setAutomation(kind: "evolution" | "nangong-approval" | "linghu-approval" | "execution", enabled: boolean): EvolutionStateOutDto {
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

  configureAutomation(request: ConfigurePersonaWorkflowInDto): EvolutionStateOutDto {
    const maximum = request.maxRoundsPerTopic;
    if (maximum !== null && (!Number.isInteger(maximum) || maximum < 1 || maximum > 100)) throw new Error("专题研讨轮次必须为 1 至 100，或选择无限模式。");
    if (!Number.isInteger(request.maxCorrectionRounds) || request.maxCorrectionRounds < 1 || request.maxCorrectionRounds > 20) throw new Error("纠偏轮次必须为 1 至 20。");
    return this.#commit("automation.configured", null, null, (state) => {
      state.automationSettings = { maxRoundsPerTopic: maximum, maxCorrectionRounds: request.maxCorrectionRounds };
      if (request.workspaceState) state.automationContext.workspaceState = structuredClone(request.workspaceState);
      if (request.locale) state.automationContext.locale = request.locale;
    });
  }

  controlAutomation(action: PersonaWorkflowActionInDto): EvolutionStateOutDto {
    return this.#commit(`automation.${action}`, null, null, (state) => {
      const now = new Date().toISOString();
      if (action === "start" || action === "resume") {
        state.automaticEvolutionEnabled = true;
        state.automationRuntime.status = "running";
        state.automationRuntime.startedAt ??= now;
        state.automationRuntime.pausedAt = null;
        state.automationRuntime.stopReason = null;
      } else if (action === "pause" || action === "handover") {
        state.automaticEvolutionEnabled = false;
        state.automationRuntime.status = "paused";
        state.automationRuntime.pausedAt = now;
        state.automationRuntime.stopReason = action === "handover" ? "当前专题已转入人工接管，自动控制台仅观察；明确恢复后才会继续推进。" : null;
      } else {
        state.automaticEvolutionEnabled = false;
        state.automationRuntime.status = "stopped";
        state.automationRuntime.stopReason = "韩立手动停止自动演化。";
        state.automationRuntime.pausedAt = null;
      }
    });
  }

  /**
   * 作用：为当前一次用户确认建立独立运行实例，不改写长期自动化开关。
   * 真实传参示例：workspaceState=SELPLAT 工作区、locale=zh-CN，返回 phase=preparing-topic。
   * 真实返回示例：oneShotRun.actor=nangong-wan，界面显示“南宫婉正在整理演化课题”。
   * 异常或副作用示例：已有未结束的一次性运行时拒绝重复建立；成功后原子保存运行状态。
   */
  beginOneShotRun(workspaceState: EvolutionStateOutDto["automationContext"]["workspaceState"], locale: EvolutionStateOutDto["automationContext"]["locale"]): EvolutionStateOutDto {
    if (!workspaceState?.roots?.length) throw new Error("一次性演化必须先登记实施工作区。");
    if (this.#state.oneShotRun?.status === "running") throw new Error("当前已有一次性演化正在运行，请勿重复启动。");
    const now = new Date().toISOString();
    return this.#commit("one-shot.started", null, null, (state) => {
      state.automationContext = { workspaceState: structuredClone(workspaceState), locale };
      state.oneShotConfirmation = null;
      state.oneShotRun = { runId: `evolution-one-shot-${randomUUID()}`, topicId: null, proposalId: null, status: "running", phase: "preparing-topic", actor: "nangong-wan", actorName: "南宫婉", action: "正在根据当前对话整理演化课题", blockingReason: null, startedAt: now, updatedAt: now, completedAt: null };
    });
  }

  /** 更新一次性运行的人物、阶段和动作；专题档案使用同一条状态事实，不创建旁路流程。 */
  updateOneShotRun(phase: EvolutionOneShotPhaseValue, actor: EvolutionArchiveActorValue, actorName: string, action: string, topicId?: string | null, proposalId?: string | null): EvolutionStateOutDto {
    const current = this.#state.oneShotRun;
    if (!current || current.status !== "running") return this.state();
    const resolvedTopicId = topicId === undefined ? current.topicId : topicId;
    const resolvedProposalId = proposalId === undefined ? current.proposalId : proposalId;
    const now = new Date().toISOString();
    return this.#commit("one-shot.activity", resolvedTopicId || null, resolvedProposalId || null, (state) => {
      const run = state.oneShotRun;
      if (!run || run.status !== "running") return;
      run.topicId = resolvedTopicId || null;
      run.proposalId = resolvedProposalId || null;
      run.phase = phase;
      run.actor = actor;
      run.actorName = required(actorName, "一次性运行当前人物", 160);
      run.action = required(action, "一次性运行当前动作", 2_000);
      run.blockingReason = null;
      run.updatedAt = now;
    }, { phase, actor, actorName, action, status: "running", nextOwner: actorName });
  }

  finishOneShotRun(): EvolutionStateOutDto {
    const current = this.#state.oneShotRun;
    if (!current || current.status !== "running") return this.state();
    const now = new Date().toISOString();
    return this.#commit("one-shot.completed", current.topicId, current.proposalId, (state) => {
      const run = state.oneShotRun!;
      run.status = "completed";
      run.phase = "completed";
      run.actor = "nangong-wan";
      run.actorName = "南宫婉";
      run.action = "本轮演化已经完成并归档";
      run.blockingReason = null;
      run.updatedAt = now;
      run.completedAt = now;
    }, { phase: "completed", actor: "nangong-wan", status: "completed", nextOwner: "user" });
  }

  blockOneShotRun(reason: string): EvolutionStateOutDto {
    const current = this.#state.oneShotRun;
    if (!current || current.status !== "running") return this.state();
    const now = new Date().toISOString();
    return this.#commit("one-shot.blocked", current.topicId, current.proposalId, (state) => {
      const run = state.oneShotRun!;
      run.status = "blocked";
      run.phase = "blocked";
      run.actor = "system";
      run.actorName = "系统";
      run.action = "等待处理无法自动完成的阻塞";
      run.blockingReason = required(reason, "一次性运行阻塞原因", 8_000);
      run.updatedAt = now;
      run.completedAt = now;
    }, { phase: "blocked", actor: "system", status: "blocked", blockingReason: reason, nextOwner: "user" });
  }

  /** 把没有真实执行者或任务的遗留 running 状态终止为可审计事实，允许新的用户确认继续。 */
  retireOrphanedOneShotRun(reason: string): EvolutionStateOutDto {
    const current = this.#state.oneShotRun;
    if (!current || current.status !== "running") return this.state();
    const now = new Date().toISOString();
    return this.#commit("one-shot.orphan-retired", current.topicId, current.proposalId, (state) => {
      const run = state.oneShotRun!;
      run.status = "blocked";
      run.phase = "blocked";
      run.actor = "system";
      run.actorName = "系统";
      run.action = "上一轮遗留运行状态已结束";
      run.blockingReason = required(reason, "遗留运行状态结束原因", 8_000);
      run.updatedAt = now;
      run.completedAt = now;
    }, { phase: "blocked", actor: "system", status: "blocked", blockingReason: reason, nextOwner: "user" });
  }

  /**
   * 作用：从已持久化的一次性流程卡点原位恢复，不改变长期自动开关，也不新建专题或提案。
   * 真实传参示例：当前 run.status=blocked、proposalId 指向待补充提案，返回同一 runId 的 running 状态。
   * 真实返回示例：界面显示“南宫婉正在重新调查韩立退回项”，后续状态机沿原专题继续。
   * 异常或副作用示例：没有可恢复卡点时拒绝；成功后清除旧阻塞原因但保留全部审批和版本记录。
   */
  resumeOneShotRun(): EvolutionStateOutDto {
    const current = this.#state.oneShotRun;
    if (!current || current.status !== "blocked" || !current.topicId || !current.proposalId) throw new Error("当前没有可原位恢复的一次性演化卡点。");
    const proposal = requireProposal(this.#state, current.proposalId);
    if (!["supplement-required", "rejected", "blocked"].includes(proposal.status)) throw new Error("当前提案状态不允许从调查修订点恢复。");
    const now = new Date().toISOString();
    return this.#commit("one-shot.resumed", current.topicId, current.proposalId, (state) => {
      const run = state.oneShotRun!;
      run.status = "running";
      run.phase = "revising";
      run.actor = "nangong-wan";
      run.actorName = "南宫婉";
      run.action = "正在重新调查韩立退回项并核对可验证的新事实";
      run.blockingReason = null;
      run.updatedAt = now;
      run.completedAt = null;
    }, { phase: "revising", actor: "nangong-wan", status: "running", nextOwner: "nangong-wan" });
  }

  createTopic(request: CreateNangongTopicInDto, sourceConversationMessageIds: string[] = []): EvolutionStateOutDto {
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
  beginDeliberation(deliberationId: string, snapshots: EvolutionSourceMessageSnapshotOutDto[], question: string, questionReason: string): EvolutionStateOutDto {
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

  recordDeliberationAnswer(deliberationId: string, roundId: string, answer: string): EvolutionStateOutDto {
    return this.#commit("deliberation.nangong_answered", null, null, (state) => {
      const deliberation = requireDeliberation(state, deliberationId);
      const round = requireDeliberationRound(deliberation, roundId);
      if (round.answer !== null) return;
      round.answer = required(answer, "南宫婉回答", 60_000);
      round.answeredAt = new Date().toISOString();
      deliberation.updatedAt = round.answeredAt;
    });
  }

  assessDeliberation(deliberationId: string, roundId: string, assessment: string, nextQuestion: { question: string; reason: string } | null, candidate: HanliTopicCandidateOutDto | null): EvolutionStateOutDto {
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

  blockDeliberation(deliberationId: string, roundId: string, assessment: string, reason: string): EvolutionStateOutDto {
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
  establishDeliberationTopic(deliberationId: string): EvolutionStateOutDto {
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

  createProposal(topicId: string, request: CreateNangongProposalInDto): EvolutionStateOutDto {
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
        distributionPlan: null, status: "pending-approval",
        approvals: [], distributedTaskIds: [], resultSummary: null, createdAt: now, updatedAt: now,
      });
    });
  }

  updateTopic(topicId: string, request: UpdateNangongTopicInDto): EvolutionStateOutDto {
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

  appendConversation(role: "user" | "nangong", content: string, attachmentIds: string[] = [], options: { messageId?: string; replyToMessageId?: string | null; deliveryStatus?: "sending" | "completed" | "failed" } = {}): EvolutionStateOutDto {
    const messageId = options.messageId || `evolution-message-${randomUUID()}`;
    const now = new Date().toISOString();
    return this.#commit("conversation.message_added", null, null, (state) => {
      if (state.conversation.messages.some((message) => message.messageId === messageId)) throw new Error("会话消息标识已存在，不能重复发送。");
      const replyToMessageId = options.replyToMessageId === undefined && role === "nangong"
        ? [...state.conversation.messages].reverse().find((message) => message.role === "user")?.messageId || null
        : options.replyToMessageId || null;
      const deliveryStatus = options.deliveryStatus || "completed";
      state.conversation.messages.push({
        messageId, sequenceNumber: state.conversation.messages.length, role,
        content: required(content, "对话内容", 30_000), replyToMessageId, deliveryStatus,
        attachmentIds: [...new Set(attachmentIds)].slice(0, 5), createdAt: now,
        completedAt: deliveryStatus === "sending" ? null : now,
      });
      state.conversation.updatedAt = now;
    });
  }

  /** 用户消息先进入运行态时间线；人物回复完成后原子结束用户消息并向后追加回复。 */
  completeConversationTurn(userMessageId: string, content: string): EvolutionStateOutDto {
    const now = new Date().toISOString();
    return this.#commit("conversation.turn_completed", null, null, (state) => {
      const userMessage = state.conversation.messages.find((message) => message.messageId === userMessageId && message.role === "user");
      if (!userMessage) throw new Error("待完成的用户会话消息不存在。");
      if (userMessage.deliveryStatus === "failed") throw new Error("发送失败的用户消息不能追加人物回复。");
      userMessage.deliveryStatus = "completed";
      userMessage.completedAt = now;
      state.conversation.messages.push({
        messageId: `evolution-message-${randomUUID()}`, sequenceNumber: state.conversation.messages.length,
        role: "nangong", content: required(content, "南宫婉回复", 30_000), replyToMessageId: userMessageId,
        deliveryStatus: "completed", attachmentIds: [], createdAt: now, completedAt: now,
      });
      state.conversation.updatedAt = now;
    });
  }

  /** 发送失败只改变原用户消息状态，禁止生成一条脱离原位置的错误消息。 */
  failConversationTurn(userMessageId: string): EvolutionStateOutDto {
    const now = new Date().toISOString();
    return this.#commit("conversation.turn_failed", null, null, (state) => {
      const userMessage = state.conversation.messages.find((message) => message.messageId === userMessageId && message.role === "user");
      if (!userMessage) throw new Error("待标记失败的用户会话消息不存在。");
      userMessage.deliveryStatus = "failed";
      userMessage.completedAt = now;
      state.conversation.updatedAt = now;
    });
  }

  /** 把南宫婉正文中的明确邀请登记为可恢复事实；传入 null 表示最新回答尚未具备启动条件。 */
  setOneShotConfirmation(invitationMessageId: string | null): EvolutionStateOutDto {
    const message = invitationMessageId
      ? this.#state.conversation.messages.find((item) => item.messageId === invitationMessageId && item.role === "nangong")
      : null;
    if (invitationMessageId && !message) throw new Error("一次性演化邀请消息不存在。");
    return this.#commit("conversation.one-shot-confirmation-changed", null, null, (state) => {
      state.oneShotConfirmation = message
        ? { conversationId: state.conversation.conversationId, invitationMessageId: message.messageId, status: "awaiting-user-confirmation", createdAt: message.createdAt }
        : null;
    });
  }

  recordConversationIntent(messageId: string, inferredIntent: string): EvolutionStateOutDto {
    const now = new Date().toISOString();
    return this.#commit("conversation.intent_recorded", null, null, (state) => {
      const message = state.conversation.messages.find((item) => item.messageId === messageId && item.role === "user");
      if (!message) throw new Error("需要登记意图的用户消息不存在。");
      message.inferredIntent = required(inferredIntent, "用户意图摘要", 2_000);
      state.conversation.updatedAt = now;
    });
  }

  /** 专题群只追加人物消息引用与短预览，完整原话继续由人物会话表权威保存。 */
  recordTopicConversation(topicId: string, userMessageId: string, nangongMessageId: string): EvolutionStateOutDto {
    const topic = requireTopic(this.#state, topicId);
    const userMessage = this.#state.conversation.messages.find((item) => item.messageId === userMessageId && item.role === "user");
    const nangongMessage = this.#state.conversation.messages.find((item) => item.messageId === nangongMessageId && item.role === "nangong");
    if (!userMessage || !nangongMessage) throw new Error("专题群人物消息不完整，不能登记回流记录。");
    return this.#commit("conversation.topic_group_replied", topic.topicId, null, () => undefined, {
      conversationId: this.#state.conversation.conversationId,
      userMessageId, userPreview: preview(userMessage.content), nangongMessageId, nangongPreview: preview(nangongMessage.content),
      status: "replied", nextOwner: "han-li",
    });
  }

  /** 验收计划作为专题档案事实保存，不改变提案状态，也不伪装成已经执行的验收结果。 */
  recordAcceptancePlan(plan: HanliAcceptancePlanOutDto): EvolutionStateOutDto {
    const proposal = requireProposal(this.#state, plan.proposalId);
    if (proposal.topicId !== plan.topicId) throw new Error("验收计划与专题不一致。 ");
    return this.#commit("acceptance.plan_generated", plan.topicId, plan.proposalId, () => undefined, { acceptancePlan: structuredClone(plan), status: "planned", nextOwner: "han-li" });
  }

  /** 真实应用操作证据与计划分开追加，失败事实交由后续结果线路处理。 */
  recordAcceptanceRun(run: HanliAcceptanceRunOutDto): EvolutionStateOutDto {
    const proposal = requireProposal(this.#state, run.proposalId);
    if (proposal.topicId !== run.topicId) throw new Error("真实验收记录与专题不一致。 ");
    return this.#commit("acceptance.real_app_checked", run.topicId, run.proposalId, () => undefined, { acceptanceRun: structuredClone(run), status: run.status, nextOwner: run.status === "passed" ? "han-li" : "nangong-wan" });
  }

  newConversation(): EvolutionStateOutDto {
    return this.#commit("conversation.created", null, null, (state) => {
      state.conversation = createConversation();
      state.oneShotConfirmation = null;
    });
  }

  convertConversationToTopic(request: ConvertNangongConversationToTopicInDto): EvolutionStateOutDto {
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

  createLinghuRepairProposal(request: CreateLinghuRepairProposalOutDto): EvolutionStateOutDto {
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
        distributionPlan: null,
        status: "pending-approval", approvals: [], distributedTaskIds: [], resultSummary: null, createdAt: now, updatedAt: now,
      });
      state.activeTopicId = topicId;
    });
  }

  decide(proposalId: string, decision: EvolutionApprovalDecisionValue, advice: string, source: EvolutionApprovalSourceValue, referencedApprovalIds: string[], feedbackTarget: EvolutionFeedbackTargetValue = "proposal-content", capabilityScope = ""): EvolutionStateOutDto {
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
      const approval: EvolutionApprovalOutDto = {
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
  decideResult(proposalId: string, decision: EvolutionApprovalDecisionValue, advice: string, source: EvolutionApprovalSourceValue = "manual-user"): EvolutionStateOutDto {
    const proposal = requireProposal(this.#state, proposalId);
    if (proposal.status !== "pending-acceptance") throw new Error("当前提案还没有进入结果验收状态。");
    const run = [...this.#state.archiveRecords].reverse().find((record) => record.proposalId === proposalId && record.eventType === "acceptance.real_app_checked")?.payload.acceptanceRun as HanliAcceptanceRunOutDto | undefined;
    if (decision === "approved" && run?.status !== "passed") throw new Error("韩立必须先完成真实应用检查且全部通过，才能验收通过。 ");
    const plan = run ? [...this.#state.archiveRecords].reverse().find((record) => record.eventType === "acceptance.plan_generated" && (record.payload.acceptancePlan as { planId?: string } | undefined)?.planId === run.planId)?.payload.acceptancePlan as HanliAcceptancePlanOutDto | undefined : undefined;
    const failureEvidence = decision === "approved" || !run ? [] : run.stepResults.filter((step) => step.status !== "passed").map((step) => {
      const check = plan?.checks.find((item) => item.checkId === step.checkId);
      return {
        evidenceId: `acceptance-failure-${run.runId}-${step.checkId}-${step.operationIndex}`,
        runId: run.runId,
        planId: run.planId,
        checkId: step.checkId,
        target: check?.target || "真实应用界面",
        severity: step.status === "blocked" ? "blocking" : "major",
        reproductionOperations: check?.operations ? structuredClone(check.operations.slice(0, step.operationIndex + 1)) : [structuredClone(step.operation)],
        actual: step.actual,
        expected: check?.expected || "符合专题验收条件",
        screenshotAttachmentIds: [...new Set([step.screenshotAttachmentId, ...run.evidenceAttachmentIds].filter((item): item is string => Boolean(item)))],
      };
    });
    const now = new Date().toISOString();
    const priorFailureRecord = decision === "approved" && proposal.supersedesProposalId ? [...this.#state.archiveRecords].reverse().find((record) => record.proposalId === proposal.supersedesProposalId && record.eventType === "proposal.result_decided" && Array.isArray(record.payload.failureEvidence) && record.payload.failureEvidence.length > 0) : undefined;
    const priorFailures = priorFailureRecord?.payload.failureEvidence as Array<{ evidenceId: string; runId: string; target: string; expected: string }> | undefined;
    const experienceCandidate = run?.status === "passed" && proposal.supersedesProposalId && priorFailures?.length ? {
      candidateId: `acceptance-experience-${randomUUID()}`,
      status: "candidate" as const,
      title: `检查 ${priorFailures[0].target} 是否达到“${priorFailures[0].expected}”`,
      applicableScope: [...new Set(priorFailures.map((item) => item.target))],
      sourceFailureEvidenceIds: priorFailures.map((item) => item.evidenceId),
      failedProposalId: proposal.supersedesProposalId,
      correctionProposalId: proposal.proposalId,
      failedRunId: priorFailures[0].runId,
      passedRetestRunId: run.runId,
      counterexampleCount: 0,
      createdAt: now,
    } : null;
    return this.#commit("proposal.result_decided", proposal.topicId, proposalId, (state) => {
      const mutable = requireProposal(state, proposalId);
      if (source === "manual-user") state.preferenceSnapshotVersion += 1;
      mutable.approvals.push({
        approvalId: `evolution-approval-${randomUUID()}`, proposalId, decision, source, stage: "result",
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
        if (state.automationRuntime.correctionRounds >= state.automationSettings.maxCorrectionRounds && state.oneShotRun?.status !== "running") {
          state.automaticEvolutionEnabled = false;
          state.automationRuntime.status = "blocked";
          state.automationRuntime.stopReason = `结果纠偏达到 ${state.automationSettings.maxCorrectionRounds} 轮，等待韩立调整方向。`;
        }
      }
      mutable.updatedAt = now;
      topic.updatedAt = now;
    }, { acceptanceRunId: run?.runId || null, failureEvidence, experienceCandidate, nextOwner: decision === "approved" ? "han-li" : proposal.submitterMemberId });
  }

  /** 原提交人只能修订退回的本人提案；新版本保留原审批、反馈目标和完整替代链。 */
  revise(proposalId: string, request: ReviseNangongProposalInDto, submitterDisplayName: string): EvolutionStateOutDto {
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
        exclusions: request.exclusions === undefined ? [...previous.exclusions] : normalizedOptionalList(request.exclusions),
        risks: normalizedList(request.risks, "修订风险"),
        rollbackPlan: required(request.rollbackPlan, "修订回退方案", 8_000),
        acceptanceCriteria: normalizedList(request.acceptanceCriteria, "修订验收条件"),
        distributionPlan: null,
        status: "pending-approval",
        approvals: [], distributedTaskIds: [], resultSummary: null, createdAt: now, updatedAt: now,
      });
    });
  }

  markDispatched(proposalId: string, taskId: string): EvolutionStateOutDto {
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

  saveDistributionPlan(proposalId: string, plan: EvolutionDistributionPlanOutDto): EvolutionStateOutDto {
    const proposal = requireProposal(this.#state, proposalId);
    return this.#commit("proposal.distribution_planned", proposal.topicId, proposalId, (state) => {
      const mutable = requireProposal(state, proposalId);
      if (mutable.distributedTaskIds.length) throw new Error("已经分发的提案不能覆盖任务拆分计划。");
      mutable.distributionPlan = structuredClone(plan);
      mutable.updatedAt = new Date().toISOString();
    });
  }

  markProgress(proposalId: string, status: "executing" | "verifying" | "pending-acceptance" | "blocked", resultSummary: string): EvolutionStateOutDto {
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

  #commit(reason: string, topicId: string | null, proposalId: string | null, mutate: (state: EvolutionStateOutDto) => void, payloadExtra: Record<string, unknown> = {}): EvolutionStateOutDto {
    const previousState = this.state();
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
    if (topic || proposal || deliberation || reason === "one-shot.orphan-retired") next.archiveRecords.push({
      recordId: `evolution-archive-${randomUUID()}`,
      deliberationId: deliberation?.deliberationId || topic?.deliberationId || null,
      topicId: topicId || deliberation?.topicId || proposal?.topicId || null,
      proposalId,
      taskId: reason === "proposal.distributed" ? proposal?.distributedTaskIds.at(-1) || null : null,
      sequenceNumber: next.archiveRecords.length + 1,
      category: archiveCategory(reason),
      eventType: reason,
      actor: archiveActor(reason, payloadExtra),
      title: archiveTitle(reason),
      payload: { ...archivePayload(topic, proposal, deliberation), ...payloadExtra },
      occurredAt,
    });
    this.#write(next);
    this.#state = next;
    const snapshot = this.state();
    for (const listener of this.#listeners) listener(snapshot, reason, topicId, proposalId, previousState);
    return snapshot;
  }

  #load(): EvolutionStateOutDto {
    try {
      const raw = this.#repository.load() as Partial<EvolutionStateOutDto> | null;
      if (raw && raw.version === 8 && Array.isArray(raw.topics) && Array.isArray(raw.proposals) && Array.isArray(raw.deliberations)
        && Array.isArray(raw.archiveRecords) && raw.conversation && raw.automationSettings && raw.automationRuntime && raw.automationContext
        && typeof raw.automaticNangongApprovalEnabled === "boolean" && typeof raw.automaticLinghuApprovalEnabled === "boolean") {
        const migrated = migrateDistributionValidation(raw as EvolutionStateOutDto);
        if (migrated.changed) this.#repository.save(migrated.state);
        return migrated.state;
      }
    } catch { /* 损坏状态安全关闭；禁止扫描或恢复旧 JSON 文件。 */ }
    const initial = createInitialState();
    const conversation = this.#repository.loadLatestConversation();
    if (conversation) initial.conversation = conversation;
    return initial;
  }

  #write(state: EvolutionStateOutDto): void {
    this.#repository.save(state);
  }
}

/** 只迁移既有确定性校验事实的字段名，不保留或重新启用令狐常规分发审核入口。 */
function migrateDistributionValidation(state: EvolutionStateOutDto): { state: EvolutionStateOutDto; changed: boolean } {
  let changed = false;
  const proposals = state.proposals.map((proposal) => {
    const plan = proposal.distributionPlan as unknown as Record<string, unknown> | null;
    if (!plan || plan.validation) return proposal;
    const audit = plan.audit as { decision?: unknown; reason?: unknown; findings?: unknown; auditedAt?: unknown } | undefined;
    if (!audit) {
      changed = true;
      return { ...proposal, distributionPlan: null };
    }
    changed = true;
    const { audit: _retiredAudit, ...rest } = plan;
    return {
      ...proposal,
      distributionPlan: {
        ...rest,
        validation: {
          decision: audit.decision === "passed" ? "passed" : "revise",
          reason: typeof audit.reason === "string" ? audit.reason : "旧分发校验事实缺少说明。",
          findings: Array.isArray(audit.findings) ? audit.findings.filter((item): item is string => typeof item === "string") : [],
          validatedAt: typeof audit.auditedAt === "string" ? audit.auditedAt : proposal.updatedAt,
        },
      } as EvolutionStateOutDto["proposals"][number]["distributionPlan"],
    };
  });
  return { state: changed ? { ...state, proposals } : state, changed };
}

function createInitialState(): EvolutionStateOutDto {
  return { version: 8, automaticEvolutionEnabled: false, automaticNangongApprovalEnabled: false, automaticLinghuApprovalEnabled: false, automaticExecutionEnabled: false, automationSettings: { maxRoundsPerTopic: 5, maxCorrectionRounds: 5 }, automationRuntime: { status: "idle", completedRounds: 0, correctionRounds: 0, stopReason: null, startedAt: null, pausedAt: null }, oneShotConfirmation: null, oneShotRun: null, automationContext: { workspaceState: null, locale: "zh-CN" }, preferenceSnapshotVersion: 0, activeTopicId: null, topics: [], proposals: [], deliberations: [], archiveRecords: [], conversation: createConversation(), updatedAt: new Date().toISOString() };
}

function required(value: unknown, label: string, maximum: number): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new Error(`${label}不能为空。`);
  return text.slice(0, maximum);
}
function normalizedList(values: unknown, label: string): string[] { const result = normalizedOptionalList(values); if (!result.length) throw new Error(`${label}至少需要一项。`); return result; }
function normalizedOptionalList(values: unknown): string[] { return Array.isArray(values) ? [...new Set(values.map((item) => typeof item === "string" ? item.trim() : "").filter(Boolean))].slice(0, 100) : []; }
function preview(value: string): string { const characters = Array.from(value.trim()); return characters.length > 300 ? `${characters.slice(0, 300).join("")}…` : characters.join(""); }
function normalizeCandidate(candidate: HanliTopicCandidateOutDto): HanliTopicCandidateOutDto {
  return {
    title: required(candidate.title, "演进专项标题", 160), goal: required(candidate.goal, "演进专项目标", 8_000),
    scope: normalizedList(candidate.scope, "演进专项范围"), exclusions: normalizedOptionalList(candidate.exclusions),
    evidence: normalizedList(candidate.evidence, "演进专项证据"), acceptanceCriteria: normalizedList(candidate.acceptanceCriteria, "演进专项验收条件"),
    establishmentReason: required(candidate.establishmentReason, "韩立确立理由", 8_000),
  };
}
function requireTopic(state: EvolutionStateOutDto, topicId: string) { const topic = state.topics.find((item) => item.topicId === topicId); if (!topic) throw new Error("专项课题不存在。"); return topic; }
function requireProposal(state: EvolutionStateOutDto, proposalId: string) { const proposal = state.proposals.find((item) => item.proposalId === proposalId); if (!proposal) throw new Error("演化提案不存在。"); return proposal; }
function requireDeliberation(state: EvolutionStateOutDto, deliberationId: string) { const deliberation = state.deliberations.find((item) => item.deliberationId === deliberationId); if (!deliberation) throw new Error("韩立专题研讨不存在。"); return deliberation; }
function requireDeliberationRound(deliberation: EvolutionStateOutDto["deliberations"][number], roundId: string) { const round = deliberation.rounds.find((item) => item.roundId === roundId); if (!round) throw new Error("韩立专题研讨轮次不存在。"); return round; }
function assertTopicEditableBeforeProposal(state: EvolutionStateOutDto, topic: EvolutionStateOutDto["topics"][number]): void {
  if (!["registered", "investigating"].includes(topic.status) || topic.currentProposalVersion !== 0 || state.proposals.some((item) => item.topicId === topic.topicId)) {
    throw new Error("课题已进入提案流程，不能再修改或重复提交提案。");
  }
}
function createConversation(): EvolutionStateOutDto["conversation"] { const now = new Date().toISOString(); return { conversationId: `nangong-conversation-${randomUUID()}`, messages: [], updatedAt: now }; }

function archiveCategory(reason: string): EvolutionArchiveCategoryValue {
  if (reason.startsWith("one-shot.")) return reason.includes("blocked") || reason.includes("orphan-retired") ? "recovery" : reason.includes("completed") ? "acceptance" : "execution";
  if (reason === "conversation.topic_group_replied") return "source";
  if (reason.startsWith("deliberation.")) return "deliberation";
  if (reason.includes("distributed")) return "distribution";
  if (reason.includes("result_decided") || reason.startsWith("acceptance.")) return "acceptance";
  if (reason.includes("decided")) return "approval";
  if (reason.includes("progress")) return "execution";
  if (reason.startsWith("proposal.")) return "proposal";
  if (reason.includes("recovery") || reason.includes("blocked")) return "recovery";
  return "topic";
}

function archiveActor(reason: string, payload: Record<string, unknown>): EvolutionArchiveActorValue {
  if (reason.startsWith("one-shot.") && ["han-li", "nangong-wan", "codex", "linghu-ancestor", "system", "user"].includes(String(payload.actor))) return payload.actor as EvolutionArchiveActorValue;
  if (reason.startsWith("one-shot.")) return "system";
  if (reason.includes("nangong_answered") || reason.includes("proposal.created") || reason.includes("distributed")) return "nangong-wan";
  if (reason.startsWith("deliberation.") || reason.startsWith("acceptance.") || reason.includes("established_from_deliberation") || reason.includes("proposal.decided") || reason.includes("result_decided")) return "han-li";
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
    "acceptance.plan_generated": "韩立生成真实界面验收计划",
    "acceptance.real_app_checked": "韩立完成真实应用界面检查",
    "conversation.topic_group_replied": "专题群收到用户消息与南宫婉回复",
    "one-shot.activity": "一次性演化当前动作更新",
    "one-shot.completed": "一次性演化完整结束",
    "one-shot.blocked": "一次性演化遇到无法自动处理的阻塞",
    "one-shot.orphan-retired": "遗留的一次性演化运行状态已结束",
  };
  return titles[reason] || reason;
}

function archivePayload(topic: EvolutionStateOutDto["topics"][number] | null, proposal: EvolutionProposalOutDto | null, deliberation: EvolutionStateOutDto["deliberations"][number] | null): Record<string, unknown> {
  const round = deliberation?.rounds.at(-1);
  return {
    topic: topic ? { topicId: topic.topicId, title: topic.title, status: topic.status, recoveryPoint: topic.recoveryPoint, roundNumber: topic.roundNumber } : null,
    proposal: proposal ? { proposalId: proposal.proposalId, version: proposal.version, status: proposal.status, distributedTaskIds: proposal.distributedTaskIds, resultSummary: proposal.resultSummary } : null,
    deliberation: deliberation ? { deliberationId: deliberation.deliberationId, status: deliberation.status, sourceSnapshotCount: deliberation.sourceSnapshots.length, roundCount: deliberation.rounds.length, latestRound: round || null, candidate: deliberation.candidate } : null,
  };
}
