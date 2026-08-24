import type { Locale, WorkspaceState } from "../../../contracts/desktop.js";
import type { CollaborationState, CollaborationTask } from "../../../contracts/collaboration.js";
import type {
  LinghuAutomaticFlowSnapshot,
  LinghuAutomationModule,
  LinghuAutomationState,
  LinghuBlockingKind,
  LinghuFlowHealth,
} from "../../../contracts/linghu-automation.js";
import type { TestResourceCoordinatorState } from "../../../contracts/test-resource.js";
import { CollaborationCoordinator } from "./collaboration-coordinator.js";
import { LINGHU_AUTOMATION_MODULES, LinghuAutomationStore } from "./linghu-automation-store.js";

const LINGHU_MEMBER_ID = "linghu-ancestor";
const FLOW_STALE_AFTER_MS = 120_000;
export interface LinghuAutomationFacadeOptions {
  store: LinghuAutomationStore;
  collaboration: CollaborationCoordinator;
  readWorkspaceState(): WorkspaceState;
  locale(): Locale;
  recordEvent(type: string, details: Record<string, unknown>, taskId?: string): void;
  readTestResourceState(): TestResourceCoordinatorState;
  runUnifiedTestAndRestart(onVerified: () => void): Promise<void>;
}

/** 令狐老祖自动保障的唯一入口；界面和定时器只调用本 Facade，不直接依赖调度、恢复与持久化实现。 */
export class LinghuAutomationFacade {
  readonly #store: LinghuAutomationStore;
  readonly #collaboration: CollaborationCoordinator;
  readonly #readWorkspaceState: () => WorkspaceState;
  readonly #locale: () => Locale;
  readonly #recordEvent: LinghuAutomationFacadeOptions["recordEvent"];
  readonly #readTestResourceState: LinghuAutomationFacadeOptions["readTestResourceState"];
  readonly #runUnifiedTestAndRestart: LinghuAutomationFacadeOptions["runUnifiedTestAndRestart"];
  #timer: ReturnType<typeof setInterval> | null = null;
  #checking = false;

  constructor(options: LinghuAutomationFacadeOptions) {
    this.#store = options.store;
    this.#collaboration = options.collaboration;
    this.#readWorkspaceState = options.readWorkspaceState;
    this.#locale = options.locale;
    this.#recordEvent = options.recordEvent;
    this.#readTestResourceState = options.readTestResourceState;
    this.#runUnifiedTestAndRestart = options.runUnifiedTestAndRestart;
  }

