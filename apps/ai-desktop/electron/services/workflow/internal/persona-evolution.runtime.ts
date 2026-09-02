import type { CollaborationMemoryPort } from "../../../../contracts/services/support/capabilities/event-center/index.js";
import type { CreateLinghuRepairProposalOutDto } from "../../../../contracts/services/personas/linghu/index.js";
import type { EvolutionMutationInDto, EvolutionProposalOutDto, EvolutionTopicDossierOutDto, EvolutionWorkbenchPageOutDto, EvolutionWorkbenchPreferenceOutDto, EvolutionStateOutDto, QueryEvolutionWorkbenchInDto, SaveEvolutionWorkbenchPreferenceInDto } from "../../../../contracts/services/evolution/index.js";
import type { HanliAcceptancePlanOutDto, HanliAcceptanceRunOutDto } from "../../../../contracts/services/personas/hanli/index.js";
import type { CreateNangongTopicInDto, SendNangongConversationMessageInDto } from "../../../../contracts/services/personas/nangong/index.js";
import type { ConfigurePersonaWorkflowInDto, PersonaWorkflowActionInDto } from "../../../../contracts/services/workflow/index.js";
import type { SendMessageOutDto } from "../../../../contracts/services/support/capabilities/conversation/index.js";
import type { EventCenterExceptionInDto } from "../../../../contracts/services/support/capabilities/event-center/index.js";
import type { CollaborationTimelineBusinessEventOutDto } from "../../../../contracts/services/workflow/index.js";
import type { CodexStreamEventOutDto } from "../../../../contracts/services/support/platform/codex/index.js";
import type { CollaborationWorkflowFacade } from "../index.js";
import type { PromptLibraryPort } from "../../support/capabilities/prompts/index.js";
import { EvolutionFlowOrchestrator } from "./evolution-flow.orchestrator.js";
import type { HanliWorkflowPort } from "../../personas/hanli/index.js";
import { createNangongRuntime, createNangongTaskDistribution, type NangongRuntime } from "../../personas/nangong/index.js";
import {
  createEvolutionMutationCoordinator,
  type EvolutionMutationPort,
  type EvolutionStatePort,
} from "../../evolution/index.js";

export interface PersonaEvolutionRuntimeOptions {
  store: EvolutionStatePort;
  prompts: PromptLibraryPort;
  collaboration: CollaborationWorkflowFacade;
  hanli: HanliWorkflowPort;
  conversation: {
    send(request: SendNangongConversationMessageInDto, context: string): Promise<SendMessageOutDto>;
    newChat(): Promise<void>;
  };
  investigateRevision?: (prompt: string, workspaceState: EvolutionStateOutDto["topics"][number]["workspaceState"], locale: EvolutionStateOutDto["topics"][number]["locale"]) => Promise<string>;
  planDistribution?: (prompt: string, workspaceState: EvolutionStateOutDto["topics"][number]["workspaceState"], locale: EvolutionStateOutDto["topics"][number]["locale"], emit: (event: CodexStreamEventOutDto) => void) => Promise<string>;
  recordEvent(type: string, details: Record<string, unknown>, taskId?: string): void;
  recordFailure?(input: EventCenterExceptionInDto): void;
  recordTimelineEvent?: (event: CollaborationTimelineBusinessEventOutDto) => void;
  recordTimelineStream?: (taskId: string, memberId: string, event: CodexStreamEventOutDto) => void;
  memory?: CollaborationMemoryPort | null;
  readDossier?: (topicId: string, state: EvolutionStateOutDto) => EvolutionTopicDossierOutDto;
  queryWorkbench?: (request: QueryEvolutionWorkbenchInDto) => EvolutionWorkbenchPageOutDto;
  getWorkbenchPreference?: (perspective: "nangong" | "hanli", nodeId: string) => EvolutionWorkbenchPreferenceOutDto | null;
  saveWorkbenchPreference?: (request: SaveEvolutionWorkbenchPreferenceInDto) => EvolutionWorkbenchPreferenceOutDto;
  beginMutation?: (topicId: string, action: string, request: EvolutionMutationInDto, currentStateVersion: string) => "started" | "completed";
  completeMutation?: (idempotencyKey: string, resultStateVersion: string) => void;
  failMutation?: (idempotencyKey: string, error: unknown) => void;
  newConversationRetryDelaysMs?: number[];
}

