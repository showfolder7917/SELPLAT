import { randomUUID } from "node:crypto";

import type { EvolutionAcceptancePlanOutDto, EvolutionApprovalOutDto, EvolutionApprovalDecisionValue, EvolutionApprovalSourceValue, EvolutionArchiveActorValue, EvolutionArchiveCategoryValue, EvolutionDistributionPlanOutDto, EvolutionFeedbackTargetValue, EvolutionOneShotPhaseValue, EvolutionProposalOutDto, EvolutionSourceMessageSnapshotOutDto, EvolutionStateOutDto, EvolutionTechnicalRecoveryOutDto } from "../../../../contracts/services/evolution/index.js";
import { requiresPageAcceptanceEvidence, type HanliAcceptanceRunOutDto, type HanliTopicCandidateOutDto } from "../../../../contracts/services/personas/hanli/index.js";
import type { ConvertNangongConversationToTopicInDto, CreateNangongProposalInDto, CreateNangongTopicInDto, ReviseNangongProposalInDto, UpdateNangongTopicInDto } from "../../../../contracts/services/personas/nangong/index.js";
import type { ConfigurePersonaWorkflowInDto, PersonaWorkflowActionInDto } from "../../../../contracts/services/workflow/index.js";
import type { EvolutionStatePersistencePort } from "../evolution.persistence.port.js";

type StateListener = (state: EvolutionStateOutDto, reason: string, topicId: string | null, proposalId: string | null, previousState: EvolutionStateOutDto) => void;

/** 受控本地接收端已经核验的 Host 启动事实；Store 仍负责专题绑定和持久化门禁。 */
export interface HostStartupEvidenceInput {
  topicId: string;
  proposalId: string;
  launchId: string;
  handler: string;
  startedAt: string;
  commandLaunchId: string;
  commandState: "running" | "exited";
  exitCode: number | null;
  healthLaunchId: string;
  healthSuccess: boolean;
  healthCheckedAt: string;
  healthSummary: string;
  launcherSource: string | null;
  evidenceReferences: string[];
}

/** 监控者完成正式交付后，用一条状态提交建立等待真实验收的独立卡。 */
export interface CreateMonitorAcceptanceCardInput {
  title: string;
  goal: string;
  evidence: string[];
  acceptanceCriteria: string[];
  resultSummary: string;
  sourceRequestId?: string | null;
  retiredReason: string;
}

/**
 * Evolution 共同状态的唯一写入者。
 *
 * 业务含义：专题、提案、审批、验收和跨人物运行事实都属于共同演化生命周期，
 * 不能继续归属南宫婉，也不能由三个人物各保存一份。
 */
export class EvolutionStateStore {
  readonly #repository: EvolutionStatePersistencePort;
  readonly #listeners = new Set<StateListener>();
  #state: EvolutionStateOutDto;

  constructor(repository: EvolutionStatePersistencePort) {
    this.#repository = repository;
    this.#state = this.#load();
  }

  state(): EvolutionStateOutDto { return structuredClone(this.#state); }
  /** Workflow 在真实交接结果已知后提交技术卡点；同一 issueId 只累计原点复验未解的轮次。 */
  recordTechnicalRecovery(input: Omit<EvolutionTechnicalRecoveryOutDto, "updatedAt">): EvolutionStateOutDto {
    return this.#commit("technical-recovery.updated", input.topicId, input.proposalId, (state) => {
      state.technicalRecovery = { ...structuredClone(input), updatedAt: new Date().toISOString() };
    }, { technicalRecovery: input });
  }
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

