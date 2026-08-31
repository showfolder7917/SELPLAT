// 工作区和语言由主进程组合根读取，令狐不自行解析用户设置。
import type { Locale, WorkspaceState } from "../../../../contracts/desktop/desktop.js";
// Coordinator 状态是检测、恢复和派发的权威来源。
import type { CollaborationMember, CollaborationState, CollaborationTask, DesktopOperatingMode, SubmitCollaborationTaskRequest } from "../../../../contracts/collaboration/workflow/index.js";
// 令狐快照、模块和完整状态使用跨进程纯协议，页面与主进程共享同一数据形状。
import type {
  CreateLinghuRepairProposalOutDto,
  LinghuAutomaticFlowSnapshotOutDto,
  LinghuAutomationStateOutDto,
} from "../../../../contracts/collaboration/linghu/index.js";
// 测试资源快照只读注入，Facade 不直接争抢端口或构建目录。
import type { TestResourceCoordinatorState } from "../../../../contracts/capabilities/testing/index.js";
// 修正方案进入南宫演化状态与韩立审批链，令狐不建立旁路审批。
import type { EvolutionState } from "../../../../contracts/collaboration/evolution/index.js";
// 统一异常记录由 Event Center 产生，本入口只负责受理和触发检查。
import type { WorkflowExceptionRecord } from "../../../../contracts/governance/workflow.js";
// Store 持有状态，模块顺序是轮转的唯一事实。
import { LINGHU_AUTOMATION_MODULES, LinghuAutomationStore } from "./internal/linghu-automation.store.js";
// 纯分析函数独立在无副作用模块内，Facade 只编排决策与动作。
import { automaticFlowSnapshots, faultFingerprint, moduleCompletionReport, moduleInstruction, moduleLabel, taskHumanReport, testResourceContext } from "./internal/linghu-flow.analyzer.js";
// 基础设施异常类型留在 internal，外部只能通过 Facade 的静态判断入口识别。
import { isUnifiedTestInfrastructureError } from "../../capabilities/testing/index.js";

// 固定人物 ID 用于任务发起人、恢复负责人和审计关联。
const LINGHU_MEMBER_ID = "linghu-ancestor";

/** 令狐调用协作工作流所需的最小端口；具体 Coordinator 只在组合根实现本接口。 */
export interface LinghuCollaborationPort {
  // 返回协作快照，令狐不能直接持有或修改协作 Store。
  state(): CollaborationState;
  // 自动保障开启时确保系统进入协作模式。
  setMode(mode: DesktopOperatingMode): CollaborationState;
  // 派发当前令狐模块任务。
  submitTask(request: SubmitCollaborationTaskRequest): CollaborationState;
  // 已有执行人可以继续处理原任务。
  continueTask(taskId: string, recoveryActor?: Pick<CollaborationMember, "memberId" | "displayName">): CollaborationState;
  // 停滞任务通过正式协调入口进入恢复。
  recoverTask(taskId: string, reason: string): Promise<CollaborationState>;
  // 统一测试失败沿原工作树生成修正结果。
  repairFailedUnifiedTest(taskId: string): Promise<boolean>;
}

/** Facade 的所有外部能力都由组合根注入，便于测试和运行边界审查。 */
export interface LinghuAutomationFacadeOptions {
  // Store 是令狐状态唯一写入者。
  store: LinghuAutomationStore;
  // Coordinator 是协同任务唯一副作用入口。
  collaboration: LinghuCollaborationPort;
  // 工作区读取器在真正提交任务或提案时获取最新登记值。
  readWorkspaceState(): WorkspaceState;
  // 语言读取器保持新任务与当前用户设置一致。
  locale(): Locale;
  // 事件端口写入统一事件中心，并可关联具体任务。
  recordEvent(type: string, details: Record<string, unknown>, taskId?: string): void;
  // 资源读取器只返回快照，申请和释放由 Runner 完成。
  readTestResourceState(): TestResourceCoordinatorState;
  // 统一测试通过后由组合根安排受控重启。
  runUnifiedTestAndRestart(onVerified: () => void): Promise<void>;
  // 以下三个可选端口把令狐修正接入既有演化审批链。
  submitRepairProposal?(request: CreateLinghuRepairProposalOutDto): EvolutionState;
  readEvolutionState?(): EvolutionState;
  reviseReturnedProposal?(proposalId: string): Promise<EvolutionState>;
}