/** 保持自动演化、自动审批和自动执行三道独立开关，并只在审批通过后调用协同分发。 */
/**
 * 跨人物演化运行时。
 *
 * 业务作用：在迁移后的唯一组合点连接南宫、韩立、Evolution 与协作 Workflow，
 * 对外由各人物 Facade 按职责裁剪方法，不再把这一完整运行对象冒充为南宫人物能力。
 */
export class PersonaEvolutionRuntime {
  readonly #store: EvolutionStatePort;
  readonly #collaboration: CollaborationWorkflowFacade;
  readonly #hanli: HanliWorkflowPort;
  readonly #planDistribution: NonNullable<PersonaEvolutionRuntimeOptions["planDistribution"]>;
  readonly #recordEvent: PersonaEvolutionRuntimeOptions["recordEvent"];
  readonly #recordFailure: NonNullable<PersonaEvolutionRuntimeOptions["recordFailure"]>;
  readonly #memory: CollaborationMemoryPort | null;
  readonly #readDossier: PersonaEvolutionRuntimeOptions["readDossier"];
  readonly #queryWorkbench: PersonaEvolutionRuntimeOptions["queryWorkbench"];
  readonly #getWorkbenchPreference: PersonaEvolutionRuntimeOptions["getWorkbenchPreference"];
  readonly #saveWorkbenchPreference: PersonaEvolutionRuntimeOptions["saveWorkbenchPreference"];
  readonly #mutations: EvolutionMutationPort;
  readonly nangongRuntime: NangongRuntime;
  // 流程判断器只根据已保存事实决定下一步，不替人物作审批决定。
  readonly #flow = new EvolutionFlowOrchestrator();
  #timer: ReturnType<typeof setInterval> | null = null;
  #running = false;
  #oneShotAcceptanceRunner: ((plan: HanliAcceptancePlanOutDto) => Promise<HanliAcceptanceRunOutDto>) | null = null;

