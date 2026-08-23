import type { Locale, WorkspaceState } from "../../../shared/contracts/desktop.js";
import type { LinghuAutomationModule, LinghuAutomationState } from "../../../shared/contracts/linghu-automation.js";
import { CollaborationCoordinator } from "./collaboration-coordinator.js";
import { LINGHU_AUTOMATION_MODULES, LinghuAutomationStore } from "./linghu-automation-store.js";

const LINGHU_MEMBER_ID = "linghu-ancestor";
export interface LinghuAutomationFacadeOptions {
  store: LinghuAutomationStore;
  collaboration: CollaborationCoordinator;
  readWorkspaceState(): WorkspaceState;
  locale(): Locale;
  recordEvent(type: string, details: Record<string, unknown>, taskId?: string): void;
  runUnifiedTestAndRestart(): Promise<void>;
}

/** 令狐老祖自动保障的唯一入口；界面和定时器只调用本 Facade，不直接依赖调度、恢复与持久化实现。 */
export class LinghuAutomationFacade {
  readonly #store: LinghuAutomationStore;
  readonly #collaboration: CollaborationCoordinator;
  readonly #readWorkspaceState: () => WorkspaceState;
  readonly #locale: () => Locale;
  readonly #recordEvent: LinghuAutomationFacadeOptions["recordEvent"];
  readonly #runUnifiedTestAndRestart: () => Promise<void>;
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
      let automation = this.#store.updateRuntime("automation.checked", (state) => { state.lastCheckedAt = new Date().toISOString(); });
      if (this.#collaboration.state().mode !== "collaboration") this.#collaboration.setMode("collaboration");

      if (automation.activeTaskId) {
        const task = this.#collaboration.state().tasks.find((candidate) => candidate.taskId === automation.activeTaskId);
        if (!task) {
          this.#store.updateRuntime("automation.task_missing", (state) => {
            state.blockingReason = "关联任务记录缺失，持续检测并等待人工确认";
          });
          return;
        }
        if (task.state === "integrated") {
          const completedModule = automation.currentModule;
          automation = this.#completeModule(task.taskId, task.state, task.resultSummary?.finalResult || task.finalResult || "模块已完成。", task.completedAt);
          if (completedModule === "unified-test-restart") {
            try {
              await this.#runUnifiedTestAndRestart();
            } catch (error) {
              const detail = error instanceof Error ? error.message : String(error);
              this.#store.updateRuntime("automation.unified_test_failed", (state) => {
                state.currentModule = "flow-completion";
                state.blockingReason = `统一测试失败，检测继续运行并进入修复循环：${detail}`.slice(0, 2_000);
                state.lastFeedback = { cycle: state.cycle, module: completedModule, taskId: task.taskId, taskState: task.state, summary: state.blockingReason, recordedAt: new Date().toISOString() };
              });
              this.#recordEvent("linghu.automation.unified_test_failed", { detail }, task.taskId);
              return;
            }
          }
        } else if (task.state === "cancelled") {
          this.#store.updateRuntime("automation.task_cancelled", (state) => {
            state.blockingReason = "当前保障任务已取消；自动检测保持开启，等待选择继续或新建文案";
            state.lastFeedback = { cycle: state.cycle, module: state.currentModule, taskId: task.taskId, taskState: task.state, summary: task.blockingReason || "任务已取消", recordedAt: new Date().toISOString() };
          });
          return;
        } else if (task.state === "blocked" || task.state === "recovering") {
          if (automation.recoveryAttemptCount < 3) {
            this.#collaboration.continueTask(task.taskId);
            this.#store.updateRuntime("automation.recovery_requested", (state) => {
              state.recoveryAttemptCount += 1;
              state.blockingReason = `检测到流程中断，正在执行第 ${state.recoveryAttemptCount} 次自动恢复`;
            });
          } else {
            this.#store.updateRuntime("automation.recovery_waiting", (state) => {
              state.blockingReason = `连续恢复未成功：${task.blockingReason || "原因未知"}。检测仍保持运行，等待安全恢复条件或人工业务选择。`;
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
    });
    const task = next.tasks.at(-1);
    if (!task) throw new Error("自动保障任务创建后没有返回任务记录。");
    this.#store.updateRuntime("automation.module_dispatched", (current) => {
      current.activePromptId = prompt.promptId;
      current.activeTaskId = task.taskId;
      current.lastDispatchAt = new Date().toISOString();
      current.recoveryAttemptCount = 0;
      current.blockingReason = null;
    });
    this.#recordEvent("linghu.automation.module_dispatched", { cycle: state.cycle, module: state.currentModule, promptId: prompt.promptId }, task.taskId);
  }

  #completeModule(taskId: string, taskState: "integrated", summary: string, completedAt: string | null): LinghuAutomationState {
    return this.#store.updateRuntime("automation.module_completed", (state) => {
      const completedModule = state.currentModule;
      const currentIndex = LINGHU_AUTOMATION_MODULES.indexOf(completedModule);
      const nextIndex = (currentIndex + 1) % LINGHU_AUTOMATION_MODULES.length;
      state.lastFeedback = { cycle: state.cycle, module: completedModule, taskId, taskState, summary: summary.slice(0, 2_000), recordedAt: new Date().toISOString() };
      state.currentModule = LINGHU_AUTOMATION_MODULES[nextIndex];
      if (nextIndex === 0) state.cycle += 1;
      state.activeTaskId = null;
      state.recoveryAttemptCount = 0;
      state.lastCompletedAt = completedAt || new Date().toISOString();
      state.blockingReason = null;
    });
  }
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