  state(): LinghuAutomationState { return this.#store.state(); }
  subscribe(listener: Parameters<LinghuAutomationStore["subscribe"]>[0]) { return this.#store.subscribe(listener); }

  setEnabled(enabled: boolean): LinghuAutomationState {
    const state = this.#store.setEnabled(enabled);
    this.#recordEvent(enabled ? "linghu.automation.enabled" : "linghu.automation.disabled", { cycle: state.cycle, module: state.currentModule });
    if (enabled) {
      if (this.#collaboration.state().mode !== "collaboration") this.#collaboration.setMode("collaboration");
      void this.checkNow();
    }
    return state;
  }

  createPrompt(request: Parameters<LinghuAutomationStore["createPrompt"]>[0]) { return this.#store.createPrompt(request); }
  updatePrompt(promptId: string, request: Parameters<LinghuAutomationStore["updatePrompt"]>[1]) { return this.#store.updatePrompt(promptId, request); }
  deletePrompt(promptId: string) { return this.#store.deletePrompt(promptId); }
  selectPrompt(promptId: string) { return this.#store.selectPrompt(promptId); }

  start(): void {
    if (this.#timer) return;
    this.#timer = setInterval(() => void this.checkNow(), this.state().pollIntervalMs);
    void this.checkNow();
  }

  stop(): void {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = null;
  }

  async checkNow(): Promise<void> {
    if (this.#checking) return;
    this.#checking = true;
    try {
      if (!this.#store.state().enabled) return;
      const collaborationState = this.#collaboration.state();
      const checkedAt = new Date().toISOString();
      const snapshots = automaticFlowSnapshots(collaborationState, this.#store.state().activeTaskId, checkedAt);
      const testResourceState = this.#readTestResourceState();
      let automation = this.#store.updateRuntime("automation.checked", (state) => {
        state.lastCheckedAt = checkedAt;
        state.detectionCursor = checkedAt;
        state.flowSnapshots = snapshots;
        state.testResourceState = testResourceState;
      });
      if (this.#collaboration.state().mode !== "collaboration") this.#collaboration.setMode("collaboration");

      // 一级职责先于令狐老祖自己的演化循环：任何人物的未完成任务都必须先进入最后流程。
      const guarded = await this.#recoverOtherFlows(collaborationState, automation.activeTaskId, snapshots);
      if (guarded) return;

      if (automation.activeTaskId) {
        const task = this.#collaboration.state().tasks.find((candidate) => candidate.taskId === automation.activeTaskId);
        if (!task) {
          automation = this.#store.updateRuntime("automation.task_missing", (state) => {
            state.recoveryCheckpoint = `missing-task:${state.activeTaskId || "unknown"}:${state.currentModule}`;
            state.activeTaskId = null;
            state.currentFaultFingerprint = null;
            state.recoveryAttemptCount = 0;
            state.blockingReason = "关联任务记录缺失，已保存恢复点并准备派发同模块替代任务";
          });
        } else if (task.state === "integrated") {
          const completedModule = automation.currentModule;
          automation = this.#completeModule(task, task.resultSummary?.finalResult || task.finalResult || "模块已完成。");
          if (completedModule === "test-coverage") {
            try {
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
          this.#store.updateRuntime("automation.task_cancelled", (state) => {
            state.recoveryCheckpoint = `cancelled-task:${task.taskId}:${state.currentModule}`;
            state.blockingReason = "当前保障任务由用户明确取消；自动检测保持开启，等待新的人工选择";
            state.lastFeedback = { cycle: state.cycle, module: state.currentModule, taskId: task.taskId, taskState: task.state, summary: task.blockingReason || "任务已取消", recordedAt: new Date().toISOString() };
          });
        } else if (task.state === "blocked" || task.state === "recovering") {
          await this.#recoverFlow(task, snapshots.find((candidate) => candidate.sourceTaskId === task.taskId));
          return;
        } else if (snapshots.find((snapshot) => snapshot.sourceTaskId === task.taskId)?.health === "stalled") {
          await this.#recoverFlow(task, snapshots.find((candidate) => candidate.sourceTaskId === task.taskId));
          return;
        }
      }

      if (!automation.activeTaskId) this.#dispatchCurrentModule(automation);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.#store.updateRuntime("automation.check_failed", (state) => { state.blockingReason = detail.slice(0, 2_000); });
      this.#recordEvent("linghu.automation.check_failed", { detail });
    } finally {
      this.#checking = false;
    }
  }

  async #recoverOtherFlows(
    collaborationState: CollaborationState,
    activeAutomationTaskId: string | null,
    snapshots: LinghuAutomaticFlowSnapshot[],
  ): Promise<boolean> {
    // 自身保障任务不能遮蔽其他人物的停点；每轮仍只恢复一条流程，避免恢复动作互相抢占。
    const pending = collaborationState.tasks
      .filter((task) => task.taskId !== activeAutomationTaskId && task.state !== "integrated" && task.state !== "cancelled")
      .sort((left, right) => Date.parse(left.updatedAt) - Date.parse(right.updatedAt));
    if (pending.length === 0) return false;

    const task = pending.find((candidate) => ["review-failed", "test-failed", "blocked", "recovering"].includes(candidate.state))
      || pending.find((candidate) => snapshots.find((snapshot) => snapshot.sourceTaskId === candidate.taskId)?.health === "stalled");
    if (!task) {
      // 已有自身保障任务时继续处理该任务；没有时才等待其他人物先进入可审计终点。
      if (activeAutomationTaskId) return false;
      this.#store.updateRuntime("automation.guarding_all_flows", (state) => {
        state.blockingReason = `正在保障 ${pending.length} 个其他人物任务完成最后流程，完成前不派发令狐老祖自己的演化任务`;
      });
      return true;
    }

    await this.#recoverFlow(task, snapshots.find((candidate) => candidate.sourceTaskId === task.taskId));
    return true;
  }

  /** 对单条流程执行受故障指纹约束的最小恢复；人工业务阻塞只保留恢复点，绝不自动越权续接。 */
  async #recoverFlow(task: CollaborationTask, snapshot: LinghuAutomaticFlowSnapshot | undefined): Promise<void> {
    const fingerprint = faultFingerprint(task, snapshot);
    const attempts = this.#store.state().recoveryAttemptsByFingerprint[fingerprint] || 0;
    const checkpoint = `${task.taskId}:${task.recoveryTargetState || task.state}:${task.workerGeneration}`;
    if (snapshot?.blockingKind === "business") {
      this.#store.updateRuntime("automation.business_choice_required", (state) => {
        state.recoveryCheckpoint = checkpoint;
        state.blockingReason = `任务 ${task.taskId} 需要人工业务选择：${task.blockingReason || "未记录具体选择"}；检测继续运行`;
      });
      return;
    }
    if (attempts >= 3) {
      this.#store.updateRuntime("automation.flow_recovery_waiting", (state) => {
        state.currentFaultFingerprint = fingerprint;
        state.recoveryAttemptCount = attempts;
        state.recoveryCheckpoint = checkpoint;
        state.blockingReason = `任务 ${task.taskId} 的同一停点已安全恢复三次；检测仍保持运行，等待新的心跳、数据或依赖事实`;
      });
      return;
    }

    if (["review-failed", "test-failed", "blocked", "recovering"].includes(task.state)) {
      const linghu = this.#collaboration.state().members.find((member) => member.memberId === LINGHU_MEMBER_ID);
      if (!linghu) throw new Error("令狐老祖成员记录缺失，无法记录自动恢复负责人。");
      this.#collaboration.continueTask(task.taskId, linghu);
    }
    else await this.#collaboration.recoverTask(task.taskId, "令狐老祖检测到其他人物任务超过安全进展阈值");
    this.#store.updateRuntime("automation.flow_recovery_requested", (state) => {
      state.recoveryAttemptsByFingerprint[fingerprint] = attempts + 1;
      state.currentFaultFingerprint = fingerprint;
      state.recoveryAttemptCount = attempts + 1;
      state.recoveryCheckpoint = checkpoint;
      state.blockingReason = `正在保障任务 ${task.taskId} 完成最后流程，本停点第 ${attempts + 1} 次安全恢复`;
    });
  }

  #dispatchCurrentModule(state: LinghuAutomationState): void {
    const prompt = state.prompts.find((candidate) => candidate.promptId === state.activePromptId && candidate.enabled)
      || state.prompts.find((candidate) => candidate.enabled);
    if (!prompt) {
      this.#store.updateRuntime("automation.no_prompt", (current) => {
        current.activePromptId = null;
        current.blockingReason = "没有已启用的启动文案；自动检测保持开启";
      });
      return;
    }
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

  #completeModule(task: CollaborationTask, summary: string): LinghuAutomationState {
    return this.#store.updateRuntime("automation.module_completed", (state) => {
      const completedModule = state.currentModule;
      const completedCycle = state.cycle;
      const currentIndex = LINGHU_AUTOMATION_MODULES.indexOf(completedModule);
      const nextIndex = (currentIndex + 1) % LINGHU_AUTOMATION_MODULES.length;
      const completedAt = task.completedAt || new Date().toISOString();
      state.lastFeedback = { cycle: completedCycle, module: completedModule, taskId: task.taskId, taskState: task.state, summary: summary.slice(0, 2_000), recordedAt: new Date().toISOString() };
      state.lastModuleReport = moduleCompletionReport(completedCycle, completedModule, task, summary, state.flowSnapshots, completedAt);
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