/** 令狐老祖自动保障的唯一入口；界面和定时器只调用本 Facade，不直接依赖调度、恢复与持久化实现。 */
export class LinghuAutomationFacade {
  /** 外部流程只能通过 Facade 判断统一测试是否属于基础设施失败，不能导入 internal 异常类。 */
  static isUnifiedTestInfrastructureError(error: unknown): boolean {
    // instanceof 判断仍在令狐模块内部完成，Runner 的具体异常类型不会进入公开 index。
    return isUnifiedTestInfrastructureError(error);
  }

  // 私有字段保存注入端口，外部模块不能绕过公开方法调用内部实现。
  readonly #store: LinghuAutomationStore;
  readonly #collaboration: LinghuCollaborationPort;
  readonly #readWorkspaceState: () => WorkspaceState;
  readonly #locale: () => Locale;
  readonly #recordEvent: LinghuAutomationFacadeOptions["recordEvent"];
  readonly #readTestResourceState: LinghuAutomationFacadeOptions["readTestResourceState"];
  readonly #runUnifiedTestAndRestart: LinghuAutomationFacadeOptions["runUnifiedTestAndRestart"];
  readonly #submitRepairProposal: LinghuAutomationFacadeOptions["submitRepairProposal"];
  readonly #readEvolutionState: LinghuAutomationFacadeOptions["readEvolutionState"];
  readonly #reviseReturnedProposal: LinghuAutomationFacadeOptions["reviseReturnedProposal"];
  // timer 为 null 表示尚未启动或已经停止；重复 start 不会创建多重轮询。
  #timer: ReturnType<typeof setInterval> | null = null;
  // checking 防止定时器、异常通知和手动检查同时执行恢复副作用。
  #checking = false;

  /** 保存组合根注入的所有端口；构造本身不启动检测。 */
  constructor(options: LinghuAutomationFacadeOptions) {
    // 每个字段保持原端口引用，方便测试替换单一依赖。
    this.#store = options.store;
    this.#collaboration = options.collaboration;
    this.#readWorkspaceState = options.readWorkspaceState;
    this.#locale = options.locale;
    this.#recordEvent = options.recordEvent;
    this.#readTestResourceState = options.readTestResourceState;
    this.#runUnifiedTestAndRestart = options.runUnifiedTestAndRestart;
    this.#submitRepairProposal = options.submitRepairProposal;
    this.#readEvolutionState = options.readEvolutionState;
    this.#reviseReturnedProposal = options.reviseReturnedProposal;
  }

