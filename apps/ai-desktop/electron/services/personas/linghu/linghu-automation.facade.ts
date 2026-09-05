// 工作区和语言由主进程组合根读取，令狐不自行解析用户设置。
import type { LocaleValue } from "../../../../contracts/foundation/index.js";
import type { WorkspaceStateOutDto } from "../../../../contracts/services/support/platform/workspace/index.js";
// Coordinator 状态是检测、恢复和派发的权威来源。
import type { CollaborationCustomerActionGuidanceOutDto, CollaborationMemberOutDto, CollaborationStateOutDto, CollaborationTaskOutDto, DesktopOperatingModeValue, SubmitCollaborationTaskInDto, WorkflowExceptionRecordOutDto } from "../../../../contracts/services/workflow/index.js";
// 令狐快照、模块和完整状态使用跨进程纯协议，页面与主进程共享同一数据形状。
import type {
  LinghuAutomaticFlowSnapshotOutDto,
  LinghuAutomationStateOutDto,
} from "../../../../contracts/services/personas/linghu/index.js";
// 测试资源快照只读注入，Facade 不直接争抢端口或构建目录。
import type { TestResourceCoordinatorStateOutDto } from "../../../../contracts/services/support/capabilities/testing/index.js";
// Store 持有状态，模块顺序是轮转的唯一事实。
import { LINGHU_AUTOMATION_MODULES, LINGHU_SAFEGUARD_INSTRUCTIONS, LinghuAutomationStore } from "./internal/linghu-automation.store.js";
// 纯分析函数独立在无副作用模块内，Facade 只编排决策与动作。
import { automaticFlowSnapshots, faultFingerprint, moduleCompletionReport, moduleInstruction, moduleLabel, taskHumanReport, testResourceContext } from "./internal/linghu-flow.analyzer.js";
import { customerActionFacts, parseCustomerActionGuidance } from "./internal/linghu-customer-action-guidance.js";
// 基础设施异常类型留在 internal，外部只能通过 Facade 的静态判断入口识别。
import { isUnifiedTestInfrastructureError } from "../../support/capabilities/testing/index.js";

// 固定人物 ID 用于任务发起人、恢复负责人和审计关联。
const LINGHU_MEMBER_ID = "linghu-ancestor";

/** 令狐调用协作工作流所需的最小端口；具体 Coordinator 只在组合根实现本接口。 */
export interface LinghuCollaborationPort {
  // 返回协作快照，令狐不能直接持有或修改协作 Store。
  state(): CollaborationStateOutDto;
  // 自动保障开启时确保系统进入协作模式。
  setMode(mode: DesktopOperatingModeValue): CollaborationStateOutDto;
  // 派发当前令狐模块任务。
  submitTask(request: SubmitCollaborationTaskInDto): CollaborationStateOutDto;
  // 已有执行人可以继续处理原任务。
  continueTask(taskId: string, recoveryActor?: Pick<CollaborationMemberOutDto, "memberId" | "displayName">): CollaborationStateOutDto;
  // 停滞任务通过正式协调入口进入恢复。
  recoverTask(taskId: string, reason: string): Promise<CollaborationStateOutDto>;
  // 统一测试失败沿原工作树生成修正结果。
  repairFailedUnifiedTest(taskId: string): Promise<boolean>;
  // 令狐生成的客户操作指导仍通过原任务工作流落库。
  recordCustomerActionGuidance(taskId: string, guidance: CollaborationCustomerActionGuidanceOutDto): CollaborationStateOutDto;
}