function automaticFlowSnapshots(state: CollaborationState, activeTaskId: string | null, checkedAt: string): LinghuAutomaticFlowSnapshot[] {
  // 令狐老祖保障所有人物的未完成任务；automationSource 只用于审计，不能限制保障范围。
  return state.tasks.filter((task) => task.taskId === activeTaskId
      || (task.state !== "integrated" && task.state !== "cancelled"))
    .map((task) => automaticFlowSnapshot(state, task, checkedAt));
}

function automaticFlowSnapshot(state: CollaborationState, task: CollaborationTask, checkedAt: string): LinghuAutomaticFlowSnapshot {
  const member = state.members.find((candidate) => candidate.memberId === task.executorMemberId && candidate.currentTaskId === task.taskId);
  const progressAt = latestTime(member?.lastHeartbeatAt, member?.lastProtocolProgressAt, task.updatedAt);
  const stale = Date.parse(checkedAt) - Date.parse(progressAt) > FLOW_STALE_AFTER_MS;
  const health = flowHealth(task, stale);
  const completedConditions = task.state === "integrated" ? ["源码已集成", "任务已进入完成终态"] : [];
  return {
    flowId: `automatic:${task.taskId}`,
    sourceTaskId: task.taskId,
    health,
    state: task.state,
    phase: task.phase,
    executorMemberId: task.executorMemberId,
    workerGeneration: task.workerGeneration,
    lastHeartbeatAt: member?.lastHeartbeatAt || null,
    lastProtocolProgressAt: member?.lastProtocolProgressAt || null,
    lastStateChangedAt: task.updatedAt,
    waitingPoint: waitingPoint(task, health),
    completionConditions: ["任务完成代码级验证", "集成候选验证通过", "结果进入 integrated 终态"],
    completedConditions,
    recoveryCheckpoint: task.recoveryTargetState ? `${task.taskId}:${task.recoveryTargetState}:${task.workerGeneration}` : null,
    blockingReason: task.blockingReason,
    blockingKind: blockingKind(task),
  };
}