  /**
   * 组装跨人物演化顺序以及南宫人物入口。
   * 真实传参示例：主进程传入 Evolution 状态、协作 Workflow、HanliWorkflowPort 和南宫会话端口。
   * 真实返回示例：构造完成后可通过 Workflow 推进轮转，并通过 nangongRuntime 取得南宫 Facade。
   * 异常或副作用示例：缺少韩立公开端口会在类型检查或启动装配时阻断，不会回退创建韩立内部服务。
   */
  constructor(options: PersonaEvolutionRuntimeOptions) {
    // Evolution 是专题和提案事实的唯一所有者，南宫只通过端口读写。
    this.#store = options.store;
    // Workflow 负责把通过审批的任务交给真实执行人。
    this.#collaboration = options.collaboration;
    // Workflow 只持有韩立公开门面，不创建或读取韩立 internal 服务。
    this.#hanli = options.hanli;
    // 分发计划是可替换 Port，默认值只负责报告缺失能力。
    this.#planDistribution = options.planDistribution || (async () => { throw new Error("南宫婉任务拆分调查尚未接入。"); });
    // 正常事件与异常事件分开登记，页面才能区分业务等待和技术故障。
    this.#recordEvent = options.recordEvent;
    this.#recordFailure = options.recordFailure || (() => undefined);
    // 记忆和工作台查询属于可选读模型；数据库不可用时由公开方法给出明确说明。
    this.#memory = options.memory || null;
    this.#readDossier = options.readDossier;
    this.#queryWorkbench = options.queryWorkbench;
    this.#getWorkbenchPreference = options.getWorkbenchPreference;
    this.#saveWorkbenchPreference = options.saveWorkbenchPreference;
    // 所有专题写动作共用同一个幂等和互斥协调器。
    this.#mutations = createEvolutionMutationCoordinator({ begin: options.beginMutation, complete: options.completeMutation, fail: options.failMutation });
    // 南宫人物在自己的模块内装配业务服务；Workflow 只提供跨人物推进和成员查询端口。
    const taskDistribution = createNangongTaskDistribution({
      store: this.#store,
      mutations: this.#mutations,
      collaboration: this.#collaboration,
      recordEvent: this.#recordEvent,
      timeline: options.recordTimelineEvent,
      timelineStream: options.recordTimelineStream,
      plan: this.#planDistribution,
      prompts: options.prompts,
    });
    this.nangongRuntime = createNangongRuntime({
      store: this.#store,
      prompts: options.prompts,
      mutations: this.#mutations,
      conversation: options.conversation,
      memory: this.#memory,
      investigateRevision: options.investigateRevision,
      recordEvent: this.#recordEvent,
      recordFailure: this.#recordFailure,
      proposalReview: {
        requestReview: (proposalId) => this.#hanli.requestProposalReview(proposalId),
      },
      memberDirectory: {
        resolveEnabledDisplayName: (memberId) => this.#collaboration.state().members.find((item) => item.memberId === memberId && item.enabled)?.displayName || null,
      },
      oneShotWorkflow: {
        hasLiveOwner: (state) => this.#oneShotHasLiveOwner(state),
        advance: async () => this.#tick(),
        blockFailure: (kind, operation, error, reason, details) => this.#blockOneShotFailure(kind, operation, error, reason, details),
      },
      taskDistribution,
      newConversationRetryDelaysMs: options.newConversationRetryDelaysMs,
    });
    // 分发由 Workflow 创建，并把 AI 返回值先解析成确定的结构化计划。
  }