  configureAutomation(request: ConfigurePersonaWorkflowInDto): EvolutionStateOutDto {
    const maximum = request.maxRoundsPerTopic;
    if (maximum !== null && (!Number.isInteger(maximum) || maximum < 1 || maximum > 100)) throw new Error("专题研讨轮次必须为 1 至 100，或选择无限模式。");
    if (!Number.isInteger(request.maxCorrectionRounds) || request.maxCorrectionRounds < 1 || request.maxCorrectionRounds > 20) throw new Error("纠偏轮次必须为 1 至 20。");
    return this.#commit("automation.configured", null, null, (state) => {
      if (request.automaticCustodyEnabled !== undefined && typeof request.automaticCustodyEnabled !== "boolean") throw new Error("自动托管开关必须为布尔值。");
      state.automationSettings = { maxRoundsPerTopic: maximum, maxCorrectionRounds: request.maxCorrectionRounds, automaticCustodyEnabled: request.automaticCustodyEnabled ?? state.automationSettings.automaticCustodyEnabled ?? false };
      if (request.workspaceState) state.automationContext.workspaceState = structuredClone(request.workspaceState);
      if (request.locale) state.automationContext.locale = request.locale;
    });
  }

  controlAutomation(action: PersonaWorkflowActionInDto): EvolutionStateOutDto {
    return this.#commit(`automation.${action}`, null, null, (state) => {
      const now = new Date().toISOString();
      if (action === "start" || action === "resume") {
        state.automationRuntime.status = "running";
        state.automationRuntime.startedAt ??= now;
        state.automationRuntime.pausedAt = null;
        state.automationRuntime.stopReason = null;
      } else if (action === "pause" || action === "handover") {
        state.automationRuntime.status = "paused";
        state.automationRuntime.pausedAt = now;
        state.automationRuntime.stopReason = action === "handover" ? "当前专题已转入人工接管，自动控制台仅观察；明确恢复后才会继续推进。" : null;
      } else {
        state.automationRuntime.status = "stopped";
        state.automationRuntime.stopReason = "韩立手动停止自动演化。";
        state.automationRuntime.pausedAt = null;
      }
    });
  }

  /**
   * 作用：为当前用户确认建立独立专题运行实例，并把统一自动流程置为运行态。
   * 真实传参示例：workspaceState=SELPLAT 工作区、locale=zh-CN，返回 phase=preparing-topic。
   * 真实返回示例：oneShotRun.actor=nangong-wan，界面显示“南宫婉正在整理演化课题”。
   * 异常或副作用示例：已有未结束的一次性运行时拒绝重复建立；成功后原子保存运行状态。
   */
  beginOneShotRun(workspaceState: EvolutionStateOutDto["automationContext"]["workspaceState"], locale: EvolutionStateOutDto["automationContext"]["locale"], sourceRequestId: string | null = null): EvolutionStateOutDto {
    if (!workspaceState?.roots?.length) throw new Error("一次性演化必须先登记实施工作区。");
    if (this.#state.oneShotRun?.status === "running") throw new Error("当前已有一次性演化正在运行，请勿重复启动。");
    if (this.#state.oneShotRun?.status === "blocked" && this.#state.oneShotRun.resumeMode !== null) {
      throw new Error("当前专题仍有可恢复卡点，请先从原任务继续；普通确认不能覆盖原专题、提案或冻结验收计划。");
    }
    const now = new Date().toISOString();
    return this.#commit("one-shot.started", null, null, (state) => {
      state.automationContext = { workspaceState: structuredClone(workspaceState), locale };
      state.automationRuntime.status = "running";
      state.automationRuntime.startedAt ??= now;
      state.automationRuntime.pausedAt = null;
      state.automationRuntime.stopReason = null;
      state.oneShotConfirmation = null;
      state.oneShotRun = { runId: `evolution-one-shot-${randomUUID()}`, sourceRequestId, topicId: null, proposalId: null, status: "running", phase: "preparing-topic", topicEstablishmentMode: "ordinary-deliberation", actor: "nangong-wan", actorName: "南宫婉", action: "正在根据当前对话整理演化课题", blockingReason: null, resumeMode: null, startedAt: now, updatedAt: now, completedAt: null };
    });
  }

  /** 更新一次性运行的人物、阶段和动作；专题档案使用同一条状态事实，不创建旁路流程。 */
  updateOneShotRun(phase: EvolutionOneShotPhaseValue, actor: EvolutionArchiveActorValue, actorName: string, action: string, topicId?: string | null, proposalId?: string | null): EvolutionStateOutDto {
    const current = this.#state.oneShotRun;
    if (!current || current.status !== "running") return this.state();
    const resolvedTopicId = topicId === undefined ? current.topicId : topicId;
    const resolvedProposalId = proposalId === undefined ? current.proposalId : proposalId;
    // 相同人物、阶段和动作没有形成新的业务事实，不更新时间或追加重复档案。
    if (current.phase === phase
      && current.actor === actor
      && current.actorName === actorName.trim()
      && current.action === action.trim()
      && current.topicId === (resolvedTopicId || null)
      && current.proposalId === (resolvedProposalId || null)
      && current.blockingReason === null) {
      return this.state();
    }
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
      // 恢复来源属于本次运行的上下文：完成态只读复核在结束或再次阻塞前必须保留，
      // 否则通用进度更新会让任务卡重新投影为“验证中”，污染韩立正在检查的完成态页面。
      // 新运行由 beginOneShotRun 明确初始化为 null，终态也由 finish/block 统一收口。
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
      run.resumeMode = null;
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
      run.resumeMode = "standard";
      run.updatedAt = now;
      run.completedAt = now;
      state.automationRuntime.status = "blocked";
      state.automationRuntime.stopReason = run.blockingReason;
    }, { phase: "blocked", actor: "system", status: "blocked", blockingReason: reason, nextOwner: "user" });
  }

  /** 已取消关联只结束旧运行并保留档案；它不是可由恢复入口再次推进的普通阻塞。 */
  retireCancelledOneShotRun(reason: string): EvolutionStateOutDto {
    const current = this.#state.oneShotRun;
    if (!current || !["running", "blocked"].includes(current.status)) return this.state();
    const now = new Date().toISOString();
    return this.#commit("one-shot.cancelled-chain-retired", current.topicId, current.proposalId, (state) => {
      const run = state.oneShotRun!;
      run.status = "blocked";
      run.phase = "blocked";
      run.actor = "system";
      run.actorName = "系统";
      run.action = "本专题已取消";
      run.blockingReason = required(reason, "已取消专题说明", 8_000);
      // null 明确表示不可恢复，而不是等待用户从旧卡继续。
      run.resumeMode = null;
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
      run.resumeMode = null;
      run.updatedAt = now;
      run.completedAt = now;
    }, { phase: "blocked", actor: "system", status: "blocked", blockingReason: reason, nextOwner: "user" });
  }

  /** 用户明确切换到独立专题时审计结束旧运行；不恢复或复用旧计划。 */
  retireOneShotRunForTopicSwitch(reason: string): EvolutionStateOutDto {
    const current = this.#state.oneShotRun;
    if (!current || !["running", "blocked"].includes(current.status)) return this.state();
    // 正常运行优先使用 oneShot 绑定；旧版或异常中断可能留下 topicId=null、activeTopicId 仍指向旧专题。
    // 明确切换时两种形态都必须收敛到同一个退役专题，不能让新运行继续扫描旧提案。
    const retiredTopicId = current.topicId || this.#state.activeTopicId;
    const now = new Date().toISOString();
    return this.#commit("one-shot.topic-switch-retired", retiredTopicId, current.proposalId, (state) => {
      const run = state.oneShotRun!;
      // 独立专题切换退役的是整条旧运行，而不只是 oneShot 指针。否则后台返修扫描仍会
      // 把旧 rejected/supplement-required 提案识别成可修订对象，并重新激活已经封存的专题。
      if (retiredTopicId) {
        const topic = state.topics.find((item) => item.topicId === retiredTopicId);
        if (topic && topic.status !== "completed") {
          topic.status = "rejected";
          topic.recoveryPoint = "topic-switch-retired";
          topic.updatedAt = now;
        }
        for (const proposal of state.proposals.filter((item) => item.topicId === retiredTopicId && item.status !== "completed")) {
          proposal.status = "rejected";
          proposal.resultSummary = required(reason, "独立专题切换原因", 8_000);
          proposal.updatedAt = now;
        }
      }
      // 新专题尚未建立前必须没有活动专题指针；否则下一次 tick 会把刚退役的 rejected 提案
      // 当作当前待返修对象，并把旧调查错误写进新 oneShot。
      state.activeTopicId = null;
      run.status = "blocked";
      run.phase = "blocked";
      run.actor = "user";
      run.actorName = "用户";
      run.action = "用户已明确切换到新的独立专题，旧运行不再接收新范围";
      run.blockingReason = required(reason, "独立专题切换原因", 8_000);
      run.resumeMode = null;
      run.updatedAt = now;
      run.completedAt = now;
    }, { phase: "blocked", actor: "user", status: "blocked", blockingReason: reason, nextOwner: "han-li" });
  }

  /**
   * 作用：在旧专题已经完成工作树审计退役后，原子撤销旧活动资格并建立独立专题运行。
   * 真实传参示例：sourceRequestId=新用户请求，返回 topicId=null、topicEstablishmentMode=independent-switch 的建立中运行。
   * 真实返回示例：旧专题和未完成提案进入审计状态，新运行显示“正在建立新专题”。
   * 异常或副作用示例：缺少工作区时抛错；不会恢复旧专题、旧提案或旧恢复入口。
   */
  switchToIndependentTopic(
    workspaceState: EvolutionStateOutDto["automationContext"]["workspaceState"],
    locale: EvolutionStateOutDto["automationContext"]["locale"],
    sourceRequestId: string,
    reason: string,
    retiredTaskIds: string[],
  ): EvolutionStateOutDto {
    if (!workspaceState?.roots?.length) throw new Error("独立专题切换必须先登记实施工作区。");
    const previousRun = this.#state.oneShotRun ? structuredClone(this.#state.oneShotRun) : null;
    const previousTopicId = previousRun?.topicId || this.#state.activeTopicId;
    const previousProposalIds = previousTopicId
      ? this.#state.proposals.filter((item) => item.topicId === previousTopicId).map((item) => item.proposalId)
      : [];
    const now = new Date().toISOString();
    return this.#commit("one-shot.independent-topic-switched", previousTopicId, previousRun?.proposalId || previousProposalIds.at(-1) || null, (state) => {
      if (previousTopicId) {
        const topic = state.topics.find((item) => item.topicId === previousTopicId);
        if (topic && topic.status !== "completed") {
          topic.status = "rejected";
          topic.recoveryPoint = "topic-switch-retired";
          topic.updatedAt = now;
        }
        for (const proposal of state.proposals.filter((item) => item.topicId === previousTopicId && item.status !== "completed")) {
          proposal.status = "rejected";
          proposal.resultSummary = required(reason, "独立专题切换原因", 8_000);
          proposal.updatedAt = now;
        }
      }
      state.activeTopicId = null;
      state.automationContext = { workspaceState: structuredClone(workspaceState), locale };
      state.automationRuntime.status = "running";
      state.automationRuntime.startedAt ??= now;
      state.automationRuntime.pausedAt = null;
      state.automationRuntime.stopReason = null;
      state.oneShotConfirmation = null;
      state.oneShotRun = {
        runId: `evolution-one-shot-${randomUUID()}`,
        sourceRequestId,
        topicId: null,
        proposalId: null,
        status: "running",
        phase: "preparing-topic",
        topicEstablishmentMode: "independent-switch",
        actor: "han-li",
        actorName: "韩立",
        action: "正在建立新的独立专题",
        blockingReason: null,
        resumeMode: null,
        startedAt: now,
        updatedAt: now,
        completedAt: null,
      };
    }, {
      retiredRun: previousRun,
      retiredTopicId: previousTopicId || null,
      retiredProposalIds: previousProposalIds,
      retiredTaskIds: [...retiredTaskIds],
      retiredReason: reason,
      nextOwner: "han-li",
    });
  }

  /**
   * 任务卡兜底入口只允许退役非当前专题；旧卡及其全部提案版本在一次状态提交中退出活动链。
   * 当前专题必须继续走既定人物流程，不能借此按钮绕过审批、测试或验收。
   */
  retireStaleTopic(topicId: string, proposalId: string, reason: string): EvolutionStateOutDto {
    const topic = requireTopic(this.#state, topicId);
    const proposal = requireProposal(this.#state, proposalId);
    if (proposal.topicId !== topic.topicId) throw new Error("旧任务卡的专题与提案不一致，请刷新后重试。");
    if (this.#state.activeTopicId === topic.topicId || this.#state.oneShotRun?.topicId === topic.topicId) {
      throw new Error("当前专题不能作为旧卡退役，请继续既定人物流程。");
    }
    if (["completed", "rejected"].includes(topic.status)) return this.state();
    const retiredReason = required(reason, "旧任务卡退役原因", 8_000);
    const now = new Date().toISOString();
    return this.#commit("topic.stale-retired", topic.topicId, proposal.proposalId, (state) => {
      const mutableTopic = requireTopic(state, topic.topicId);
      mutableTopic.status = "rejected";
      mutableTopic.recoveryPoint = "stale-topic-retired";
      mutableTopic.updatedAt = now;
      for (const item of state.proposals.filter((candidate) => candidate.topicId === topic.topicId && candidate.status !== "completed")) {
        item.status = "rejected";
        item.resultSummary = retiredReason;
        item.updatedAt = now;
      }
    }, { retiredReason, retiredProposalIds: this.#state.proposals.filter((item) => item.topicId === topic.topicId).map((item) => item.proposalId), nextOwner: "user" });
  }

  /**
   * 监控者交付正式版本后，在同一次 SQLite 状态提交中退役旧运行并建立待验收卡。
   * 真实验收运行和最终结论仍须经过 recordAcceptanceRun、decideResult；本入口不预写通过。
   */
  createMonitorAcceptanceCard(input: CreateMonitorAcceptanceCardInput): EvolutionStateOutDto {
    const workspaceState = this.#state.automationContext.workspaceState;
    if (!workspaceState?.roots?.length) throw new Error("监控者验收归档缺少已登记工作区。");
    const title = required(input.title, "监控者验收标题", 160);
    const goal = required(input.goal, "监控者验收目标", 8_000);
    const evidence = normalizedList(input.evidence, "监控者验收证据");
    const acceptanceCriteria = normalizedList(input.acceptanceCriteria, "监控者验收条件");
    const resultSummary = required(input.resultSummary, "监控者验收结论", 8_000);
    const retiredReason = required(input.retiredReason, "旧运行退役原因", 8_000);
    const previousRun = this.#state.oneShotRun ? structuredClone(this.#state.oneShotRun) : null;
    const now = new Date().toISOString();
    const topicId = `evolution-topic-${randomUUID()}`;
    const proposalId = `evolution-proposal-${randomUUID()}`;
    const runId = `evolution-one-shot-${randomUUID()}`;
    const planId = `acceptance-plan-${randomUUID()}`;
    const acceptanceRoundId = `acceptance-round-${randomUUID()}`;
    return this.#commit("one-shot.monitor-acceptance-created", topicId, proposalId, (state) => {
      // 旧误投影专题保留审计但退出活动状态，不能继续触发审批、分发或恢复。
      if (previousRun?.topicId) {
        const oldTopic = state.topics.find((item) => item.topicId === previousRun.topicId);
        if (oldTopic && oldTopic.status !== "completed") {
          oldTopic.status = "rejected";
          oldTopic.recoveryPoint = "monitor-takeover-archived";
          oldTopic.updatedAt = now;
        }
      }
      if (previousRun?.proposalId) {
        const oldProposal = state.proposals.find((item) => item.proposalId === previousRun.proposalId);
        if (oldProposal && oldProposal.status !== "completed") {
          oldProposal.status = "rejected";
          oldProposal.resultSummary = retiredReason;
          oldProposal.updatedAt = now;
        }
      }
      state.topics.push({
        topicId, title, goal, scope: ["正式 AI Desktop 页面交互验收"], exclusions: ["不恢复旧任务、旧工作树或旧计划", "不派发修复人物"],
        evidence, acceptanceCriteria, workspaceState: structuredClone(workspaceState), locale: state.automationContext.locale,
        origin: "nangong", sourceConversationMessageIds: input.sourceRequestId ? [input.sourceRequestId] : [], deliberationId: null,
        continuationOfTopicId: null, nextTopicId: null, seriesId: topicId, roundNumber: 1, status: "pending-acceptance",
        topicRevision: 1, currentProposalVersion: 1, recoveryPoint: "monitor-formal-acceptance-pending", createdAt: now, updatedAt: now,
      });
      state.proposals.push({
        proposalId, topicId, version: 1, title, type: "Bug修复", origin: "nangong",
        submitterMemberId: "nangong-wan", submitterDisplayName: "南宫婉", purpose: "work-proposal",
        targetMemberId: null, targetMemberDisplayName: null, capabilityScope: null, supersedesProposalId: null,
        revisionFeedbackApprovalId: null, content: resultSummary, evidence: [...evidence], impactScope: ["正式 AI Desktop 页面交互验收"],
        exclusions: ["不恢复旧任务、旧工作树或旧计划", "不派发修复人物"], risks: ["仅归档已经完成的正式页面验收事实，不执行代码修改。"],
        rollbackPlan: "如发现新的真实失败，另建独立修复卡，不恢复本次已退役运行。", acceptanceCriteria: [...acceptanceCriteria],
        acceptancePlan: {
          version: 2, planId, topicId, proposalId, proposalVersion: 1,
          conditions: acceptanceCriteria.map((criterion, index) => ({
            conditionId: `criterion-${index + 1}`, criterion, evidenceType: "page-experience" as const,
            completionRequirement: "正式页面只读截图、功能结果和布局判断均通过",
          })),
          rounds: [{ roundId: acceptanceRoundId, roundNumber: 1, reopenedFromRecordId: null, reopenReason: null, reopenSourceRecordId: null, openedAt: now }],
          currentRoundId: acceptanceRoundId, createdAt: now,
        }, distributionPlan: null, finalConclusionRecordId: null, status: "pending-acceptance", distributedTaskIds: [], resultSummary,
        approvals: [],
        createdAt: now, updatedAt: now,
      });
      state.activeTopicId = topicId;
      state.oneShotConfirmation = null;
      state.oneShotRun = {
        runId, sourceRequestId: input.sourceRequestId || null, topicId, proposalId, status: "running", phase: "accepting",
        actor: "han-li", actorName: "韩立", action: "等待正式版本独立验收", blockingReason: null, resumeMode: null,
        startedAt: now, updatedAt: now, completedAt: null,
      };
      // 当前独立验收属于已确认的一次性工作；托管总开关关闭也应由韩立继续验收。
      state.automationRuntime.status = "running";
      state.automationRuntime.stopReason = null;
      state.automationRuntime.pausedAt = null;
    }, { retiredRunId: previousRun?.runId || null, retiredTopicId: previousRun?.topicId || null, retiredProposalId: previousRun?.proposalId || null,
      retiredReason, resultSummary, nextOwner: "user" });
  }

  /**
   * 作用：从已持久化的一次性流程卡点原位恢复，并恢复统一自动运行，不新建专题或提案。
   * 真实传参示例：当前 run.status=blocked、proposalId 指向待补充提案，返回同一 runId 的 running 状态。
   * 真实返回示例：界面显示“南宫婉正在重新调查韩立退回项”，后续状态机沿原专题继续。
   * 异常或副作用示例：没有可恢复卡点时拒绝；成功后清除旧阻塞原因但保留全部审批和版本记录。
   */
  /** 恢复当前运行中尚未建立专题的研讨，保留运行标识、轮次和历史，不重复建任务。 */
  resumePendingDeliberation(deliberationId: string): EvolutionStateOutDto {
    const current = this.#state.oneShotRun;
    const deliberation = this.#state.deliberations.find((item) => item.deliberationId === deliberationId);
    if (!current || current.status === "completed" || current.status === "running"
      || !deliberation || !["questioning", "ready-to-establish"].includes(deliberation.status)
      || deliberation.topicId || Date.parse(deliberation.createdAt) < Date.parse(current.startedAt)) {
      throw new Error("当前运行没有可原位继续的未完成研讨。");
    }
    const now = new Date().toISOString();
    return this.#commit("one-shot.resumed", null, null, (state) => {
      Object.assign(state.oneShotRun!, {
        topicId: null, proposalId: null, status: "running", phase: "preparing-topic",
        actor: "han-li", actorName: "韩立", action: "正在继续原有研讨，调查完成后仍需确认范围",
        blockingReason: null, completedAt: null, updatedAt: now,
      });
      state.automationRuntime.status = "running";
      state.automationRuntime.pausedAt = null;
      state.automationRuntime.stopReason = null;
    }, { deliberationId, phase: "preparing-topic", status: "running", nextOwner: "han-li" });
  }

  resumeOneShotRun(): EvolutionStateOutDto {
    const current = this.#state.oneShotRun;
    if (!current || current.status === "completed" || (current.status !== "blocked" && this.#state.automationRuntime.status !== "paused") || !current.topicId || !current.proposalId) throw new Error("当前没有可原位恢复的一次性演化卡点。");
    const proposal = requireProposal(this.#state, current.proposalId);
    const redistributing = proposal.status === "approved" && proposal.distributedTaskIds.length === 0;
    if (!redistributing && !["pending-approval", "supplement-required", "rejected", "blocked", "pending-acceptance", "executing", "verifying"].includes(proposal.status)) throw new Error("当前提案状态不允许从卡点恢复。");
    // 依据提案的持久事实回到原阶段；验收故障不得重新分析、分发已经完成的任务。
    const approving = proposal.status === "pending-approval";
    const accepting = proposal.status === "pending-acceptance";
    const executing = proposal.status === "executing" || proposal.status === "verifying";
    const phase = redistributing ? "distributing" : approving ? "approving" : accepting ? "accepting" : executing ? (proposal.status === "verifying" ? "testing" : "executing") : "revising";
    const now = new Date().toISOString();
    return this.#commit("one-shot.resumed", current.topicId, current.proposalId, (state) => {
      const run = state.oneShotRun!;
      run.status = "running";
      run.phase = phase;
      run.actor = approving || accepting ? "han-li" : "nangong-wan";
      run.actorName = approving || accepting ? "韩立" : "南宫婉";
      run.action = redistributing ? "正在从原分发卡点重新拆分并分发任务" : approving ? "正在从原审批卡点重新判断南宫婉提交的方向" : accepting ? "正在从原验收卡点继续结果验收" : executing ? "正在从原任务状态继续流程" : "正在重新调查韩立退回项并核对可验证的新事实";
      run.blockingReason = null;
      run.updatedAt = now;
      run.completedAt = null;
      state.automationRuntime.status = "running";
      state.automationRuntime.pausedAt = null;
      state.automationRuntime.stopReason = null;
    }, { phase, actor: approving || accepting ? "han-li" : "nangong-wan", status: "running", nextOwner: approving || accepting ? "han-li" : "nangong-wan" });
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
        rounds: [{ roundId: `han-li-round-${randomUUID()}`, roundNumber: 1, question: required(question, "韩立问题", 30_000), questionReason: required(questionReason, "发问依据", 8_000), answer: null, assessment: null, discoveries: [], decision: null, createdAt: now, answeredAt: null, assessedAt: null }],
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

  assessDeliberation(deliberationId: string, roundId: string, assessment: string, nextQuestion: { question: string; reason: string } | null, candidate: HanliTopicCandidateOutDto | null, discoveries: NonNullable<HanliTopicCandidateOutDto["discoveries"]> = []): EvolutionStateOutDto {
    return this.#commit(candidate ? "deliberation.topic_ready" : "deliberation.follow_up_planned", null, null, (state) => {
      const deliberation = requireDeliberation(state, deliberationId);
      const round = requireDeliberationRound(deliberation, roundId);
      if (!round.answer) throw new Error("南宫婉尚未回答当前问题。 ");
      if (round.assessment !== null) return;
      const now = new Date().toISOString();
      round.assessment = required(assessment, "韩立判断", 30_000);
      round.discoveries = structuredClone(discoveries);
      round.assessedAt = now;
      if (candidate) {
        round.decision = "establish-topic";
        deliberation.candidate = normalizeCandidate(candidate);
        deliberation.status = "ready-to-establish";
      } else {
        if (!nextQuestion) throw new Error("继续研讨必须给出韩立的下一轮问题。 ");
        round.decision = "continue";
        deliberation.rounds.push({ roundId: `han-li-round-${randomUUID()}`, roundNumber: round.roundNumber + 1, question: required(nextQuestion.question, "韩立下一轮问题", 30_000), questionReason: required(nextQuestion.reason, "下一轮发问依据", 8_000), answer: null, assessment: null, discoveries: [], decision: null, createdAt: now, answeredAt: null, assessedAt: null });
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
      state.automationRuntime.status = "blocked";
      state.automationRuntime.stopReason = required(reason, "研讨阻断原因", 8_000);
    });
  }

  /** 保存南宫婉的可见修复说明；重启重试复用同一说明，不重复生成确认。 */
  offerDeliberationConfirmation(deliberationId: string, offer: string): EvolutionStateOutDto {
    return this.#commit("deliberation.confirmation_offered", null, null, (state) => {
      const deliberation = requireDeliberation(state, deliberationId);
      if (deliberation.status !== "ready-to-establish") throw new Error("研讨尚未成熟。");
      const round = deliberation.rounds.at(-1)!;
      round.confirmation ||= { offer: required(offer, "修复说明", 30_000), offeredAt: new Date().toISOString(), reply: null, repliedAt: null };
    });
  }

  /** 确认不等于后台成熟判断；非 1 回复会成为下一轮真实追问。 */
  replyDeliberationConfirmation(deliberationId: string, reply: string, followupQuestion?: { question: string; reason: string }): EvolutionStateOutDto {
    return this.#commit("deliberation.confirmation_replied", null, null, (state) => {
      const deliberation = requireDeliberation(state, deliberationId);
      const round = deliberation.rounds.at(-1)!;
      if (!round.confirmation || deliberation.status !== "ready-to-establish") throw new Error("南宫婉尚未提出修复确认。");
      if (round.confirmation.reply !== null) return;
      const now = new Date().toISOString();
      round.confirmation.reply = required(reply, "韩立确认回复", 30_000);
      round.confirmation.repliedAt = now;
      if (reply.trim() !== "1") {
        deliberation.status = "questioning";
        deliberation.candidate = null;
        deliberation.rounds.push({ roundId: `han-li-round-${randomUUID()}`, roundNumber: round.roundNumber + 1, question: required(followupQuestion?.question || reply, "韩立研讨问题", 30_000), questionReason: required(followupQuestion?.reason || "韩立尚未确认修复范围", "韩立发问依据", 8_000), answer: null, assessment: null, discoveries: [], decision: null, createdAt: now, answeredAt: null, assessedAt: null });
      }
      deliberation.updatedAt = now;
    });
  }

  /** 仅收到韩立对南宫婉修复说明的真实 1 后，才登记长期专题。 */
  establishDeliberationTopic(deliberationId: string): EvolutionStateOutDto {
    if (["paused", "stopped", "blocked"].includes(this.#state.automationRuntime.status)) throw new Error("自动流程已暂停、停止或阻塞，不能开始执行。");
    const current = requireDeliberation(this.#state, deliberationId);
    if (current.rounds.at(-1)?.confirmation?.reply !== "1") throw new Error("尚未收到韩立对修复说明的确认 1。");
    const recoveringUnboundRun = Boolean(current.topicId
      && current.status === "established"
      && this.#state.oneShotRun?.status === "running"
      && !this.#state.oneShotRun.topicId
      && Date.parse(current.createdAt) >= Date.parse(this.#state.oneShotRun.startedAt));
    if (!recoveringUnboundRun && (current.status !== "ready-to-establish" || !current.candidate)) throw new Error("韩立尚未完成专题确立判断。 ");
    if (!this.#state.automationContext.workspaceState?.roots?.length) throw new Error("自动演化尚未登记实施工作区。 ");
    // 旧版本可能已经登记专题、却在绑定 oneShot 前退出；重试必须复用同一专题，不能再建同名副本。
    const topicId = current.topicId || `evolution-topic-${randomUUID()}`;
    const now = new Date().toISOString();
    return this.#commit("topic.established_from_deliberation", topicId, null, (state) => {
      const deliberation = requireDeliberation(state, deliberationId);
      if (!deliberation.topicId) {
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
      }
      state.activeTopicId = topicId;
      // 正式专题、活动指针和当前运行必须在同一状态提交内关联；否则重启窗口会留下
      // activeTopicId 已存在、oneShot.topicId 仍为空的悬空运行，只能依靠下次轮询碰运气恢复。
      const run = state.oneShotRun;
      if (run?.status === "running" && !run.topicId) {
        run.topicId = topicId;
        run.proposalId = null;
        run.phase = "forming-proposal";
        run.actor = "nangong-wan";
        run.actorName = "南宫婉";
        run.action = "内部研讨条件已满足，正在把结论整理为实施提案";
        run.blockingReason = null;
        run.updatedAt = now;
      }
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
        acceptanceCriteria: [...mutableTopic.acceptanceCriteria], acceptancePlan: null,
        distributionPlan: null, finalConclusionRecordId: null, status: "pending-approval",
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
        ? [...state.conversation.messages].reverse().find((message) => message.speakerType === "user")?.messageId || null
        : options.replyToMessageId || null;
      const deliveryStatus = options.deliveryStatus || "completed";
      state.conversation.messages.push({
        messageId,
        // 正式会话的用户输入与南宫婉回复必须供客户页面投影。
        messageType: "customer-visible",
        contentRole: "conversation",
        sequenceNumber: state.conversation.messages.length,
        speakerType: role === "user" ? "user" : "persona",
        speakerPersonaId: role === "user" ? null : "nangong-wan",
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
      const userMessage = state.conversation.messages.find((message) => message.messageId === userMessageId && message.speakerType === "user");
      if (!userMessage) throw new Error("待完成的用户会话消息不存在。");
      if (userMessage.deliveryStatus === "failed") throw new Error("发送失败的用户消息不能追加人物回复。");
      userMessage.deliveryStatus = "completed";
      userMessage.completedAt = now;
      state.conversation.messages.push({
        messageId: `evolution-message-${randomUUID()}`, sequenceNumber: state.conversation.messages.length,
        // 本次回合的正式答复延续客户可见消息流，不能归入内部恢复或研讨记录。
        messageType: "customer-visible",
        contentRole: "conversation",
        speakerType: "persona", speakerPersonaId: "nangong-wan", content: required(content, "南宫婉回复", 30_000), replyToMessageId: userMessageId,
        deliveryStatus: "completed", attachmentIds: [], createdAt: now, completedAt: now,
      });
      state.conversation.updatedAt = now;
    });
  }

  /** 发送失败只改变原用户消息状态，禁止生成一条脱离原位置的错误消息。 */
  failConversationTurn(userMessageId: string): EvolutionStateOutDto {
    const now = new Date().toISOString();
    return this.#commit("conversation.turn_failed", null, null, (state) => {
      const userMessage = state.conversation.messages.find((message) => message.messageId === userMessageId && message.speakerType === "user");
      if (!userMessage) throw new Error("待标记失败的用户会话消息不存在。");
      userMessage.deliveryStatus = "failed";
      userMessage.completedAt = now;
      state.conversation.updatedAt = now;
    });
  }

  /** 把南宫婉正文中的明确邀请登记为可恢复事实；传入 null 表示最新回答尚未具备启动条件。 */
  setOneShotConfirmation(invitationMessageId: string | null): EvolutionStateOutDto {
    const message = invitationMessageId
      ? this.#state.conversation.messages.find((item) => item.messageId === invitationMessageId && item.speakerType === "persona" && item.speakerPersonaId === "nangong-wan")
      : null;
    if (invitationMessageId && !message) throw new Error("一次性演化邀请消息不存在。");
    const conversationId = this.#state.conversation.conversationId;
    if (message && !conversationId) throw new Error("一次性演化邀请缺少统一人物会话标识。");
    return this.#commit("conversation.one-shot-confirmation-changed", null, null, (state) => {
      state.oneShotConfirmation = message
        ? { conversationId: conversationId!, invitationMessageId: message.messageId, status: "awaiting-user-confirmation", createdAt: message.createdAt }
        : null;
    });
  }

  recordConversationIntent(messageId: string, inferredIntent: string): EvolutionStateOutDto {
    const now = new Date().toISOString();
    return this.#commit("conversation.intent_recorded", null, null, (state) => {
      const message = state.conversation.messages.find((item) => item.messageId === messageId && item.speakerType === "user");
      if (!message) throw new Error("需要登记意图的用户消息不存在。");
      message.inferredIntent = required(inferredIntent, "用户意图摘要", 2_000);
      state.conversation.updatedAt = now;
    });
  }

  /** 专题群只追加人物消息引用与短预览，完整原话继续由人物会话表权威保存。 */
  recordTopicConversation(topicId: string, userMessageId: string, nangongMessageId: string): EvolutionStateOutDto {
    const topic = requireTopic(this.#state, topicId);
    const userMessage = this.#state.conversation.messages.find((item) => item.messageId === userMessageId && item.speakerType === "user");
    const nangongMessage = this.#state.conversation.messages.find((item) => item.messageId === nangongMessageId && item.speakerType === "persona" && item.speakerPersonaId === "nangong-wan");
    if (!userMessage || !nangongMessage) throw new Error("专题群人物消息不完整，不能登记回流记录。");
    return this.#commit("conversation.topic_group_replied", topic.topicId, null, () => undefined, {
      conversationId: this.#state.conversation.conversationId,
      userMessageId, userPreview: preview(userMessage.content), nangongMessageId, nangongPreview: preview(nangongMessage.content),
      status: "replied", nextOwner: "han-li",
    });
  }

  /** 真实应用操作证据与计划分开追加，失败事实交由后续结果线路处理。 */
  recordAcceptanceRun(run: HanliAcceptanceRunOutDto): EvolutionStateOutDto {
    const proposal = requireProposal(this.#state, run.proposalId);
    if (proposal.topicId !== run.topicId) throw new Error("真实验收记录与专题不一致。 ");
    const plan = requireAcceptancePlan(proposal);
    if (run.planId !== plan.planId || run.acceptanceRoundId !== plan.currentRoundId) throw new Error("真实验收记录没有绑定当前提案验收计划或验收轮次。 ");
    const expectedCriterionIds = plan.conditions.map((item) => item.conditionId);
    const recordedCriterionIds = run.stepResults.map((step) => step.checkId);
    if (run.criteria.length !== plan.conditions.length
      || expectedCriterionIds.some((criterionId) => recordedCriterionIds.filter((item) => item === criterionId).length !== 1)
      || run.stepResults.some((step) => plan.conditions.find((item) => item.conditionId === step.checkId)?.evidenceType !== step.evidenceMode)) {
      throw new Error("验收记录没有逐项覆盖原提案条件，不能进入结果完成门禁。 ");
    }
    return this.#commit("acceptance.result_checked", run.topicId, run.proposalId, () => undefined, { acceptanceRun: structuredClone(run), status: run.status, nextOwner: run.status === "passed" ? "han-li" : "nangong-wan" });
  }

  /**
   * 保存根目录 Host 启动器的原始验收事实。
   * 真实传参示例：{ launchId: "host-1", handler: "启动SELPLAT.command", commandState: "running", exitCode: null }。
   * 真实返回示例：写入当前专题 archiveRecords 后返回新的状态快照。
   * 异常或副作用示例：专题已切换、启动标识重复但内容不同或字段格式无效时抛错且不写入。
   */
  recordHostStartupEvidence(input: HostStartupEvidenceInput): EvolutionStateOutDto {
    const topicId = required(input.topicId, "Host 启动专题", 200);
    const proposalId = required(input.proposalId, "Host 启动提案", 200);
    const launchId = required(input.launchId, "Host 启动标识", 200);
    const handler = required(input.handler, "Host 启动处理人", 200);
    const startedAt = required(input.startedAt, "Host 启动时间", 100);
    const commandLaunchId = required(input.commandLaunchId, "命令启动标识", 200);
    const healthLaunchId = required(input.healthLaunchId, "健康检查启动标识", 200);
    const evidenceReferences = input.evidenceReferences.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim());
    if (topicId !== this.#state.activeTopicId) throw new Error("Host 启动证据只能写入当前专题。 ");
    const proposal = requireProposal(this.#state, proposalId);
    if (proposal.topicId !== topicId) throw new Error("Host 启动证据与当前专题提案不一致。 ");
    if (commandLaunchId !== launchId || healthLaunchId !== launchId) throw new Error("命令结果与 health 结果必须绑定同一 Host 启动标识。 ");
    if (input.commandState !== "running" && input.commandState !== "exited") throw new Error("Host 启动进程状态无效。 ");
    if (input.exitCode !== null && !Number.isInteger(input.exitCode)) throw new Error("Host 启动退出码必须为整数或未记录。 ");
    if (input.commandState === "running" && input.exitCode !== null) throw new Error("运行中的 Host 启动不能伪造退出码。 ");
    if (input.commandState === "exited" && !Number.isInteger(input.exitCode)) throw new Error("已退出的 Host 启动必须记录真实退出码。 ");
    if (typeof input.healthSuccess !== "boolean" || !input.healthCheckedAt || !input.healthSummary.trim()) throw new Error("Host 启动 health 结果不完整。 ");
    if (input.launcherSource !== null && (typeof input.launcherSource !== "string" || input.launcherSource.length > 32_000)) throw new Error("Host 启动脚本快照无效。 ");
    if (!evidenceReferences.length) throw new Error("Host 启动证据缺少有效引用。 ");
    const payload = {
      version: 2,
      launchId,
      handler,
      startedAt,
      command: { launchId: commandLaunchId, state: input.commandState, exitCode: input.exitCode },
      health: { launchId: healthLaunchId, success: input.healthSuccess, checkedAt: input.healthCheckedAt, summary: input.healthSummary.trim().slice(0, 4_000) },
      evidenceSnapshot: { launcherSource: input.launcherSource || null, healthResponse: input.healthSummary.trim().slice(0, 4_000) },
      sourceReferences: evidenceReferences,
      evidenceReferences: [`archive://host-startup/${encodeURIComponent(launchId)}/launcherSource`, `archive://host-startup/${encodeURIComponent(launchId)}/healthResponse`],
    };
    const prior = [...this.#state.archiveRecords].reverse().find((record) => record.eventType === "host-startup.evidence-recorded" && record.topicId === topicId && record.proposalId === proposalId && (record.payload as { hostStartupEvidence?: { launchId?: unknown } }).hostStartupEvidence?.launchId === launchId);
    if (prior) {
      if (JSON.stringify((prior.payload as { hostStartupEvidence?: unknown }).hostStartupEvidence) === JSON.stringify(payload)) return this.state();
      const previous = (prior.payload as { hostStartupEvidence?: typeof payload }).hostStartupEvidence;
      const validCompletion = previous?.command.state === "running" && previous.command.exitCode === null && input.commandState === "exited"
        && previous.launchId === payload.launchId && previous.handler === payload.handler && previous.startedAt === payload.startedAt
        && JSON.stringify(previous.health) === JSON.stringify(payload.health)
        && JSON.stringify(previous.evidenceSnapshot) === JSON.stringify(payload.evidenceSnapshot)
        && JSON.stringify(previous.evidenceReferences) === JSON.stringify(payload.evidenceReferences);
      if (!validCompletion) throw new Error("同一 Host 启动标识已经记录为不同事实。 ");
    }
    return this.#commit("host-startup.evidence-recorded", topicId, proposalId, () => undefined, { hostStartupEvidence: payload, nextOwner: "han-li" });
  }

  /** 在第一次结果验收前冻结韩立已分类的条件；同一提案版本不得由重试覆盖。 */
  saveAcceptancePlan(proposalId: string, plan: EvolutionAcceptancePlanOutDto): EvolutionStateOutDto {
    const proposal = requireProposal(this.#state, proposalId);
    if (proposal.topicId !== plan.topicId || proposal.proposalId !== plan.proposalId || proposal.version !== plan.proposalVersion) throw new Error("验收计划没有绑定当前专题和提案版本。 ");
    if (proposal.status !== "pending-acceptance") throw new Error("只有待验收提案可以冻结验收计划。 ");
    if (!plan.conditions.length || !plan.currentRoundId || !plan.rounds.some((item) => item.roundId === plan.currentRoundId)) throw new Error("验收计划缺少条件或当前验收轮次。 ");
    if (new Set(plan.conditions.map((item) => item.conditionId)).size !== plan.conditions.length) throw new Error("验收计划条件编号重复。 ");
    if (proposal.acceptancePlan) {
      if (proposal.acceptancePlan.planId !== plan.planId) throw new Error("同一提案版本已经冻结另一份验收计划。 ");
      return this.state();
    }
    return this.#commit("acceptance.plan_frozen", proposal.topicId, proposalId, (state) => {
      requireProposal(state, proposalId).acceptancePlan = structuredClone(plan);
    }, { planId: plan.planId, acceptanceRoundId: plan.currentRoundId, nextOwner: "han-li" });
  }

  /** 冻结的旧计划只可审计退役，禁止恢复、升级或覆盖；当前能力必须重新冻结全新计划。 */
  retireLegacyAcceptancePlan(proposalId: string): EvolutionStateOutDto {
    const proposal = requireProposal(this.#state, proposalId);
    const previous = requireAcceptancePlan(proposal);
    if (proposal.status !== "pending-acceptance" || previous.version !== 1) throw new Error("当前验收计划不是可退役的旧版待验收计划。 ");
    const hasRecordedResult = this.#state.archiveRecords.some((record) => record.proposalId === proposalId && record.eventType === "acceptance.result_checked");
    if (hasRecordedResult) throw new Error("已有验收结果的旧计划只能保留历史，禁止恢复或重建。 ");
    return this.#commit("acceptance.legacy_plan_retired", proposal.topicId, proposalId, (state) => {
      requireProposal(state, proposalId).acceptancePlan = null;
    }, { retiredPlanId: previous.planId, retiredAcceptanceRoundId: previous.currentRoundId, retiredVersion: previous.version, nextOwner: "han-li" });
  }

  /** 已完成专题只可显式建立新的验收轮次；不复用阻塞运行的 resumeOneShotRun。 */
  reopenCompletedAcceptance(topicId: string, proposalId: string, reason: string, sourceRecordId: string): EvolutionStateOutDto {
    const proposal = requireProposal(this.#state, proposalId);
    const topic = requireTopic(this.#state, topicId);
    const plan = requireAcceptancePlan(proposal);
    if (proposal.topicId !== topicId || proposal.status !== "completed" || topic.status !== "completed") throw new Error("只有同一已完成专题和提案可以重新验收。 ");
    const completedRecord = this.#state.archiveRecords.find((item) => item.recordId === sourceRecordId && item.proposalId === proposalId && item.eventType === "proposal.result_decided");
    if (!completedRecord || proposal.finalConclusionRecordId !== sourceRecordId) throw new Error("重新验收必须引用当前已保存的原完成决定记录。 ");
    const now = new Date().toISOString();
    const nextRound = { roundId: `acceptance-round-${randomUUID()}`, roundNumber: plan.rounds.length + 1, reopenedFromRecordId: completedRecord.recordId, reopenReason: required(reason, "重新验收原因", 8_000), reopenSourceRecordId: sourceRecordId, openedAt: now };
    return this.#commit("acceptance.reopened", topicId, proposalId, (state) => {
      const mutable = requireProposal(state, proposalId);
      mutable.status = "pending-acceptance";
      mutable.acceptancePlan!.rounds.push(nextRound);
      mutable.acceptancePlan!.currentRoundId = nextRound.roundId;
      mutable.updatedAt = now;
      const mutableTopic = requireTopic(state, topicId);
      mutableTopic.status = "pending-acceptance";
      mutableTopic.recoveryPoint = `acceptance-reopened:${nextRound.roundId}`;
      mutableTopic.updatedAt = now;
      state.oneShotRun = { runId: `evolution-one-shot-${randomUUID()}`, topicId, proposalId, status: "running", phase: "accepting", actor: "han-li", actorName: "韩立", action: "正在执行同一专题的重新验收", blockingReason: null, resumeMode: null, startedAt: now, updatedAt: now, completedAt: null };
    }, { planId: plan.planId, acceptanceRoundId: nextRound.roundId, reopenedFromRecordId: sourceRecordId, reopenReason: nextRound.reopenReason, nextOwner: "han-li" });
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
      : sourceMessages.map((item) => `${item.speakerType === "user" ? "用户提供的材料" : "南宫婉调查记录（含待验证判断）"}：${item.content}`);
    return this.createTopic({ ...request, evidence }, sourceMessages.map((item) => item.messageId));
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
    const plan = requireAcceptancePlan(proposal);
    const run = [...this.#state.archiveRecords].reverse().find((record) => record.proposalId === proposalId && record.eventType === "acceptance.result_checked")?.payload.acceptanceRun as HanliAcceptanceRunOutDto | undefined;
    const hasCompleteSourceReview = Boolean(run?.sourceReview?.status === "passed"
      && run.sourceReview.actual.trim()
      && run.sourceReview.evidenceReferences.length);
    const hasCompleteAcceptanceEvidence = Boolean(run) && hasCompleteSourceReview && run!.planId === plan.planId && run!.acceptanceRoundId === plan.currentRoundId && plan.conditions.every((condition) => {
      const matches = run!.stepResults.filter((step) => step.checkId === condition.conditionId);
      const step = matches[0];
      const pageEvidence = condition.evidenceType === "page-experience"
        ? Boolean(step?.screenshotAttachmentId)
          && run!.evidenceAttachmentIds.includes(step!.screenshotAttachmentId!)
          && step?.layoutStatus === "passed"
          && Boolean(step.layoutActual?.trim())
          && Boolean(step.layoutScreenshotAttachmentId)
          && run!.evidenceAttachmentIds.includes(step.layoutScreenshotAttachmentId!)
        : step?.layoutStatus === "not-applicable" && Boolean(step.evidenceReferences?.length);
      return matches.length === 1
        && step !== undefined
        && step.evidenceMode === condition.evidenceType
        && step.status === "passed"
        && Boolean(step.actual?.trim())
        && pageEvidence;
    });
    if (decision === "approved" && (run?.version !== 3 || run.status !== "passed" || !hasCompleteAcceptanceEvidence)) {
      throw new Error("韩立必须先完成适用的正式页面检查和源码审查且全部通过，才能验收通过。 ");
    }
    const failureEvidence = decision === "approved" || !run ? [] : run.stepResults.filter((step) => step.status !== "passed" || step.layoutStatus !== "passed").map((step) => {
      return {
        evidenceId: `acceptance-failure-${run.runId}-${step.checkId}-${step.operationIndex}`,
        runId: run.runId,

        checkId: step.checkId,
        target: requiresPageAcceptanceEvidence(run.mode, step.evidenceMode)
          ? "真实应用界面"
          : "客户要求与实际代码",
        severity: step.status === "blocked" || step.layoutStatus === "blocked" ? "blocking" : "major",
        reproductionOperations: [...(run.interactionSteps || []), ...run.stepResults]
          .sort((left, right) => left.operationIndex - right.operationIndex)
          .slice(0, step.operationIndex + 1)
          .map((item) => structuredClone(item.operation)),
        actual: [
          step.status !== "passed" ? step.actual : "",
          requiresPageAcceptanceEvidence(run.mode, step.evidenceMode) && step.layoutStatus !== "passed" ? `布局：${step.layoutActual}` : "",
        ].filter(Boolean).join("；"),
        expected: plan.conditions.find((condition) => condition.conditionId === step.checkId)?.criterion || "符合专题验收条件",
        screenshotAttachmentIds: [...new Set([step.screenshotAttachmentId, step.layoutScreenshotAttachmentId, ...run.evidenceAttachmentIds].filter((item): item is string => Boolean(item)))],
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
    // 通过结论的档案标识先于状态变更生成，使 completed 与其唯一依据进入同一次快照写入。
    const finalConclusionRecordId = decision === "approved" ? `evolution-archive-${randomUUID()}` : null;
    const finalConclusion = decision === "approved" && run ? {
      recordId: finalConclusionRecordId,
      handler: "韩立",
      occurredAt: now,
      acceptanceRunId: run.runId,
      conditionResults: run.stepResults.map((step) => ({
        checkId: step.checkId,
        status: step.status,
        evidenceReferences: [...new Set([
          ...(step.evidenceReferences || []),
          step.screenshotAttachmentId,
          step.layoutScreenshotAttachmentId,
        ].filter((item): item is string => Boolean(item)))],
      })),
      evidenceReferences: [...new Set([...run.evidenceAttachmentIds, ...run.stepResults.flatMap((step) => step.evidenceReferences || [])])],
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
        mutable.finalConclusionRecordId = finalConclusionRecordId;
        topic.status = "completed";
        topic.recoveryPoint = topic.recoveryPoint?.startsWith("monitor-formal-acceptance-")
          ? "monitor-formal-acceptance-passed" : "han-li-result-accepted";
        state.automationRuntime.completedRounds += 1;
        state.automationRuntime.correctionRounds = 0;
      } else {
        mutable.status = "supplement-required";
        topic.status = "supplement-required";
        topic.recoveryPoint = topic.recoveryPoint?.startsWith("monitor-formal-acceptance-")
          ? "monitor-formal-acceptance-failed" : "han-li-result-correction-required";
        state.automationRuntime.correctionRounds += 1;
        if (state.automationRuntime.correctionRounds >= state.automationSettings.maxCorrectionRounds && state.oneShotRun?.status !== "running") {
          state.automationRuntime.status = "blocked";
          state.automationRuntime.stopReason = `结果纠偏达到 ${state.automationSettings.maxCorrectionRounds} 轮，等待韩立调整方向。`;
        }
      }
      mutable.updatedAt = now;
      topic.updatedAt = now;
    }, { acceptanceRunId: run?.runId || null, finalConclusion, failureEvidence, experienceCandidate, nextOwner: decision === "approved" ? "han-li" : proposal.submitterMemberId }, finalConclusionRecordId || undefined);
  }

  /** 原提交人只能修订退回的本人提案；新版本保留原审批、反馈目标和完整替代链。 */
  revise(proposalId: string, request: ReviseNangongProposalInDto, submitterDisplayName: string): EvolutionStateOutDto {
    const previous = requireProposal(this.#state, proposalId);
    if (!['supplement-required', 'rejected'].includes(previous.status)) throw new Error("只有退回补充或驳回的提案可以重新提交。");
    if (previous.submitterMemberId !== request.submitterMemberId) throw new Error("只能由原提交人重新提交该提案。");
    const feedback = previous.approvals.at(-1);
    if (!feedback) throw new Error("重新提交缺少可追溯的审批意见。");
    const topic = requireTopic(this.#state, previous.topicId);
    if (this.#state.activeTopicId !== topic.topicId) throw new Error("历史专题已经退出当前运行，禁止重新提交或恢复旧计划。");
    const activeRun = this.#state.oneShotRun;
    if (activeRun?.status === "running" && activeRun.topicId && activeRun.topicId !== topic.topicId) {
      throw new Error("当前一次性运行属于其他专题，禁止异步返修结果重新激活旧专题。");
    }
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
        acceptanceCriteria: normalizedList(request.acceptanceCriteria, "修订验收条件"), acceptancePlan: null,
        distributionPlan: null, finalConclusionRecordId: null,
        status: "pending-approval",
        approvals: [], distributedTaskIds: [], resultSummary: null, createdAt: now, updatedAt: now,
      });
      // 后续验收必须读取当前有效的提案版本。保留旧版本仅供审计，不能让
      // 运行指针继续把客户已经排除的条件带回自动修复链。
      if (state.oneShotRun?.proposalId === previous.proposalId) {
        state.oneShotRun.proposalId = nextProposalId;
        state.oneShotRun.updatedAt = now;
      }
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

  /** 按本次审批签发的任务事实核对分发关联，旧关联仍保存在审计快照中。 */
  reconcileDispatchedTasks(proposalId: string, approvalId: string, taskIds: string[]): EvolutionStateOutDto {
    const proposal = requireProposal(this.#state, proposalId);
    if (proposal.approvals.at(-1)?.approvalId !== approvalId) throw new Error("任务关联核对期间审批已变化。");
    if (JSON.stringify(proposal.distributedTaskIds) === JSON.stringify(taskIds)) return this.state();
    return this.#commit("proposal.distribution_reconciled", proposal.topicId, proposalId, (state) => {
      const mutable = requireProposal(state, proposalId);
      mutable.distributedTaskIds = [...taskIds];
      mutable.status = "executing";
      mutable.updatedAt = new Date().toISOString();
      const topic = requireTopic(state, mutable.topicId);
      topic.status = "executing";
      topic.recoveryPoint = "distribution-reconciled";
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

  #commit(reason: string, topicId: string | null, proposalId: string | null, mutate: (state: EvolutionStateOutDto) => void, payloadExtra: Record<string, unknown> = {}, recordId?: string): EvolutionStateOutDto {
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
      recordId: recordId || `evolution-archive-${randomUUID()}`,
      deliberationId: deliberation?.deliberationId || topic?.deliberationId || null,
      topicId: topicId || deliberation?.topicId || proposal?.topicId || null,
      proposalId,
      taskId: reason === "proposal.distributed" ? proposal?.distributedTaskIds.at(-1) || null : null,
      sequenceNumber: next.archiveRecords.length + 1,
      category: archiveCategory(reason),
      eventType: reason,
      actor: archiveActor(reason, payloadExtra),
      title: archiveTitle(reason),
      payload: {
        ...archivePayload(topic, proposal, deliberation),
        ...(reason.startsWith("one-shot.") ? { oneShotRun: next.oneShotRun ? structuredClone(next.oneShotRun) : null } : {}),
        ...payloadExtra,
      },
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
      const raw = this.#repository.load() as (Partial<EvolutionStateOutDto> & Partial<RetiredAutomationSwitches>) | null;
      const rawVersion: number | undefined = (raw as { version?: number } | null)?.version;
      if (raw && (rawVersion === 8 || rawVersion === 9 || rawVersion === 10) && Array.isArray(raw.topics) && Array.isArray(raw.proposals) && Array.isArray(raw.deliberations)
        && Array.isArray(raw.archiveRecords) && raw.conversation && raw.automationSettings && raw.automationRuntime && raw.automationContext) {
        const migrated = migrateEvolutionState(raw as EvolutionStateOutDto & Partial<RetiredAutomationSwitches>);
        const recovered = this.#recoverOverwrittenAcceptanceRun(migrated.state);
        if (migrated.changed || recovered !== migrated.state) this.#repository.save(recovered);
        return recovered;
      }
    } catch { /* 损坏状态安全关闭；禁止扫描或恢复旧 JSON 文件。 */ }
    const initial = createInitialState();
    const conversation = this.#repository.loadLatestConversation();
    if (conversation) initial.conversation = conversation;
    return initial;
  }

  /**
   * 旧版本允许普通确认覆盖 blocked 的原验收运行。这里只在专题、提案、归档阻塞和统一异常事实
   * 四者完全相符，且当前指针确实是更晚的无专题准备运行时恢复；不重建专题、提案或验收计划。
   */
  #recoverOverwrittenAcceptanceRun(state: EvolutionStateOutDto): EvolutionStateOutDto {
    const current = state.oneShotRun;
    if (!current || current.status !== "running" || current.phase !== "preparing-topic" || current.topicId || current.proposalId) return state;
    const topic = state.topics.find((item) => item.topicId === state.activeTopicId && item.status === "pending-acceptance");
    if (!topic) return state;
    const proposal = state.proposals.find((item) => item.topicId === topic.topicId
      && item.version === topic.currentProposalVersion
      && item.status === "pending-acceptance"
      && item.acceptancePlan?.version === 2);
    if (!proposal) return state;
    const archivedBlock = [...state.archiveRecords].reverse().find((record) => record.eventType === "one-shot.blocked"
      && record.topicId === topic.topicId
      && record.proposalId === proposal.proposalId
      && Date.parse(record.occurredAt) < Date.parse(current.startedAt));
    if (!archivedBlock) return state;
    const archivedRun = (archivedBlock.payload as { oneShotRun?: EvolutionStateOutDto["oneShotRun"] }).oneShotRun;
    const fallback = this.#repository.loadLatestBlockedOneShotRecovery?.(topic.topicId, proposal.proposalId) || null;
    const runId = archivedRun?.runId || fallback?.runId;
    const startedAt = archivedRun?.startedAt || fallback?.startedAt;
    const blockedAt = archivedRun?.updatedAt || fallback?.blockedAt || archivedBlock.occurredAt;
    const reason = archivedRun?.blockingReason || fallback?.reason;
    if (!runId || !startedAt || !reason || runId === current.runId || Date.parse(blockedAt) >= Date.parse(current.startedAt)) return state;

    const next = structuredClone(state);
    next.oneShotRun = {
      runId,
      sourceRequestId: archivedRun?.sourceRequestId || null,
      topicId: topic.topicId,
      proposalId: proposal.proposalId,
      status: "blocked",
      phase: "blocked",
      actor: "system",
      actorName: "系统",
      action: "已从统一异常事实恢复原验收卡点，等待从原任务继续",
      blockingReason: reason,
      resumeMode: "standard",
      startedAt,
      updatedAt: blockedAt,
      completedAt: blockedAt,
    };
    next.automationRuntime.status = "blocked";
    next.automationRuntime.pausedAt = null;
    next.automationRuntime.stopReason = reason;
    const occurredAt = new Date().toISOString();
    next.updatedAt = occurredAt;
    next.archiveRecords.push({
      recordId: `evolution-archive-${randomUUID()}`,
      deliberationId: topic.deliberationId,
      topicId: topic.topicId,
      proposalId: proposal.proposalId,
      taskId: null,
      sequenceNumber: next.archiveRecords.length + 1,
      category: "recovery",
      eventType: "one-shot.pointer-restored",
      actor: "system",
      title: "原验收运行指针已从统一异常事实恢复",
      payload: { ...archivePayload(topic, proposal, topic.deliberationId ? next.deliberations.find((item) => item.deliberationId === topic.deliberationId) || null : null), oneShotRun: structuredClone(next.oneShotRun), overwrittenRunId: current.runId, source: archivedRun ? "evolution-archive" : "event-center" },
      occurredAt,
    });
    return next;
  }

  #write(state: EvolutionStateOutDto): void {
    this.#repository.save(state);
  }
}

interface RetiredAutomationSwitches {
  automaticEvolutionEnabled: boolean;
  automaticNangongApprovalEnabled: boolean;
  automaticLinghuApprovalEnabled: boolean;
  automaticExecutionEnabled: boolean;
}

/** 旧状态中的四个独立开关只用于兼容读取；加载后立即清除，不再参与任何运行判断。 */
function migrateEvolutionState(state: EvolutionStateOutDto & Partial<RetiredAutomationSwitches>): { state: EvolutionStateOutDto; changed: boolean } {
  const {
    automaticEvolutionEnabled: _retiredEvolution,
    automaticNangongApprovalEnabled: _retiredNangongApproval,
    automaticLinghuApprovalEnabled: _retiredLinghuApproval,
    automaticExecutionEnabled: _retiredExecution,
    ...current
  } = state;
  const acceptance = migrateAcceptancePlans(current as EvolutionStateOutDto & { version?: number });
  const distribution = migrateDistributionValidation(acceptance.state);
  const retiredSwitchFound = [_retiredEvolution, _retiredNangongApproval, _retiredLinghuApproval, _retiredExecution].some((value) => typeof value === "boolean");
  const recoveryState = distribution.state.technicalRecovery === undefined
    ? { ...distribution.state, technicalRecovery: null }
    : distribution.state;
  return { state: recoveryState, changed: retiredSwitchFound || acceptance.changed || distribution.changed || recoveryState !== distribution.state };
}

/** v8/v9 没有 Host 启动验收事实；保留全部历史事实，但不把旧运行伪造为新记录。 */
function migrateAcceptancePlans(state: EvolutionStateOutDto & { version?: number }): { state: EvolutionStateOutDto; changed: boolean } {
  const proposals = state.proposals.map((proposal) => {
    const withConclusionReference = proposal.finalConclusionRecordId === undefined
      ? { ...proposal, finalConclusionRecordId: null }
      : proposal;
    if (withConclusionReference.acceptancePlan === undefined) return { ...withConclusionReference, acceptancePlan: null };
    const plan = withConclusionReference.acceptancePlan as unknown as (Record<string, unknown> & EvolutionAcceptancePlanOutDto) | null;
    if (!plan || !("materials" in plan)) return withConclusionReference;
    const { materials: _retiredFileManifest, ...activePlan } = plan;
    return { ...withConclusionReference, acceptancePlan: activePlan as unknown as EvolutionAcceptancePlanOutDto };
  });
  const changed = state.version !== 10 || proposals.some((proposal, index) => proposal !== state.proposals[index]);
  return { state: { ...state, version: 10, proposals } as EvolutionStateOutDto, changed };
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
  return { version: 10, automationSettings: { maxRoundsPerTopic: 5, maxCorrectionRounds: 5 }, automationRuntime: { status: "idle", completedRounds: 0, correctionRounds: 0, stopReason: null, startedAt: null, pausedAt: null }, oneShotConfirmation: null, oneShotRun: null, technicalRecovery: null, automationContext: { workspaceState: null, locale: "zh-CN" }, preferenceSnapshotVersion: 0, activeTopicId: null, topics: [], proposals: [], deliberations: [], archiveRecords: [], conversation: createConversation(), updatedAt: new Date().toISOString() };
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
    discoveries: normalizeDiscoveries(candidate.discoveries),
  };
}
function normalizeDiscoveries(values: HanliTopicCandidateOutDto["discoveries"]): NonNullable<HanliTopicCandidateOutDto["discoveries"]> {
  const relations = new Set(["required-for-goal", "follow-up-opportunity", "customer-decision-required", "unrelated"]);
  if (!Array.isArray(values)) return [];
  return values.slice(0, 100).map((item) => {
    if (!relations.has(item.relation)) throw new Error("新问题与客户需求的关系无效。");
    return {
      issue: required(item.issue, "新问题", 8_000), relation: item.relation,
      reason: required(item.reason, "新问题关系依据", 8_000), evidence: normalizedOptionalList(item.evidence),
      suggestedAction: required(item.suggestedAction, "新问题处理建议", 8_000),
    };
  });
}
function requireTopic(state: EvolutionStateOutDto, topicId: string) { const topic = state.topics.find((item) => item.topicId === topicId); if (!topic) throw new Error("专项课题不存在。"); return topic; }
function requireProposal(state: EvolutionStateOutDto, proposalId: string) { const proposal = state.proposals.find((item) => item.proposalId === proposalId); if (!proposal) throw new Error("演化提案不存在。"); return proposal; }
function requireAcceptancePlan(proposal: EvolutionProposalOutDto): EvolutionAcceptancePlanOutDto {
  if (!proposal.acceptancePlan) throw new Error("当前提案尚未冻结验收计划，不能记录或完成验收。 ");
  return proposal.acceptancePlan;
}
function requireDeliberation(state: EvolutionStateOutDto, deliberationId: string) { const deliberation = state.deliberations.find((item) => item.deliberationId === deliberationId); if (!deliberation) throw new Error("韩立专题研讨不存在。"); return deliberation; }
function requireDeliberationRound(deliberation: EvolutionStateOutDto["deliberations"][number], roundId: string) { const round = deliberation.rounds.find((item) => item.roundId === roundId); if (!round) throw new Error("韩立专题研讨轮次不存在。"); return round; }
function assertTopicEditableBeforeProposal(state: EvolutionStateOutDto, topic: EvolutionStateOutDto["topics"][number]): void {
  if (!["registered", "investigating"].includes(topic.status) || topic.currentProposalVersion !== 0 || state.proposals.some((item) => item.topicId === topic.topicId)) {
    throw new Error("课题已进入提案流程，不能再修改或重复提交提案。");
  }
}
function createConversation(): EvolutionStateOutDto["conversation"] {
  const now = new Date().toISOString();
  return { ownerPersonaId: "nangong-wan", conversationId: `persona-conversation-${randomUUID()}`, createdAt: now, messages: [], updatedAt: now };
}

function archiveCategory(reason: string): EvolutionArchiveCategoryValue {
  if (reason.startsWith("one-shot.")) return reason.includes("blocked") || reason.includes("orphan-retired") ? "recovery" : reason.includes("completed") ? "acceptance" : "execution";
  if (reason === "conversation.topic_group_replied") return "source";
  if (reason.startsWith("deliberation.")) return "deliberation";
  if (reason.includes("distributed")) return "distribution";
  if (reason.includes("result_decided") || reason.startsWith("acceptance.") || reason.startsWith("host-startup.")) return "acceptance";
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
    "host-startup.evidence-recorded": "记录当前专题的 Host 启动验收事实",
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
    "acceptance.legacy_plan_retired": "韩立退役冻结的旧验收计划并按当前能力重新规划",
    "acceptance.result_checked": "韩立完成适用的结果验收",
    "conversation.topic_group_replied": "专题群收到用户消息与南宫婉回复",
    "one-shot.activity": "一次性演化当前动作更新",
    "one-shot.completed": "一次性演化完整结束",
    "one-shot.blocked": "一次性演化遇到无法自动处理的阻塞",
    "one-shot.orphan-retired": "遗留的一次性演化运行状态已结束",
    "one-shot.topic-switch-retired": "用户切换独立专题，旧运行停止接收新范围",
    "one-shot.independent-topic-switched": "用户切换独立专题，旧链已退役并开始建立新专题",
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