/** Facade 的所有外部能力都由组合根注入，便于测试和运行边界审查。 */
export interface LinghuAutomationFacadeOptions {
  // Store 是令狐状态唯一写入者。
  store: LinghuAutomationStore;
  // Coordinator 是协同任务唯一副作用入口。
  collaboration: LinghuCollaborationPort;
  // 工作区读取器在真正提交有证据的修复任务时获取最新登记值。
  readWorkspaceState(): WorkspaceStateOutDto;
  // 语言读取器保持新任务与当前用户设置一致。
  locale(): LocaleValue;
  // 事件端口写入统一事件中心，并可关联具体任务。
  recordEvent(type: string, details: Record<string, unknown>, taskId?: string): void;
  // 资源读取器只返回快照，申请和释放由 Runner 完成。
  readTestResourceState(): TestResourceCoordinatorStateOutDto;
  // 统一测试通过后由组合根安排受控重启。
  runUnifiedTestAndRestart(onVerified: () => void): Promise<void>;
  // 只读模型根据已确认事实生成客户能执行的指导，程序不内置具体问题文案。
  analyzeCustomerActionGuidance?(facts: Record<string, unknown>): Promise<string>;
  // 普通运行异常只进入巡检修复，不伪装成阻断原任务的“卡点”。
  readUnhandledExceptions?(): WorkflowExceptionRecordOutDto[];
  // 派发成功后才领取异常，防止同一运行错误被重复建任务。
  claimUnhandledExceptions?(eventIds: string[]): string[];
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
  readonly #readWorkspaceState: () => WorkspaceStateOutDto;
  readonly #locale: () => LocaleValue;
  readonly #recordEvent: LinghuAutomationFacadeOptions["recordEvent"];
  readonly #readTestResourceState: LinghuAutomationFacadeOptions["readTestResourceState"];
  readonly #runUnifiedTestAndRestart: LinghuAutomationFacadeOptions["runUnifiedTestAndRestart"];
  readonly #analyzeCustomerActionGuidance: NonNullable<LinghuAutomationFacadeOptions["analyzeCustomerActionGuidance"]>;
  readonly #readUnhandledExceptions: NonNullable<LinghuAutomationFacadeOptions["readUnhandledExceptions"]>;
  readonly #claimUnhandledExceptions: NonNullable<LinghuAutomationFacadeOptions["claimUnhandledExceptions"]>;
  // timer 为 null 表示尚未启动或已经停止；重复 start 不会创建多重轮询。
  #timer: ReturnType<typeof setTimeout> | null = null;
  #stopped = false;
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
    this.#analyzeCustomerActionGuidance = options.analyzeCustomerActionGuidance || (async () => { throw new Error("令狐客户操作指导分析器尚未配置。"); });
    this.#readUnhandledExceptions = options.readUnhandledExceptions || (() => []);
    this.#claimUnhandledExceptions = options.claimUnhandledExceptions || (() => []);
  }

  /** 返回 Store 的深复制状态快照。 */
  state(): LinghuAutomationStateOutDto { return this.#store.state(); }
  /** 新建页面展示会话不触碰运行连接、任务进度、开关或检查时间。 */
  newDisplayConversation(): LinghuAutomationStateOutDto {
    return this.#store.updateRuntime("automation.display_conversation_created", (state) => {
      state.displayConversationStartedAt = new Date().toISOString();
    });
  }
  /** 把状态订阅转交 Store，Facade 不维护第二套事件列表。 */
  subscribe(listener: Parameters<LinghuAutomationStore["subscribe"]>[0]) { return this.#store.subscribe(listener); }

  /** 响应唯一自动执行开关，并在开启后立即进行第一轮检查。 */
  setEnabled(enabled: boolean): LinghuAutomationStateOutDto {
    this.#clearTimer();
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
    return this.state();
  }

  // 文案 CRUD 直接委托 Store，避免 Facade 复制校验和原子持久化逻辑。

  start(): void {
    if (this.#timer || this.#checking) return;
    this.#stopped = false;
    void this.checkNow();
  }

  /** 停止定时器；用户 enabled 选择仍保留在 Store，供正常应用退出后恢复。 */
  stop(): void {
    this.#stopped = true;
    this.#clearTimer();
    this.#store.updateRuntime("automation.scheduler_stopped", (state) => { state.nextCheckAt = null; });
  }

  #clearTimer(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
  }

  /** 已确认卡点的显式任务交接不依赖定时巡检开关，仍复用原任务有限恢复与权限判断。 */
  async handleTaskCheckpoint(taskId: string, stalled = false): Promise<void> {
    if (this.#checking || this.#stopped) return;
    const task = this.#collaboration.state().tasks.find((item) => item.taskId === taskId);
    if (!task || (!stalled && !["blocked", "recovering"].includes(task.state)) || ["integrated", "cancelled"].includes(task.state)) return;
    this.#checking = true;
    try { await this.#recoverFlow(task, automaticFlowSnapshots(this.#collaboration.state(), this.state().activeTaskId, new Date().toISOString()).find((item) => item.sourceTaskId === taskId)); }
    finally { this.#checking = false; }
  }

  /** 只接受有原卡点事实和限定工作区的修复任务，实际调查执行沿既有令狐执行会话完成。 */
  submitCheckpointRepair(request: SubmitCollaborationTaskInDto): CollaborationStateOutDto {
    if (this.#stopped) throw new Error("令狐运行时已停止");
    return this.#collaboration.submitTask({ ...request, preferredExecutorMemberId: LINGHU_MEMBER_ID, automationSource: "linghu-safeguard" });
  }

  /** 执行一轮检测、恢复或有明确故障依据的模块派发。 */
  async checkNow(): Promise<void> {
    // 已有检查运行时不排队第二份副作用，下一次定时器会读取最新状态。
    if (this.#checking || this.#stopped || !this.state().enabled) return;
    this.#clearTimer();
    // 先占用检查锁，并在 finally 中无条件释放。
    this.#checking = true;
    try {
      this.#store.updateRuntime("automation.check_started", (state) => { state.checking = true; state.nextCheckAt = null; });
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
      // 只读取已明确接入的普通技术异常；flowImpact=none 不改写原任务状态。
      const ordinaryIssues = this.#readUnhandledExceptions().filter((event) => event.status === "open" && event.flowImpact === "none" && event.eventType === "hanli.inquiry.failed");
      let automation = this.#store.updateRuntime("automation.checked", (state) => {
        state.lastCheckedAt = checkedAt;
        state.detectionCursor = checkedAt;
        state.flowSnapshots = snapshots;
        state.testResourceState = testResourceState;
      });
      // 运行期间如果模式被外部切换，令狐恢复到协作模式再处理任务。
      if (this.#collaboration.state().mode !== "collaboration") this.#collaboration.setMode("collaboration");

      // 一级职责先于令狐老祖自己的演化循环：任何人物的未完成任务都必须先进入最后流程。
      const guarded = await this.#recoverOtherFlows(collaborationState, automation.activeTaskId, snapshots);
      if (guarded) return;

      if (automation.activeTaskId) {
        // 活动任务每轮重新从 Coordinator 获取，不能依赖旧快照对象执行副作用。
        const task = this.#collaboration.state().tasks.find((candidate) => candidate.taskId === automation.activeTaskId);
        if (!task) {
          // 任务缺失时保存恢复点并释放活动 ID；没有具体故障证据不创建替代任务。
          automation = this.#store.updateRuntime("automation.task_missing", (state) => {
            state.recoveryCheckpoint = `missing-task:${state.activeTaskId || "unknown"}:${state.currentModule}`;
            state.activeTaskId = null;
            state.currentFaultFingerprint = null;
            state.recoveryAttemptCount = 0;
            state.blockingReason = "关联任务记录缺失，已保存恢复点并继续巡检；没有具体故障证据不创建替代任务";
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
            state.blockingReason = "当前保障任务由用户明确取消；已释放失效任务，继续巡检，不自动重建已取消任务";
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

      // 没有活动任务时只依据具体故障决定是否派发当前模块，不经过旧提案链。
      if (!automation.activeTaskId) await this.#dispatchCurrentModule(automation, ordinaryIssues);
    } catch (error) {
      // 任一检查异常写入状态和事件中心，但不自行关闭 enabled。
      const detail = error instanceof Error ? error.message : String(error);
      this.#store.updateRuntime("automation.check_failed", (state) => { state.blockingReason = detail.slice(0, 2_000); });
      this.#recordEvent("linghu.automation.check_failed", { detail });
    } finally {
      // 无论正常、早返回或异常都释放并发锁。
      this.#checking = false;
      const scheduled = !this.#stopped && this.state().enabled;
      const nextCheckAt = scheduled ? new Date(Date.now() + 60_000).toISOString() : null;
      this.#store.updateRuntime("automation.check_finished", (state) => { state.checking = false; state.nextCheckAt = nextCheckAt; });
      if (scheduled) {
        this.#timer = setTimeout(() => { this.#timer = null; void this.checkNow(); }, 60_000);
        this.#timer.unref();
      }
    }
  }

  async #recoverOtherFlows(
    collaborationState: CollaborationStateOutDto,
    activeAutomationTaskId: string | null,
    snapshots: LinghuAutomaticFlowSnapshotOutDto[],
  ): Promise<boolean> {
    // 自身保障任务不能遮蔽其他人物的停点；每轮仍只恢复一条流程，避免恢复动作互相抢占。
    const pending = collaborationState.tasks
      .filter((task) => task.taskId !== activeAutomationTaskId && task.state !== "integrated" && task.state !== "cancelled")
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
  async #recoverFlow(task: CollaborationTaskOutDto, snapshot: LinghuAutomaticFlowSnapshotOutDto | undefined): Promise<void> {
    // 指纹只随真实故障事实变化，恢复动作自己的 updatedAt 不会重置次数。
    const fingerprint = faultFingerprint(task, snapshot);
    // 每个指纹独立计数，单一故障不会阻塞其他流程。
    const attempts = this.#store.state().recoveryAttemptsByFingerprint[fingerprint] || 0;
    // 检查点固定任务、目标状态和执行代数，支持应用重启后继续。
    const checkpoint = `${task.taskId}:${task.recoveryTargetState || task.state}:${task.workerGeneration}`;
    // 人类报告用于状态、事件和等待原因保持同一事实表述。
    const report = taskHumanReport(this.#collaboration.state(), task, snapshot);
    this.#recordEvent("linghu.automation.issue_detected", { report, fingerprint }, task.taskId);
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
        state.blockingReason = task.customerActionGuidance?.sourceFingerprint === fingerprint
          ? `${task.customerActionGuidance.title}：${task.customerActionGuidance.problem}`
          : `${report}。这是业务选择，令狐老祖不会越权代替用户决定；令狐正在形成客户可执行的处理步骤。`;
      });
      await this.#ensureCustomerActionGuidance(task, snapshot, fingerprint, report);
      return;
    }
    if (task.integrationFailure?.kind === "local-change-ownership") {
      // 本地修改归属不明确时等待人工分配，重复轮询不重复写相同审计事件。
      const alreadyReported = this.#store.state().currentFaultFingerprint === fingerprint;
      this.#store.updateRuntime("automation.local_change_ownership_waiting", (state) => {
        state.currentFaultFingerprint = fingerprint;
        state.recoveryAttemptCount = attempts;
        state.recoveryCheckpoint = checkpoint;
        state.blockingReason = task.customerActionGuidance?.sourceFingerprint === fingerprint
          ? `${task.customerActionGuidance.title}：${task.customerActionGuidance.problem}`
          : `${report}。我已保留原任务和集成证据，不会把同一份本地修改反复送回集成；令狐正在形成客户可执行的处理步骤。`;
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
      await this.#ensureCustomerActionGuidance(task, snapshot, fingerprint, report);
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
    this.#recordEvent("linghu.automation.recovery_requested", { report: this.state().blockingReason, fingerprint }, task.taskId);
  }

  /** 令狐按真实卡点生成可操作说明；失败时保留原卡点，绝不显示空壳按钮。 */
  async #ensureCustomerActionGuidance(
    task: CollaborationTaskOutDto,
    snapshot: LinghuAutomaticFlowSnapshotOutDto | undefined,
    fingerprint: string,
    report: string,
  ): Promise<void> {
    if (task.customerActionGuidance?.sourceFingerprint === fingerprint) return;
    try {
      const text = await this.#analyzeCustomerActionGuidance(customerActionFacts(task, snapshot, fingerprint));
      const guidance = parseCustomerActionGuidance(text, fingerprint, { memberId: LINGHU_MEMBER_ID, displayName: "令狐老祖" });
      this.#collaboration.recordCustomerActionGuidance(task.taskId, guidance);
      this.#store.updateRuntime("automation.customer_action_guidance_created", (state) => {
        state.currentFaultFingerprint = fingerprint;
        state.blockingReason = `${guidance.title}：${guidance.problem}`;
      });
      this.#recordEvent("linghu.automation.customer_action_guidance_created", { report, guidance }, task.taskId);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.#store.updateRuntime("automation.customer_action_guidance_failed", (state) => {
        state.currentFaultFingerprint = fingerprint;
        state.blockingReason = `${report}。令狐暂未形成安全、完整的客户操作步骤，将继续分析，不显示不可执行的继续入口。`;
      });
      this.#recordEvent("linghu.automation.customer_action_guidance_failed", { report, detail, fingerprint }, task.taskId);
    }
  }

  async #dispatchCurrentModule(state: LinghuAutomationStateOutDto, ordinaryIssues: WorkflowExceptionRecordOutDto[] = []): Promise<void> {
    // 只有真实停点或阻塞证据才允许进入现有修复任务流程，不再生成审批提案。
    const actionableSnapshots = state.flowSnapshots.filter((snapshot) => ["stalled", "recovering", "human-blocked"].includes(snapshot.health) || snapshot.blockingKind !== "none");
    if (actionableSnapshots.length === 0 && ordinaryIssues.length === 0) {
      // 检查点前缀防止同一循环、模块和游标重复记录“无需操作”。
      const inspectionPrefix = `inspection:${state.cycle}:${state.currentModule}:`;
      if (state.recoveryCheckpoint?.startsWith(inspectionPrefix)) return;
      const collaboration = this.#collaboration.state();
      const running = collaboration.tasks.filter((task) => !["integrated", "cancelled"].includes(task.state));
      const report = running.length === 0
        ? `令狐老祖刚检查了协作执行池：当前没有未完成任务，也没有发现可提交修正的真实故障。第 ${state.cycle} 轮“${moduleLabel(state.currentModule)}”只保留检查结果，不生成泛化修正方案。`
        : `令狐老祖刚检查了 ${running.length} 个未完成任务：它们都处于执行、排队或正常等待状态，没有发现停住、失败或缺少恢复条件的事实。本轮不生成泛化修正方案。`;
      this.#store.updateRuntime("automation.inspection_no_action_required", (current) => {
        if (!current.recoveryCheckpoint?.startsWith("missing-task:") && !current.recoveryCheckpoint?.startsWith("cancelled-task:")) current.recoveryCheckpoint = `${inspectionPrefix}${current.detectionCursor || "initial"}`;
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
    // 固定职责只有一个正式来源，不读取可编辑文案或兼容入口。
    // 当前文案与模块专属职责组合为确认意图，不能扩大到其他模块。
    const moduleText = moduleInstruction(state.currentModule);
    const ordinaryIssueContext = ordinaryIssues.map((event) => ({
      eventId: event.eventId,
      eventType: event.eventType,
      correlationId: event.correlationId,
      message: event.message,
      occurredAt: event.occurredAt,
      requestId: event.payload.requestId,
    }));
    const confirmedIntent = [
      LINGHU_SAFEGUARD_INSTRUCTIONS,
      `当前循环：${state.cycle}`,
      `当前独立模块：${moduleLabel(state.currentModule)}`,
      moduleText,
      state.blockingReason ? `上一轮持续检测到的阻塞：${state.blockingReason}` : "当前没有已知阻塞。",
      state.lastFeedback ? `上一模块反馈：${state.lastFeedback.summary}` : "当前没有上一模块反馈。",
      testResourceContext(state.testResourceState),
      ordinaryIssueContext.length ? `本轮已发现的普通运行异常（不是卡点，不改写原任务状态）：${JSON.stringify(ordinaryIssueContext)}` : "本轮没有额外的普通运行异常。",
      "职责范围固定为：保障所有人物最终完成、补测试漏点与升级测试能力、完善日志审计。启动文案不能扩大为页面演化、主动改版或无关架构优化。",
      "本轮只处理当前独立模块。需要多个修正时按模块和类型拆分，记录实际执行者；不要把其他模块混入同一任务。",
      "自动执行开启后检测永远不能停止。明确阻塞或需要人工业务选择时保留恢复点并反馈，但不得自行关闭自动执行。",
    ].join("\n\n");
    // 任务由令狐稳定身份发起并优先交给令狐人物 writer。
    const next = this.#collaboration.submitTask({
      title: ordinaryIssueContext.length ? `令狐老祖 · 运行异常修复 · ${ordinaryIssues[0].eventType}` : `令狐老祖 · 第${state.cycle}轮 · ${moduleLabel(state.currentModule)}`,
      problemStatement: ordinaryIssueContext.length ? `修复已记录的运行异常：${ordinaryIssues.map((event) => event.message).join("；")}` : `保障自动流程持续完成：${moduleLabel(state.currentModule)}`,
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
    const claimedIssueIds = ordinaryIssueContext.length ? this.#claimUnhandledExceptions(ordinaryIssues.map((event) => event.eventId)) : [];
    this.#store.updateRuntime("automation.module_dispatched", (current) => {
      const previousCheckpoint = current.recoveryCheckpoint;
      current.activeTaskId = task.taskId;
      current.lastDispatchAt = new Date().toISOString();
      current.recoveryAttemptCount = 0;
      current.currentFaultFingerprint = null;
      current.recoveryCheckpoint = previousCheckpoint?.startsWith("missing-task:")
        ? `replacement-task:${previousCheckpoint}:${task.taskId}`
        : `active-task:${task.taskId}:${current.currentModule}`;
      current.blockingReason = null;
    });
    this.#recordEvent("linghu.automation.module_dispatched", { cycle: state.cycle, module: state.currentModule, ordinaryIssueIds: claimedIssueIds }, task.taskId);
  }

  #completeModule(task: CollaborationTaskOutDto, summary: string): LinghuAutomationStateOutDto {
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