function flowHealth(task: CollaborationTask, stale: boolean): LinghuFlowHealth {
  if (task.state === "integrated") return "completed";
  if (task.state === "cancelled") return "human-blocked";
  if (task.state === "blocked") return "stalled";
  if (task.state === "recovering") return "recovering";
  if (task.state === "review-failed" || task.state === "test-failed") return "stalled";
  if (task.state === "unified-testing") return "testing";
  if (task.state === "repairing-review" || task.state === "repairing-execution") return "repairing";
  // 有明确队列释放条件的等待不是停点，不能仅凭排队时长触发具有副作用的恢复。
  if (["queued-executor", "queued-reviewer", "queued-integration", "ready-for-integration"].includes(task.state)) return "waiting";
  if (stale) return "stalled";
  if (["executing", "integrating"].includes(task.state)) return "repairing";
  return "healthy";
}

function waitingPoint(task: CollaborationTask, health: LinghuFlowHealth): string | null {
  if (health === "human-blocked") return "等待人工重新选择是否继续";
  if (health === "stalled" || health === "recovering") return task.blockingReason || "等待安全恢复条件";
  if (task.state === "queued-executor") return "等待执行者容量";
  if (task.state === "queued-reviewer") return "等待审核者容量";
  if (task.state === "ready-for-integration" || task.state === "queued-integration") return "等待集成器";
  return null;
}

function blockingKind(task: CollaborationTask): LinghuBlockingKind {
  if (!task.blockingReason) return "none";
  const reason = task.blockingReason;
  if (/用户|人工|选择/.test(reason)) return "business";
  if (/测试|test/i.test(reason)) return "test";
  if (/数据|缺失|记录/.test(reason)) return "data";
  if (/代码|编译|类型/.test(reason)) return "code";
  return "infrastructure";
}

function latestTime(...values: Array<string | null | undefined>): string {
  return values.filter((value): value is string => Boolean(value))
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0] || new Date(0).toISOString();
}

function faultFingerprint(task: CollaborationTask, snapshot: LinghuAutomaticFlowSnapshot | undefined): string {
  // 任务恢复动作本身会更新 updatedAt，不能把它作为新事实，否则三次上限会被每次副作用自行清零。
  const lastProgressVersion = latestTime(snapshot?.lastHeartbeatAt, snapshot?.lastProtocolProgressAt, task.codeVerifiedAt);
  // 同一状态下的阶段推进同样是新事实，例如失败测试转入修正或验证阶段后应获得新的恢复预算。
  return [task.taskId, task.state, task.phase || "none", task.workerGeneration, blockingKind(task), task.blockingReason || "none", lastProgressVersion].join("|");
}