  /** 返回 Store 的深复制状态快照。 */
  state(): LinghuAutomationStateOutDto { return this.#store.state(); }
  /** 把状态订阅转交 Store，Facade 不维护第二套事件列表。 */
  subscribe(listener: Parameters<LinghuAutomationStore["subscribe"]>[0]) { return this.#store.subscribe(listener); }

  /** 响应唯一自动执行开关，并在开启后立即进行第一轮检查。 */
  setEnabled(enabled: boolean): LinghuAutomationStateOutDto {
    // 先持久化用户选择，再记录事件和触发副作用。
    const state = this.#store.setEnabled(enabled);
    // 审计事件保留开启时的循环和模块，方便恢复问题定位。
    this.#recordEvent(enabled ? "linghu.automation.enabled" : "linghu.automation.disabled", { cycle: state.cycle, module: state.currentModule });
    if (enabled) {
      // 自动保障依赖协作状态；开启时确保 Coordinator 进入 collaboration 模式。
      if (this.#collaboration.state().mode !== "collaboration") this.#collaboration.setMode("collaboration");
      // 不等待检查完成即可向按钮返回已持久化状态，实际结果通过状态事件推送。
      void this.checkNow();
    }
    return state;
  }

  // 文案 CRUD 直接委托 Store，避免 Facade 复制校验和原子持久化逻辑。
  createPrompt(request: Parameters<LinghuAutomationStore["createPrompt"]>[0]) { return this.#store.createPrompt(request); }
  updatePrompt(promptId: string, request: Parameters<LinghuAutomationStore["updatePrompt"]>[1]) { return this.#store.updatePrompt(promptId, request); }
  deletePrompt(promptId: string) { return this.#store.deletePrompt(promptId); }
  selectPrompt(promptId: string) { return this.#store.selectPrompt(promptId); }

  start(): void {
    // 已存在 timer 说明检测已启动，重复调用直接返回。
    if (this.#timer) return;
    // 轮询间隔来自持久化协议，定时器每次只调用并发保护后的 checkNow。
    this.#timer = setInterval(() => void this.checkNow(), this.state().pollIntervalMs);
    // 启动后立即检查，不等待第一个 30 秒间隔。
    void this.checkNow();
  }

  /** 停止定时器；用户 enabled 选择仍保留在 Store，供正常应用退出后恢复。 */
  stop(): void {
    // timer 存在时先释放系统资源。
    if (this.#timer) clearInterval(this.#timer);
    // 归零引用允许后续安全重新 start。
    this.#timer = null;
  }

  /** 统一异常队列只交给令狐一个入口；受理本身不冒充修复完成，实际恢复仍走既有有限重试流程。 */
  async handleUnifiedExceptions(events: WorkflowExceptionRecord[]): Promise<void> {
    // 每条异常先记录令狐受理事实，不能把批次摘要代替原事件关联。
    for (const event of events) this.#recordEvent("linghu.unified_issue.accepted", {
      sourceEventId: event.eventId,
      sourceEventType: event.eventType,
      category: event.category,
      sourceCorrelationId: event.correlationId,
      message: event.message,
      fingerprint: `linghu-intake:${event.eventId}`,
    });
    // 批次状态只说明已受理和最近游标，不冒充调查或修复完成。
    this.#store.updateRuntime("automation.unified_exceptions_received", (state) => {
      state.blockingReason = `令狐已从统一入口受理 ${events.length} 条异常；正在按任务、测试和审计职责检查恢复条件。`;
      state.detectionCursor = events.at(-1)?.occurredAt || state.detectionCursor;
    });
    // 立即进入统一检查；并发保护会与正在运行的定时检查安全合并。
    await this.checkNow();
  }

  /** 执行一轮检测、恢复、审批衔接或模块派发。 */
  async checkNow(): Promise<void> {
    // 已有检查运行时不排队第二份副作用，下一次定时器会读取最新状态。
    if (this.#checking) return;
    // 先占用检查锁，并在 finally 中无条件释放。
    this.#checking = true;
    try {
      // 用户关闭自动执行后，定时器可以存在但不得读取任务或执行恢复。
      if (!this.#store.state().enabled) return;
      // 一轮检查使用同一协同快照，避免分析过程中各任务事实漂移。
      const collaborationState = this.#collaboration.state();
      // checkedAt 同时用于停滞比较、游标和最后检查时间。
      const checkedAt = new Date().toISOString();
      // 纯分析模块把未终结任务转换为健康快照。
      const snapshots = automaticFlowSnapshots(collaborationState, this.#store.state().activeTaskId, checkedAt);
      // 测试资源快照和流程快照在同一状态提交中持久化。
      const testResourceState = this.#readTestResourceState();
      let automation = this.#store.updateRuntime("automation.checked", (state) => {
        state.lastCheckedAt = checkedAt;
        state.detectionCursor = checkedAt;
        state.flowSnapshots = snapshots;
        state.testResourceState = testResourceState;
      });
      // 运行期间如果模式被外部切换，令狐恢复到协作模式再处理任务。
      if (this.#collaboration.state().mode !== "collaboration") this.#collaboration.setMode("collaboration");

      // 一级职责先于令狐老祖自己的演化循环：任何人物的未完成任务都必须先进入最后流程。
      const guarded = await this.#recoverOtherFlows(collaborationState, automation.activeTaskId, automation.pendingRepairProposalId, snapshots);
      if (guarded) return;

      if (automation.activeTaskId) {
        // 活动任务每轮重新从 Coordinator 获取，不能依赖旧快照对象执行副作用。
        const task = this.#collaboration.state().tasks.find((candidate) => candidate.taskId === automation.activeTaskId);
        if (!task) {
          // 任务缺失时保存恢复点并释放活动 ID，下一步重新派发同模块替代任务。
          automation = this.#store.updateRuntime("automation.task_missing", (state) => {
            state.recoveryCheckpoint = `missing-task:${state.activeTaskId || "unknown"}:${state.currentModule}`;
            state.activeTaskId = null;
            state.currentFaultFingerprint = null;
            state.recoveryAttemptCount = 0;
            state.blockingReason = "关联任务记录缺失，已保存恢复点并准备派发同模块替代任务";
          });
        } else if (task.state === "integrated") {
          // 保存完成前的模块，因为 completeModule 会立即轮转 currentModule。
          const completedModule = automation.currentModule;
          // 结果优先使用结构化 summary，兼容旧任务的 finalResult。
          automation = this.#completeModule(task, task.resultSummary?.finalResult || task.finalResult || "模块已完成。");
          if (completedModule === "test-coverage") {
            try {
              // 测试覆盖模块完成后执行固定统一测试；回调只在 Runner 验证成功后更新报告。
              await this.#runUnifiedTestAndRestart(() => this.#store.updateRuntime("automation.unified_test_completed", (state) => {
                if (!state.lastModuleReport || state.lastModuleReport.module !== completedModule) return;
                state.lastModuleReport.tests = { status: "passed", summary: "固定统一测试全部通过。" };
                state.lastModuleReport.restartRecovery = {
                  status: "passed",
                  checkpoint: state.recoveryCheckpoint,
                  summary: "下一循环恢复点已持久化，受控重启已安排。",
                };
              }));
            } catch (error) {
              // 统一测试失败不会关闭自动保障，而是回到流程完成模块进入修复循环。
              const detail = error instanceof Error ? error.message : String(error);
              this.#store.updateRuntime("automation.unified_test_failed", (state) => {
                state.currentModule = "flow-completion";
                state.blockingReason = `统一测试失败，检测继续运行并进入修复循环：${detail}`.slice(0, 2_000);
                state.lastFeedback = { cycle: state.cycle, module: completedModule, taskId: task.taskId, taskState: task.state, summary: state.blockingReason, recordedAt: new Date().toISOString() };
                if (state.lastModuleReport?.module === completedModule) {
                  state.lastModuleReport.tests = { status: "failed", summary: detail.slice(0, 2_000) };
                  state.lastModuleReport.blocking = { blocked: true, reason: state.blockingReason, resumeCondition: "修正失败测试并重新执行固定统一测试" };
                }
              });
              this.#recordEvent("linghu.automation.unified_test_failed", { detail }, task.taskId);
              return;
            }
          }
        } else if (task.state === "cancelled") {
          // 用户取消是明确终态；释放活动任务但保留取消反馈和恢复点。
          automation = this.#store.updateRuntime("automation.task_cancelled", (state) => {
            state.recoveryCheckpoint = `cancelled-task:${task.taskId}:${state.currentModule}`;
            state.activeTaskId = null;
            state.currentFaultFingerprint = null;
            state.recoveryAttemptCount = 0;
            state.blockingReason = "当前保障任务由用户明确取消；已释放失效任务并准备提交下一份修正方案";
            state.lastFeedback = { cycle: state.cycle, module: state.currentModule, taskId: task.taskId, taskState: task.state, summary: task.blockingReason || "任务已取消", recordedAt: new Date().toISOString() };
          });
        } else if (task.state === "blocked" || task.state === "recovering") {
          // 结构化阻塞或恢复态直接进入有限恢复，不等待时间阈值。
          await this.#recoverFlow(task, snapshots.find((candidate) => candidate.sourceTaskId === task.taskId));
          return;
        } else if (snapshots.find((snapshot) => snapshot.sourceTaskId === task.taskId)?.health === "stalled") {
          // 普通执行态只有被只读分析确认停滞后才执行恢复。
          await this.#recoverFlow(task, snapshots.find((candidate) => candidate.sourceTaskId === task.taskId));
          return;
        }
      }