  /** 读取当前 Evolution 快照；返回值是副本，调用方不能绕过 Store 直接改状态。 */
  state(): EvolutionStateOutDto { return this.#store.state(); }

  /** 按专题读取来源、研讨、提案和执行档案；数据库读模型不可用时使用当前状态安全降级。 */
  dossier(topicId: string): EvolutionTopicDossierOutDto {
    const state = this.state();
    if (this.#readDossier) return this.#readDossier(topicId, state);
    const topic = state.topics.find((item) => item.topicId === topicId);
    if (!topic) throw new Error("专题池中不存在该专题。 ");
    const deliberation = topic.deliberationId ? state.deliberations.find((item) => item.deliberationId === topic.deliberationId) || null : null;
    return { topic, deliberation, proposals: state.proposals.filter((item) => item.topicId === topicId), archiveRecords: state.archiveRecords.filter((item) => item.topicId === topicId || item.deliberationId === topic.deliberationId), executionRecords: [] };
  }
  /** 查询演化工作台一页数据；数据库不可用时阻止返回不完整的伪结果。 */
  queryWorkbench(request: QueryEvolutionWorkbenchInDto): EvolutionWorkbenchPageOutDto {
    if (!this.#queryWorkbench) throw new Error("专题演化数据库读模型不可用，请检查数据库初始化状态。");
    return this.#queryWorkbench(request);
  }
  /** 读取指定人物和树节点的显示偏好；未保存时返回 null。 */
  getWorkbenchPreference(perspective: "nangong" | "hanli", nodeId: string): EvolutionWorkbenchPreferenceOutDto | null { return this.#getWorkbenchPreference?.(perspective, nodeId) || null; }

  /** 保存分页或展开偏好；持久化不可用时明确失败，不只更新当前页面内存。 */
  saveWorkbenchPreference(request: SaveEvolutionWorkbenchPreferenceInDto): EvolutionWorkbenchPreferenceOutDto {
    if (!this.#saveWorkbenchPreference) throw new Error("专题演化视图偏好数据库不可用。");
    return this.#saveWorkbenchPreference(request);
  }
  /** 订阅已持久化的 Evolution 状态变化，并返回取消订阅函数。 */
  subscribe(listener: Parameters<EvolutionStatePort["subscribe"]>[0]) { return this.#store.subscribe(listener); }

  /** 启动一次立即检查和三十秒周期检查；重复调用不会创建第二个计时器。 */
  start(): void { if (!this.#timer) { void this.#tick(); this.#timer = setInterval(() => void this.#tick(), 30_000); } }

  /** 停止自动检查；已持久化的专题和恢复点不会被清除。 */
  stop(): void { if (this.#timer) clearInterval(this.#timer); this.#timer = null; }
  /** 主进程窗口层登记真实应用验收执行器；业务状态仍由本 Facade 和原结果审批接口推进。 */
  setOneShotAcceptanceRunner(runner: (plan: HanliAcceptancePlanOutDto) => Promise<HanliAcceptanceRunOutDto>): void { this.#oneShotAcceptanceRunner = runner; }
  /** 协作任务状态变化时立即核对一次性流程，避免等待固定轮询间隔。 */
  notifyWorkflowChanged(): void { void this.#tick(); }
  /** 把用户已确认的范围登记为正式专题，不自动创建提案或执行任务。 */
  createTopic(request: CreateNangongTopicInDto): EvolutionStateOutDto { return this.#store.createTopic(request); }
  /** 独立开关一个自动化环节，其他审批或执行开关保持原值。 */
  setAutomation(kind: "evolution" | "nangong-approval" | "linghu-approval" | "execution", enabled: boolean): EvolutionStateOutDto { return this.#store.setAutomation(kind, enabled); }
  /** 保存轮询间隔、最大轮数等受控参数，不立即推进业务状态。 */
  configureAutomation(request: ConfigurePersonaWorkflowInDto): EvolutionStateOutDto { return this.#store.configureAutomation(request); }
  /** 启动、暂停、恢复或停止自动流程，并保留可恢复的当前卡点。 */
  controlAutomation(action: PersonaWorkflowActionInDto): EvolutionStateOutDto { return this.#store.controlAutomation(action); }
  /** 只有任务与人物运行事实互相吻合时，才允许旧 running 状态阻止新的用户确认。 */
  #oneShotHasLiveOwner(state: EvolutionStateOutDto): boolean {
    const run = state.oneShotRun;
    if (!run || run.status !== "running") return false;
    if (!["executing", "testing"].includes(run.phase)) return true;
    const proposal = run.proposalId ? state.proposals.find((item) => item.proposalId === run.proposalId) : null;
    if (!proposal?.distributedTaskIds.length) return false;
    const collaboration = this.#collaboration.state();
    return collaboration.tasks
      .filter((task) => proposal.distributedTaskIds.includes(task.taskId) && !["integrated", "cancelled"].includes(task.state))
      .some((task) => collaboration.members.some((member) => member.currentTaskId === task.taskId && !["idle", "offline"].includes(member.state)));
  }
  createLinghuRepairProposal(request: CreateLinghuRepairProposalOutDto): EvolutionStateOutDto {
    const next = this.#store.createLinghuRepairProposal(request);
    return this.#hanli.requestProposalReview(next.proposals.at(-1)!.proposalId);
  }

  /** 从当前持久化卡点恢复同一轮；恢复后立即沿原状态机推进，不触碰长期自动开关。 */
  async resumeOneShotRun(): Promise<EvolutionStateOutDto> {
    const before = this.state();
    const run = before.oneShotRun;
    const proposal = run?.proposalId ? before.proposals.find((item) => item.proposalId === run.proposalId) : null;
    if (proposal?.status === "blocked") {
      const blockedTasks = this.#collaboration.state().tasks.filter((task) => proposal.distributedTaskIds.includes(task.taskId) && ["blocked", "test-failed"].includes(task.state));
      for (const task of blockedTasks) {
        await this.#collaboration.recoverTask(task.taskId, `用户已从一次性演化卡点明确继续：${itemFailureReason(task)}`);
      }
    }
    this.#store.resumeOneShotRun();
    await this.#tick();
    return this.state();
  }

  async #dispatch(proposalId: string, request?: EvolutionMutationInDto): Promise<EvolutionStateOutDto> {
    const initialState = this.state();
    const mutation = request || { expectedStateVersion: initialState.updatedAt, idempotencyKey: `automatic-dispatch:${proposalId}:${initialState.updatedAt}` };
    return this.nangongRuntime.facade.distributeProposal(proposalId, mutation);
  }

  /** 一次性托管只调度现有动作；每次推进到需要等待真实任务状态的位置即返回。 */
  async #advanceOneShot(): Promise<EvolutionStateOutDto> {
    const transitionLimit = Math.max(12, this.state().automationSettings.maxCorrectionRounds * 3 + 8);
    for (let transition = 0; transition < transitionLimit; transition += 1) {
      let state = this.state();
      const run = state.oneShotRun;
      if (!run || run.status !== "running" || !run.topicId) return state;
      const topic = state.topics.find((item) => item.topicId === run.topicId);
      if (!topic) return this.#blockOneShotFailure("technical", "load_one_shot_topic", new Error("一次性运行关联的演化课题不存在。"), "一次性运行关联的演化课题不存在。");
      const proposals = state.proposals.filter((item) => item.topicId === topic.topicId).sort((left, right) => left.version - right.version);
      let proposal = proposals.at(-1) || null;

      if (!proposal) {
        state = this.#store.updateOneShotRun("forming-proposal", "nangong-wan", "南宫婉", "正在根据课题事实形成实施提案", topic.topicId, null);
        const content = `课题：${topic.title}\n\n目标：${topic.goal}\n\n调查事实：\n${topic.evidence.map((item) => `- ${item}`).join("\n")}\n\n推荐方向：在已登记范围内实施，并保持排除项不变。`;
        state = this.nangongRuntime.facade.createProposal(topic.topicId, { type: "代码修正", content, risks: ["实施可能影响既有调用方，必须通过原测试和验收门禁确认"], rollbackPlan: "保留课题、提案、任务和版本记录；失败时沿原恢复点返修，不覆盖已完成事实。" });
        proposal = state.proposals.at(-1)!;
        this.#store.updateOneShotRun("approving", "han-li", "韩立", "正在审批南宫婉提交的演化方向", topic.topicId, proposal.proposalId);
        continue;
      }

      const flowAction = this.#flow.next(proposal);
      if (flowAction === "await-approval") {
        this.#store.updateOneShotRun("approving", "han-li", "韩立", `正在审批提案 v${proposal.version}`, topic.topicId, proposal.proposalId);
        try { await this.#hanli.reviewAndDecideProposal(proposal.proposalId); }
        catch (error) {
          const reason = `韩立方向审批结果无法处理：${error instanceof Error ? error.message : String(error)}`;
          return this.#blockOneShotFailure("technical", "review_one_shot_proposal", error, reason);
        }
        continue;
      }

      if (flowAction === "supplement") {
        const correctionRounds = proposals.filter((item) => item.supersedesProposalId !== null).length;
        if (correctionRounds >= state.automationSettings.maxCorrectionRounds) {
          const reason = `提案返修已经达到 ${state.automationSettings.maxCorrectionRounds} 轮，韩立仍未确认方向可执行。`;
          return this.#blockOneShotFailure("business", "revision_budget_exhausted", new Error(reason), reason);
        }
        this.#store.updateOneShotRun("revising", "nangong-wan", "南宫婉", `正在按韩立退回项重新调查提案 v${proposal.version}`, topic.topicId, proposal.proposalId);
        try { await this.nangongRuntime.facade.investigateAndReviseReturnedProposal(proposal.proposalId); }
        catch (error) {
          const reason = `南宫婉重新调查失败：${error instanceof Error ? error.message : String(error)}`;
          return this.#blockOneShotFailure("technical", "investigate_and_revise_proposal", error, reason);
        }
        continue;
      }

      if (flowAction === "dispatch") {
        this.#store.updateOneShotRun("distributing", "nangong-wan", "南宫婉", "审批已通过，正在拆分并分发任务", topic.topicId, proposal.proposalId);
        try { await this.#dispatch(proposal.proposalId); }
        catch (error) {
          const reason = `南宫婉任务拆分或分发失败：${error instanceof Error ? error.message : String(error)}`;
          return this.#blockOneShotFailure("technical", "plan_and_dispatch_one_shot", error, reason);
        }
        continue;
      }

      if (flowAction === "monitor-execution") {
        const collaborationState = this.#collaboration.state();
        const tasks = collaborationState.tasks.filter((task) => proposal!.distributedTaskIds.includes(task.taskId));
        if (proposal.status === "blocked") {
          const blockedTasks = tasks.filter((item) => ["blocked", "test-failed"].includes(item.state));
          const blockedTask = blockedTasks[0];
          const reason = blockedTask
            ? `${taskOwnerName(collaborationState, blockedTask)}负责的“${blockedTask.snapshot.title}”停在${taskStageName(blockedTask)}；发现：${itemFailureReason(blockedTask)}`
            : `提案“${proposal.title}”已经进入阻塞态，但没有找到对应的阻塞任务记录。`;
          const failureKind = blockedTask?.integrationFailure?.kind || blockedTask?.state || "unknown";
          const details = {
            taskId: blockedTask?.taskId || null,
            taskTitle: blockedTask?.snapshot.title || null,
            executorMemberId: blockedTask?.executorMemberId || null,
            taskState: blockedTask?.state || null,
            taskPhase: blockedTask?.phase || null,
            integrationFailureKind: blockedTask?.integrationFailure?.kind || null,
            conflictFiles: blockedTask?.integrationFailure?.conflictFiles || [],
            blockedTaskCount: blockedTasks.length,
          };
          if (!blockedTask || blockedTask.integrationFailure?.kind === "local-change-ownership") {
            return this.#blockOneShotFailure(
              "technical",
              `one_shot_task_blocked:${failureKind}`,
              new Error(reason),
              `${reason}。本轮已保留在当前卡点；只有本地修改归属事实明确或用户从卡点继续时才会重新执行。`,
              details,
            );
          }
          const run = state.oneShotRun;
          this.#recordFailure({
            kind: "technical",
            sourceType: "system",
            sourceId: "nangong-evolution",
            operation: `one_shot_task_waiting_for_linghu:${failureKind}`,
            error: new Error(reason),
            correlationId: topic.topicId,
            fingerprint: `nangong-one-shot:${run?.runId || "unknown"}:waiting-for-linghu:${blockedTask.taskId}:${failureKind}`,
            details: { runId: run?.runId || null, topicId: topic.topicId, proposalId: proposal.proposalId, ...details },
          });
          this.#store.updateOneShotRun("testing", "linghu-ancestor", "令狐老祖", `${reason}；正在沿统一异常入口修正，取得新的执行或测试事实后本轮会自动继续`, topic.topicId, proposal.proposalId);
          return this.state();
        }
        const testing = proposal.status === "verifying" || tasks.some((item) => item.unifiedTest?.status === "running" || ["unified-testing", "integrating", "queued-integration"].includes(item.state));
        const activity = currentExecutionActivity(collaborationState, tasks, proposal.title);
        this.#store.updateOneShotRun(
          testing ? "testing" : "executing",
          testing ? "linghu-ancestor" : "codex",
          testing ? "令狐老祖" : activity.actorName,
          testing ? "正在执行统一测试、集成和恢复门禁" : activity.action,
          topic.topicId,
          proposal.proposalId,
        );
        return this.state();
      }

      if (flowAction === "accept-result") {
        this.#store.updateOneShotRun("accepting", "han-li", "韩立", "正在生成检查计划并验收真实应用界面", topic.topicId, proposal.proposalId);
        if (!this.#oneShotAcceptanceRunner) return this.#blockOneShotFailure("technical", "run_real_application_acceptance", new Error("韩立真实应用验收执行器尚未接入。"), "韩立真实应用验收执行器尚未接入。");
        try {
          const existingPlan = [...state.archiveRecords].reverse().find((record) => record.proposalId === proposal!.proposalId && record.eventType === "acceptance.plan_generated")?.payload.acceptancePlan as HanliAcceptancePlanOutDto | undefined;
          const plan = existingPlan || await this.#hanli.generateAcceptancePlan(proposal.proposalId);
          const runResult = await this.#oneShotAcceptanceRunner(plan);
          this.#hanli.completeAutomaticAcceptance(runResult, `one-shot-result:${run.runId}:${proposal.proposalId}:${runResult.runId}`);
        } catch (error) {
          const reason = `韩立真实应用验收失败：${error instanceof Error ? error.message : String(error)}`;
          return this.#blockOneShotFailure("technical", "run_real_application_acceptance", error, reason);
        }
        continue;
      }

      if (flowAction === "complete" || topic.status === "completed") {
        state = this.#store.finishOneShotRun();
        return this.#store.appendConversation("nangong", `本轮演化已经完整完成：课题“${topic.title}”已通过韩立审批、任务执行、令狐统一测试和韩立真实界面验收，全部记录已归档到专题工作台。`, []);
      }
      return state;
    }
    return this.#blockOneShotFailure("technical", "advance_one_shot_transition_limit", new Error("一次性流程在单次推进中出现过多连续状态变化。"), "一次性流程在单次推进中出现过多连续状态变化，已保留恢复点等待检查。");
  }

  /** 被转换为可恢复暂停态的失败也必须进入统一异常中心，不能因 catch 而丢失。 */
  #blockOneShotFailure(kind: "technical" | "business", operation: string, error: unknown, reason: string, details: Record<string, unknown> = {}): EvolutionStateOutDto {
    const state = this.state();
    const run = state.oneShotRun;
    const topicId = run?.topicId || state.activeTopicId;
    this.#recordFailure({
      kind,
      sourceType: kind === "business" ? "member" : "system",
      sourceId: kind === "business" ? "nangong-wan" : "nangong-evolution",
      operation,
      error,
      correlationId: topicId || run?.runId || null,
      fingerprint: `nangong-one-shot:${run?.runId || "unknown"}:${operation}:${run?.proposalId || "none"}`,
      details: { runId: run?.runId || null, topicId: topicId || null, proposalId: run?.proposalId || null, phase: run?.phase || null, recoveryPoint: run?.action || null, ...details },
    });
    return this.#store.blockOneShotRun(reason);
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
          state = await this.nangongRuntime.facade.investigateAndReviseReturnedProposal(proposal.proposalId);
        }
      }
      for (const proposal of state.proposals.filter((item) => item.distributedTaskIds.length && ["executing", "verifying", "blocked"].includes(item.status))) {
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
      for (const proposal of this.#flow.automaticApprovalQueue(state)) state = this.#hanli.autoApprove(proposal.proposalId);
      for (const proposal of this.#flow.automaticDistributionQueue(state)) state = await this.#dispatch(proposal.proposalId);
      if (!state.automaticEvolutionEnabled) return;
      const hasOpenTopicFlow = state.topics.some((item) => !["completed", "rejected"].includes(item.status));
      if (!hasOpenTopicFlow) state = await this.#hanli.advanceDeliberation();
      const topic = state.topics.find((item) => ["registered", "investigating"].includes(item.status));
      if (!topic || state.proposals.some((item) => item.topicId === topic.topicId && item.status === "pending-approval")) return;
      const content = `课题：${topic.title}\n\n目标：${topic.goal}\n\n调查事实：\n${topic.evidence.map((item) => `- ${item}`).join("\n")}\n\n推荐方向：在已登记范围内实施，并保持排除项不变。`;
      let next = this.nangongRuntime.facade.createProposal(topic.topicId, { type: "代码修正", content, risks: ["实施结果可能与既有调用方产生兼容影响"], rollbackPlan: "保留提案版本和关联任务，失败时撤销任务分支且不覆盖历史提案。" });
      const proposal = next.proposals.at(-1)!;
      if (next.automaticNangongApprovalEnabled) next = this.#hanli.autoApprove(proposal.proposalId);
      const decided = requireProposal(next, proposal.proposalId);
      if (next.automaticExecutionEnabled && decided.status === "approved") await this.#dispatch(proposal.proposalId);
    } catch (error) {
      const state = this.state();
      if (state.oneShotRun?.status === "running") this.#blockOneShotFailure("technical", "nangong_evolution_tick", error, `南宫婉自动推进失败：${error instanceof Error ? error.message : String(error)}`);
      else this.#recordFailure({ kind: "technical", sourceType: "system", sourceId: "nangong-evolution", operation: "nangong_evolution_tick", error, correlationId: state.activeTopicId, fingerprint: `nangong-evolution-tick:${state.activeTopicId || "no-topic"}` });
    } finally { this.#running = false; }
  }
}

function requireProposal(state: EvolutionStateOutDto, proposalId: string): EvolutionProposalOutDto { const proposal = state.proposals.find((item) => item.proposalId === proposalId); if (!proposal) throw new Error("演化提案不存在。"); return proposal; }

/** 运行中人物以任务当前阶段的权威成员 ID 为准，不能让上一阶段遗留的 currentHandler 覆盖真实执行者。 */
function taskOwnerName(state: ReturnType<CollaborationWorkflowFacade["state"]>, task: ReturnType<CollaborationWorkflowFacade["state"]>["tasks"][number]): string {
  const memberId = task.executorMemberId;
  return state.members.find((member) => member.memberId === memberId)?.displayName
    || (memberId === task.originalExecutor?.memberId ? task.originalExecutor.displayName : null)
    || task.currentHandler?.displayName
    || "未识别负责人";
}

function taskStageName(task: ReturnType<CollaborationWorkflowFacade["state"]>["tasks"][number]): string {
  if (["ready-for-integration", "queued-integration", "integrating"].includes(task.state) || task.integrationFailure) return "版本集成阶段";
  if (["unified-testing", "test-failed"].includes(task.state)) return "统一测试阶段";
  if (task.state === "awaiting-restart") return "应用重启验收阶段";
  return "任务执行阶段";
}

function currentExecutionActivity(
  state: ReturnType<CollaborationWorkflowFacade["state"]>,
  tasks: ReturnType<CollaborationWorkflowFacade["state"]>["tasks"],
  fallbackTitle: string,
): { actorName: string; action: string } {
  const active = tasks
    .filter((task) => !["integrated", "cancelled"].includes(task.state))
    .sort((left, right) => Date.parse(right.updatedAt || right.createdAt) - Date.parse(left.updatedAt || left.createdAt));
  const selected = active.length ? active : tasks.slice(-1);
  const actors = [...new Set(selected.map((task) => taskOwnerName(state, task)))];
  const actorName = actors.join("、") || "执行成员";
  if (selected.length <= 1) return { actorName, action: `正在执行：${selected[0]?.snapshot.title || fallbackTitle}` };
  const titles = selected.slice(0, 3).map((task) => `“${task.snapshot.title}”`).join("、");
  return { actorName, action: `正在并行执行 ${selected.length} 个任务：${titles}${selected.length > 3 ? "等" : ""}` };
}

function itemFailureReason(task: ReturnType<CollaborationWorkflowFacade["state"]>["tasks"][number]): string {
  return task.blockingReason || task.repairFailureReason || task.unifiedTest?.failureReason || `任务 ${task.snapshot.title} 未能继续，交给令狐按原恢复线路处理。`;
}