function moduleCompletionReport(
  cycle: number,
  module: LinghuAutomationModule,
  task: CollaborationTask,
  summary: string,
  snapshots: LinghuAutomaticFlowSnapshot[],
  completedAt: string,
) {
  const snapshot = snapshots.find((candidate) => candidate.sourceTaskId === task.taskId);
  return {
    cycle,
    module,
    evidence: [snapshot ? `流程 ${task.taskId} 检测状态为 ${snapshot.health}` : `流程 ${task.taskId} 已进入 integrated`, summary.slice(0, 2_000)],
    tasks: [{ taskId: task.taskId, type: "自动流程保障", action: task.snapshot.problemStatement, executorMemberId: task.executorMemberId || LINGHU_MEMBER_ID, result: summary.slice(0, 2_000) }],
    tests: module === "test-coverage"
      ? { status: "not-run" as const, summary: "等待执行固定统一测试。" }
      : { status: "passed" as const, summary: "协同任务已通过代码级验证和集成门禁。" },
    restartRecovery: module === "test-coverage"
      ? { status: "not-run" as const, checkpoint: `next-module:${cycle + 1}:flow-completion`, summary: "等待固定统一测试通过后执行受控重启。" }
      : { status: "not-applicable" as const, checkpoint: null, summary: "本模块不要求重启。" },
    blocking: { blocked: false, reason: null, resumeCondition: null },
    nextSuggestion: `继续检测下一独立模块：${moduleLabel(nextModule(module))}`,
    completedAt,
  };
}

function nextModule(module: LinghuAutomationModule): LinghuAutomationModule {
  const index = LINGHU_AUTOMATION_MODULES.indexOf(module);
  return LINGHU_AUTOMATION_MODULES[(index + 1) % LINGHU_AUTOMATION_MODULES.length] || "flow-completion";
}

function moduleLabel(module: LinghuAutomationModule): string {
  return {
    "flow-completion": "自动流程完成保障",
    "test-coverage": "测试漏点补充与能力升级",
    "audit-completeness": "日志审计完整性",
  }[module];
}

function moduleInstruction(module: LinghuAutomationModule): string {
  return {
    "flow-completion": "最高优先级检查所有人物任务的当前状态、等待点和完成条件。发现停点不能只报告，必须提出最小修正方案并推动审核、执行、集成、统一测试和最终完成。",
    "test-coverage": "根据真实改动和失败证据检查主路径、边界、异常、相邻回归与并发漏点；先补缺失测试再修正复测，并优化排队等待、重复构建和资源占用。",
    "audit-completeness": "检查任务、人物、测试批次、进程、端口、构建目录及排队、占用、冲突、释放、超时、结果是否结构化关联；缺失时补齐审计事实。",
  }[module];
}

function testResourceContext(state: TestResourceCoordinatorState | null): string {
  if (!state) return "当前没有测试资源协调快照。";
  const holder = state.holder
    ? `当前占用者：${state.holder.runId}，任务 ${state.holder.taskId || "全局统一测试"}，进程 ${state.holder.processId}，端口 ${state.holder.port ?? "无"}，构建目录 ${state.holder.buildRoot}，心跳 ${state.holder.heartbeatAt}`
    : "当前没有测试资源占用者";
  const waiters = state.waiters.length > 0
    ? `等待队列：${state.waiters.map((waiter) => `${waiter.runId}(进程${waiter.processId})`).join("、")}`
    : "等待队列为空";
  const lastEvent = state.lastEvent
    ? `最近资源事件：${state.lastEvent.type}，等待 ${state.lastEvent.waitDurationMs}ms，执行 ${state.lastEvent.executionDurationMs ?? "未完成"}ms，冲突 ${state.lastEvent.contentionCount} 次`
    : "当前没有资源事件";
  return `测试资源结构化事实：${holder}；${waiters}；${lastEvent}。`;
}