      // 没有活动任务时继续处理审批提案或派发当前独立模块。
      if (!automation.activeTaskId) await this.#dispatchCurrentModule(automation);
    } catch (error) {
      // 任一检查异常写入状态和事件中心，但不自行关闭 enabled。
      const detail = error instanceof Error ? error.message : String(error);
      this.#store.updateRuntime("automation.check_failed", (state) => { state.blockingReason = detail.slice(0, 2_000); });
      this.#recordEvent("linghu.automation.check_failed", { detail });
    } finally {
      // 无论正常、早返回或异常都释放并发锁。
      this.#checking = false;
    }
  }

  async #recoverOtherFlows(
    collaborationState: CollaborationState,
    activeAutomationTaskId: string | null,
    pendingRepairProposalId: string | null,
    snapshots: LinghuAutomaticFlowSnapshotOutDto[],
  ): Promise<boolean> {
    // 自身保障任务不能遮蔽其他人物的停点；每轮仍只恢复一条流程，避免恢复动作互相抢占。
    const pending = collaborationState.tasks
      .filter((task) => task.taskId !== activeAutomationTaskId && (!pendingRepairProposalId || task.evolutionProposalId !== pendingRepairProposalId) && task.state !== "integrated" && task.state !== "cancelled")
      .sort((left, right) => Date.parse(left.updatedAt) - Date.parse(right.updatedAt));
    // 没有其他人物未终结任务时，允许继续令狐自己的模块循环。
    if (pending.length === 0) return false;

    // 先选择结构化失败，再选择超过进展阈值的停滞任务。
    const task = pending.find((candidate) => ["test-failed", "blocked", "recovering"].includes(candidate.state))
      || pending.find((candidate) => snapshots.find((snapshot) => snapshot.sourceTaskId === candidate.taskId)?.health === "stalled");
    if (!task) {
      // 已有自身保障任务时继续处理该任务；没有时才等待其他人物先进入可审计终点。
      if (activeAutomationTaskId) return false;
      this.#store.updateRuntime("automation.guarding_all_flows", (state) => {
        state.blockingReason = `正在保障 ${pending.length} 个其他人物任务完成最后流程，完成前不派发令狐老祖自己的演化任务`;
      });
      return true;
    }

    // 每轮只恢复最早的一条任务，避免多个恢复动作争用同一人物或集成资源。
    await this.#recoverFlow(task, snapshots.find((candidate) => candidate.sourceTaskId === task.taskId));
    return true;
  }

  /** 对单条流程执行受故障指纹约束的最小恢复；人工业务阻塞只保留恢复点，绝不自动越权续接。 */
  async #recoverFlow(task: CollaborationTask, snapshot: LinghuAutomaticFlowSnapshotOutDto | undefined): Promise<void> {
    // 指纹只随真实故障事实变化，恢复动作自己的 updatedAt 不会重置次数。
    const fingerprint = faultFingerprint(task, snapshot);
    // 每个指纹独立计数，单一故障不会阻塞其他流程。
    const attempts = this.#store.state().recoveryAttemptsByFingerprint[fingerprint] || 0;
    // 检查点固定任务、目标状态和执行代数，支持应用重启后继续。
    const checkpoint = `${task.taskId}:${task.recoveryTargetState || task.state}:${task.workerGeneration}`;
    // 人类报告用于状态、事件和等待原因保持同一事实表述。
    const report = taskHumanReport(this.#collaboration.state(), task, snapshot);
    if (snapshot?.blockingKind === "business") {
      // 业务选择只登记异常和检查点，令狐绝不调用 continue/recover 代替用户决定。
      this.#recordEvent("business.exception", {
        operation: "linghu_recover_flow_requires_business_choice",
        sourceType: "task",
        sourceId: task.taskId,
        message: task.blockingReason || "流程需要人工业务选择。",
        severity: "warning",
        fingerprint: `linghu-business-choice:${fingerprint}`,
        recoveryCheckpoint: checkpoint,
      }, task.taskId);
      this.#store.updateRuntime("automation.business_choice_required", (state) => {
        state.recoveryCheckpoint = checkpoint;
        state.blockingReason = `${report}。这是业务选择，令狐老祖不会越权代替用户决定；检测继续运行。`;
      });
      return;
    }
    if (task.integrationFailure?.kind === "local-change-ownership") {
      // 本地修改归属不明确时等待人工分配，重复轮询不重复写相同审计事件。
      const alreadyReported = this.#store.state().currentFaultFingerprint === fingerprint;
      this.#store.updateRuntime("automation.local_change_ownership_waiting", (state) => {
        state.currentFaultFingerprint = fingerprint;
        state.recoveryAttemptCount = attempts;
        state.recoveryCheckpoint = checkpoint;
        state.blockingReason = `${report}。我已保留原任务和集成证据，不会把同一份本地修改反复送回集成；请先明确这些文件属于哪个任务，再从当前卡点继续。`;
      });
      if (!alreadyReported) {
        this.#recordEvent("linghu.automation.local_change_ownership_waiting", {
          taskId: task.taskId,
          taskTitle: task.snapshot.title,
          executorMemberId: task.executorMemberId,
          failureKind: task.integrationFailure.kind,
          conflictFiles: task.integrationFailure.conflictFiles,
          detail: task.integrationFailure.detail,
          fingerprint,
        }, task.taskId);
      }
      return;
    }
    if (attempts >= 3) {
      // 同一指纹三次恢复后只继续检测新事实，阻止无限副作用循环。
      this.#store.updateRuntime("automation.flow_recovery_waiting", (state) => {
        state.currentFaultFingerprint = fingerprint;
        state.recoveryAttemptCount = attempts;
        state.recoveryCheckpoint = checkpoint;
        state.blockingReason = `${report}。同一停点已经安全恢复三次；我不会继续重复操作，检测仍保持运行，等待新的心跳、数据或依赖事实。`;
      });
      return;
    }

    if ((task.state === "test-failed" && snapshot?.blockingKind === "test")
      || (task.state === "blocked" && task.integrationFailure?.kind === "infrastructure")) {
      // 测试或发布基础设施失败必须先产生新结果版本再重测；只退回队列会永久重复同一失败。
      const started = await this.#collaboration.repairFailedUnifiedTest(task.taskId);
      if (!started) {
        // 修复容量不足不是失败，保留检查点等待令狐人物 writer 释放。
        this.#store.updateRuntime("automation.test_repair_waiting", (state) => {
          state.recoveryCheckpoint = checkpoint;
          state.blockingReason = `${report}。我已确认这是可修复的测试失败，当前等待令狐老祖执行容量。`;
        });
        return;
      }
    } else if (["test-failed", "blocked", "recovering"].includes(task.state)) {
      // 普通结构化停点由受保护的令狐成员继续原任务。
      const linghu = this.#collaboration.state().members.find((member) => member.memberId === LINGHU_MEMBER_ID);
      if (!linghu) throw new Error("令狐老祖成员记录缺失，无法记录自动恢复负责人。");
      this.#collaboration.continueTask(task.taskId, linghu);
    }
    // 没有明确失败态但超过进展阈值时，调用 Coordinator 的通用恢复入口。
    else await this.#collaboration.recoverTask(task.taskId, "令狐老祖检测到其他人物任务超过安全进展阈值");
    // 副作用成功发起后才递增恢复次数并保存检查点。
    this.#store.updateRuntime("automation.flow_recovery_requested", (state) => {
      state.recoveryAttemptsByFingerprint[fingerprint] = attempts + 1;
      state.currentFaultFingerprint = fingerprint;
      state.recoveryAttemptCount = attempts + 1;
      state.recoveryCheckpoint = checkpoint;
      state.blockingReason = `${report}。我已发起本停点第 ${attempts + 1} 次安全恢复，并会继续核对新的执行结果。`;
    });
  }

  async #dispatchCurrentModule(state: LinghuAutomationStateOutDto): Promise<void> {
    // 配置了演化端口时，所有令狐修正必须先形成提案并经过韩立审批。
    if (this.#submitRepairProposal && this.#readEvolutionState) {
      if (state.pendingRepairProposalId) {
        // 每轮读取最新演化与协同状态，判断提案是否已返还真实任务。
        const evolution = this.#readEvolutionState();
        const proposal = evolution.proposals.find((candidate) => candidate.proposalId === state.pendingRepairProposalId);
        const task = this.#collaboration.state().tasks.find((candidate) => candidate.evolutionProposalId === state.pendingRepairProposalId);
        if (task) {
          // 审批执行任务出现后绑定为活动任务，并释放待审批 ID。
          this.#store.updateRuntime("automation.approved_repair_received", (current) => {
            current.activeTaskId = task.taskId;
            current.pendingRepairProposalId = null;
            current.lastDispatchAt = new Date().toISOString();
            current.recoveryCheckpoint = `approved-repair-task:${task.taskId}:${current.currentModule}`;
            current.blockingReason = null;
          });
          return;
        }
        if (proposal && ["pending-approval", "approved"].includes(proposal.status)) {
          // 待审批或已批准但尚未返还任务时只等待，不重复提交方案。
          this.#store.updateRuntime("automation.repair_awaiting_approval", (current) => { current.blockingReason = `令狐修正方案 ${proposal.proposalId} 正在等待韩立审批或审批后返还执行`; });
          return;
        }
        if (proposal?.status === "supplement-required" || proposal?.status === "rejected") {
          // 有明确审批意见时调用既有修订入口生成新版本，原提案保持不可覆盖。
          if (this.#reviseReturnedProposal && proposal.approvals.at(-1)?.advice.trim()) {
            const revisedState = await this.#reviseReturnedProposal(proposal.proposalId);
            const revised = revisedState.proposals.find((candidate) => candidate.supersedesProposalId === proposal.proposalId);
            if (revised) {
              this.#store.updateRuntime("automation.repair_revised", (current) => {
                current.pendingRepairProposalId = revised.proposalId;
                current.recoveryCheckpoint = `repair-revised:${proposal.proposalId}:${revised.proposalId}`;
                current.blockingReason = `令狐已依据审批意见提交 v${revised.version}，等待韩立再次审批`;
              });
              return;
            }
          }
          this.#store.updateRuntime("automation.repair_requires_revision", (current) => { current.blockingReason = `令狐修正方案 ${proposal.proposalId} 状态为 ${proposal.status}，缺少明确审批意见，等待人工补充`; });
          return;
        }
        this.#store.updateRuntime("automation.repair_proposal_missing", (current) => { current.pendingRepairProposalId = null; current.blockingReason = "令狐修正方案记录缺失，已保留恢复点并准备重新提交"; });
        return;
      }
      // 只有真实停点或阻塞证据才允许生成修正提案。
      const actionableSnapshots = state.flowSnapshots.filter((snapshot) => ["stalled", "recovering", "human-blocked"].includes(snapshot.health) || snapshot.blockingKind !== "none");
      if (actionableSnapshots.length === 0) {
        // 检查点前缀防止同一循环、模块和游标重复记录“无需操作”。
        const inspectionPrefix = `inspection:${state.cycle}:${state.currentModule}:`;
        if (state.recoveryCheckpoint?.startsWith(inspectionPrefix)) return;
        const collaboration = this.#collaboration.state();
        const running = collaboration.tasks.filter((task) => !["integrated", "cancelled"].includes(task.state));
        const report = running.length === 0
          ? `令狐老祖刚检查了协作执行池：当前没有未完成任务，也没有发现可提交修正的真实故障。第 ${state.cycle} 轮“${moduleLabel(state.currentModule)}”只保留检查结果，不生成泛化修正方案。`
          : `令狐老祖刚检查了 ${running.length} 个未完成任务：它们都处于执行、排队或正常等待状态，没有发现停住、失败或缺少恢复条件的事实。本轮不生成泛化修正方案。`;
        this.#store.updateRuntime("automation.inspection_no_action_required", (current) => {
          current.recoveryCheckpoint = `${inspectionPrefix}${current.detectionCursor || "initial"}`;
          current.blockingReason = `${report} 我会在任务状态变化或下一次定时检测时继续检查。`;
        });
        this.#recordEvent("linghu.automation.inspection_no_action_required", {
          cycle: state.cycle,
          module: state.currentModule,
          unfinishedTaskCount: running.length,
          report,
        });
        return;
      }
      // 模块说明、证据、风险、回退和验收组成完整可审批提案。
      const moduleText = moduleInstruction(state.currentModule);
      const proposalState = this.#submitRepairProposal({
        title: `令狐老祖 · 第${state.cycle}轮 · ${moduleLabel(state.currentModule)}`,
        content: `${moduleText}\n\n当前阻塞：${state.blockingReason || "无已知阻塞"}\n\n建议先依据真实运行事实完成最小修正，再进入既有协同验证与统一测试。`,
        evidence: [state.lastFeedback?.summary || "持续检测已进入当前独立模块", `当前模块：${moduleLabel(state.currentModule)}`, `检测恢复点：${state.recoveryCheckpoint || "首次检测"}`],
        impactScope: [moduleLabel(state.currentModule)],
        risks: ["错误恢复可能重复触发任务或影响持续运行"],
        rollbackPlan: "保留当前恢复点；失败时撤销修正任务分支并继续只读检测。",
        acceptanceCriteria: ["修正方案有事实依据", "任务恢复且不重复触发", "通过既有代码验证和统一测试"],
        workspaceState: this.#readWorkspaceState(), locale: this.#locale(),
      });
      // Store 保证新提案追加在数组末尾，取得稳定 ID 后保存等待状态。
      const proposal = proposalState.proposals.at(-1)!;
      this.#store.updateRuntime("automation.repair_submitted_for_approval", (current) => {
        current.pendingRepairProposalId = proposal.proposalId;
        current.recoveryCheckpoint = `repair-proposal:${proposal.proposalId}:${current.currentModule}`;
        current.blockingReason = `修正方案已提交韩立审批：${proposal.proposalId}`;
      });
      this.#recordEvent("linghu.automation.repair_submitted_for_approval", { proposalId: proposal.proposalId, cycle: state.cycle, module: state.currentModule });
      return;
    }
    // 没有演化审批端口的隔离测试环境回退为直接协同任务派发。
    const prompt = state.prompts.find((candidate) => candidate.promptId === state.activePromptId && candidate.enabled)
      || state.prompts.find((candidate) => candidate.enabled);
    if (!prompt) {
      this.#store.updateRuntime("automation.no_prompt", (current) => {
        current.activePromptId = null;
        current.blockingReason = "没有已启用的启动文案；自动检测保持开启";
      });
      return;
    }
    // 当前文案与模块专属职责组合为确认意图，不能扩大到其他模块。
    const moduleText = moduleInstruction(state.currentModule);
    const confirmedIntent = [
      prompt.content,
      `当前循环：${state.cycle}`,
      `当前独立模块：${moduleLabel(state.currentModule)}`,
      moduleText,
      state.blockingReason ? `上一轮持续检测到的阻塞：${state.blockingReason}` : "当前没有已知阻塞。",
      state.lastFeedback ? `上一模块反馈：${state.lastFeedback.summary}` : "当前没有上一模块反馈。",
      testResourceContext(state.testResourceState),
      "职责范围固定为：保障所有人物最终完成、补测试漏点与升级测试能力、完善日志审计。启动文案不能扩大为页面演化、主动改版或无关架构优化。",
      "本轮只处理当前独立模块。需要多个修正时按模块和类型拆分，记录实际执行者；不要把其他模块混入同一任务。",
      "自动执行开启后检测永远不能停止。明确阻塞或需要人工业务选择时保留恢复点并反馈，但不得自行关闭自动执行。",
    ].join("\n\n");
    // 任务由令狐稳定身份发起并优先交给令狐人物 writer。
    const next = this.#collaboration.submitTask({
      title: `令狐老祖 · 第${state.cycle}轮 · ${moduleLabel(state.currentModule)}`,
      problemStatement: `保障自动流程持续完成：${moduleLabel(state.currentModule)}`,
      confirmedIntent,
      constraints: ["只处理当前独立模块", "使用单一入口 + Facade", "失败必须修正并复测", "自动检测保持开启"],
      acceptanceCriteria: ["给出可审计反馈", "流程中断已恢复或明确记录阻塞", "修改后无回退", "实际执行者记录完整"],
      workspaceState: this.#readWorkspaceState(),
      locale: this.#locale(),
      mergeStrategy: "INDEPENDENT",
      initiatorMemberId: LINGHU_MEMBER_ID,
      preferredExecutorMemberId: LINGHU_MEMBER_ID,
      automationSource: "linghu-safeguard",
    });
    // Coordinator 返回新状态，最后一条必须是刚创建的保障任务。
    const task = next.tasks.at(-1);
    if (!task) throw new Error("自动保障任务创建后没有返回任务记录。");
    this.#store.updateRuntime("automation.module_dispatched", (current) => {
      const previousCheckpoint = current.recoveryCheckpoint;
      current.activePromptId = prompt.promptId;
      current.activeTaskId = task.taskId;
      current.lastDispatchAt = new Date().toISOString();
      current.recoveryAttemptCount = 0;
      current.currentFaultFingerprint = null;
      current.recoveryCheckpoint = previousCheckpoint?.startsWith("missing-task:")
        ? `replacement-task:${previousCheckpoint}:${task.taskId}`
        : `active-task:${task.taskId}:${current.currentModule}`;
      current.blockingReason = null;
    });
    this.#recordEvent("linghu.automation.module_dispatched", { cycle: state.cycle, module: state.currentModule, promptId: prompt.promptId }, task.taskId);
  }

  #completeModule(task: CollaborationTask, summary: string): LinghuAutomationStateOutDto {
    // 完成报告、模块轮转、循环递增和恢复字段清理由一次原子提交完成。
    return this.#store.updateRuntime("automation.module_completed", (state) => {
      // 先保存完成模块和循环，后续 currentModule 会改变。
      const completedModule = state.currentModule;
      const completedCycle = state.cycle;
      // 根据唯一模块顺序计算下一索引。
      const currentIndex = LINGHU_AUTOMATION_MODULES.indexOf(completedModule);
      const nextIndex = (currentIndex + 1) % LINGHU_AUTOMATION_MODULES.length;
      const completedAt = task.completedAt || new Date().toISOString();
      state.lastFeedback = { cycle: completedCycle, module: completedModule, taskId: task.taskId, taskState: task.state, summary: summary.slice(0, 2_000), recordedAt: new Date().toISOString() };
      state.lastModuleReport = moduleCompletionReport(completedCycle, completedModule, task, summary, state.flowSnapshots, completedAt);
      // 写入下一模块；回到索引 0 代表三模块完成一轮。
      state.currentModule = LINGHU_AUTOMATION_MODULES[nextIndex];
      if (nextIndex === 0) state.cycle += 1;
      state.activeTaskId = null;
      state.recoveryAttemptCount = 0;
      state.currentFaultFingerprint = null;
      state.recoveryCheckpoint = `next-module:${state.cycle}:${state.currentModule}`;
      state.lastCompletedAt = completedAt;
      state.blockingReason = null;
    });
  }
}
