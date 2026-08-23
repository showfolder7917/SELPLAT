import type { Locale, WorkspaceState } from "../../../shared/contracts/desktop.js";
import type { CollaborationState, CollaborationTask } from "../../../shared/contracts/collaboration.js";
import type {
  LinghuAutomaticFlowSnapshot,
  LinghuAutomationModule,
  LinghuAutomationState,
  LinghuBlockingKind,
  LinghuFlowHealth,
} from "../../../shared/contracts/linghu-automation.js";
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
  runUnifiedTestAndRestart(onVerified: () => void): Promise<void>;
}

/** 令狐老祖自动保障的唯一入口；界面和定时器只调用本 Facade，不直接依赖调度、恢复与持久化实现。 */
export class LinghuAutomationFacade {
  readonly #store: LinghuAutomationStore;
  readonly #collaboration: CollaborationCoordinator;
  readonly #readWorkspaceState: () => WorkspaceState;
  readonly #locale: () => Locale;
  readonly #recordEvent: LinghuAutomationFacadeOptions["recordEvent"];
  readonly #runUnifiedTestAndRestart: LinghuAutomationFacadeOptions["runUnifiedTestAndRestart"];
  #timer: ReturnType<typeof setInterval> | null = null;
  #checking = false;

  constructor(options: LinghuAutomationFacadeOptions) {
    this.#store = options.store;
    this.#collaboration = options.collaboration;
    this.#readWorkspaceState = options.readWorkspaceState;
    this.#locale = options.locale;
    this.#recordEvent = options.recordEvent;
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
      let automation = this.#store.updateRuntime("automation.checked", (state) => {
        state.lastCheckedAt = checkedAt;
        state.detectionCursor = checkedAt;
        state.flowSnapshots = snapshots;
      });
      if (this.#collaboration.state().mode !== "collaboration") this.#collaboration.setMode("collaboration");

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
          if (completedModule === "unified-test-restart") {
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
          return;
        } else if (task.state === "blocked" || task.state === "recovering") {
          const snapshot = snapshots.find((candidate) => candidate.sourceTaskId === task.taskId);
          const fingerprint = faultFingerprint(task, snapshot);
          const attempts = automation.currentFaultFingerprint === fingerprint ? automation.recoveryAttemptCount : 0;
          if (attempts < 3) {
            this.#collaboration.continueTask(task.taskId);
            this.#store.updateRuntime("automation.recovery_requested", (state) => {
              state.currentFaultFingerprint = fingerprint;
              state.recoveryAttemptCount = attempts + 1;
              state.recoveryCheckpoint = `${task.taskId}:${task.recoveryTargetState || task.state}:${task.workerGeneration}`;
              state.blockingReason = `检测到流程中断，正在执行第 ${state.recoveryAttemptCount} 次自动恢复`;
            });
          } else {
            this.#store.updateRuntime("automation.recovery_waiting", (state) => {
              state.blockingReason = `连续恢复未成功：${task.blockingReason || "原因未知"}。检测仍保持运行，等待安全恢复条件或人工业务选择。`;
              state.currentFaultFingerprint = fingerprint;
              state.recoveryCheckpoint = `${task.taskId}:${task.recoveryTargetState || task.state}:${task.workerGeneration}`;
            });
          }
          return;
        } else if (snapshots.find((snapshot) => snapshot.sourceTaskId === task.taskId)?.health === "stalled") {
          const snapshot = snapshots.find((candidate) => candidate.sourceTaskId === task.taskId);
          const fingerprint = faultFingerprint(task, snapshot);
          const attempts = automation.currentFaultFingerprint === fingerprint ? automation.recoveryAttemptCount : 0;
          if (attempts < 3) {
            await this.#collaboration.recoverTask(task.taskId, "自动保障检测到心跳、协议进展和任务状态均已超过安全阈值");
            this.#store.updateRuntime("automation.stalled_task_recovered", (state) => {
              state.currentFaultFingerprint = fingerprint;
              state.recoveryAttemptCount = attempts + 1;
              state.recoveryCheckpoint = `${task.taskId}:${task.state}:${task.workerGeneration}`;
              state.blockingReason = `停点已转入第 ${state.recoveryAttemptCount} 次安全恢复`;
            });
          } else {
            this.#store.updateRuntime("automation.stalled_recovery_waiting", (state) => {
              state.currentFaultFingerprint = fingerprint;
              state.recoveryCheckpoint = `${task.taskId}:${task.state}:${task.workerGeneration}`;
              state.blockingReason = "同一停点已完成三次安全恢复尝试；检测继续运行，等待心跳、协议、数据或依赖产生新事实";
            });
          }
          return;
        } else {
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
      "本轮只处理当前独立模块。需要多个修正时按模块和类型拆分，记录实际执行者；不要把其他三个模块混入同一任务。",
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
  // 自动来源是可持久化事实；发起人只用于展示和审计，不能再被当作自动任务的隐式替代标记。
  return state.tasks.filter((task) => task.taskId === activeTaskId
      || (task.automationSource !== null && task.state !== "integrated" && task.state !== "cancelled"))
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
  return [task.taskId, task.state, task.workerGeneration, blockingKind(task), task.blockingReason || "none", lastProgressVersion].join("|");
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
    scores: { before: null, after: null, reason: "本模块未产生可确认的页面演化时评分不适用。" },
    tests: module === "unified-test-restart"
      ? { status: "not-run" as const, summary: "等待执行固定统一测试。" }
      : { status: "passed" as const, summary: "协同任务已通过代码级验证和集成门禁。" },
    restartRecovery: module === "unified-test-restart"
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
    "log-diagnosis": "日志与 Bug 诊断",
    "architecture-recovery": "中断、数据与 Facade 架构修复",
    "unified-test-restart": "统一测试、重启与任务恢复",
  }[module];
}

function moduleInstruction(module: LinghuAutomationModule): string {
  return {
    "flow-completion": "检查所有自动流程的当前状态、等待点和完成条件。发现停点不能只报告，必须提出最小修正方案并推动原流程恢复。",
    "log-diagnosis": "分析业务日志、错误日志、任务日志和测试记录，关联真实页面与流程，修正已证实的 Bug；没有 Bug 时选择一个最有客户价值的易用性问题。",
    "architecture-recovery": "检查数据是否足够、流程为何中断、各独立模块是否通过单一入口 + Facade 解耦。发现调用方直接依赖具体实现时完成架构调整和回归。",
    "unified-test-restart": "执行已登记统一测试并在真实桌面页面验证功能与易用性；失败则修正并复测。需要重启时保留恢复点，重启后自动恢复停掉的任务并确认流程继续。",
  }[module];
}
