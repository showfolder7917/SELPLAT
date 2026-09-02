import type {
  CodexStreamActivityOutDto,
  CodexStreamEventOutDto,
  ManagedExecutionUpdateEventOutDto,
} from "../../../../../../contracts/services/support/platform/codex/index.js";
import type { ManagedExecutionModeValue } from "../../../../../../contracts/foundation/index.js";
import type { SendMessageOutDto } from "../../../../../../contracts/services/support/capabilities/conversation/index.js";
import type { PromptLibraryPort, PromptVariables } from "../../prompts/index.js";

type RunTurn = (
  message: string,
  onEvent: (event: CodexStreamEventOutDto) => void,
  mode: ManagedExecutionModeValue,
) => Promise<SendMessageOutDto>;

export interface ManagedExecutionRequest {
  mode: ManagedExecutionModeValue;
  message: string;
  restartRequired: boolean;
  runTurn: RunTurn;
  runCodeValidation?: (emit: (event: CodexStreamEventOutDto) => void) => Promise<void>;
  emit(event: CodexStreamEventOutDto): void;
}

export interface ManagedExecutionResult extends SendMessageOutDto {
  managedStatus: "conversation-ready" | "requirement-ready" | "code-verified" | "test-verified" | "incomplete";
  pendingActions: string[];
  restartRequired: boolean;
  changedFiles: string[];
  successfulCommands: string[];
}

const TASK_ROUNDS = 3;
const VALIDATION_ROUNDS = 5;
const BUILD_ROUNDS = 3;

/** 在官方 Harness 外管理多轮任务，但把构建验证与日常代码验证分成两个明确入口。 */
export class ManagedTaskExecutor {
  /** 注入统一提示词库；执行器仍由代码负责轮次、证据和命令门禁。 */
  constructor(private readonly prompts: PromptLibraryPort) {}

  async run(request: ManagedExecutionRequest): Promise<ManagedExecutionResult> {
    if (request.mode === "conversation-managed") return this.#runConversation(request);
    if (request.mode === "requirement-managed") return this.#runRequirementAnalysis(request);
    if (request.mode === "test-managed") return this.#runBuildValidation(request);
    return this.#runTask(request);
  }

  async #runConversation(request: ManagedExecutionRequest): Promise<ManagedExecutionResult> {
    emitManaged(request, "conversation", "started", 1, 1, "正在结合上下文理解你的意思");
    const response = await request.runTurn(this.#managedPrompt(request.message, "execution.conversation"), request.emit, "conversation-managed");
    emitManaged(request, "conversation", "completed", 1, 1, "已经整理好你的完整意图");
    emitManaged(request, "completed", "completed", 1, 1, "确认无误后可以继续调查和分析");
    return { ...response, managedStatus: "conversation-ready", pendingActions: ["确认意图后进入需求托管"], restartRequired: false, changedFiles: [], successfulCommands: [] };
  }

  async #runRequirementAnalysis(request: ManagedExecutionRequest): Promise<ManagedExecutionResult> {
    emitManaged(request, "requirement-analysis", "started", 1, 1, "正在调查原因并整理可执行的修正方案");
    const response = await request.runTurn(this.#managedPrompt(request.message, "execution.requirement-analysis"), request.emit, "requirement-managed");
    emitManaged(request, "requirement-analysis", "completed", 1, 1, "原因和修正方案已经整理完成");
    emitManaged(request, "completed", "completed", 1, 1, "确认方案后可以开始修改");
    return { ...response, managedStatus: "requirement-ready", pendingActions: ["确认方案后进入任务托管"], restartRequired: false, changedFiles: [], successfulCommands: [] };
  }

  async #runTask(request: ManagedExecutionRequest): Promise<ManagedExecutionResult> {
    const evidence = new ExecutionEvidence();
    let response: SendMessageOutDto = { text: "", itemCount: 0 };
    let taskRound = 0;
    let taskMessage = this.#managedPrompt(request.message, "execution.task");

    for (taskRound = 1; taskRound <= TASK_ROUNDS; taskRound += 1) {
      emitManaged(request, "task-execution", taskRound === 1 ? "started" : "continuing", taskRound, TASK_ROUNDS,
        taskRound === 1 ? "正在按确认的方案修改源码" : "正在处理修改过程中发现的问题");
      evidence.beginRound();
      response = await request.runTurn(taskMessage, (event) => { evidence.record(event); request.emit(event); }, "task-managed");
      if (!evidence.roundFailed && evidence.changedFiles.size > 0) break;
      taskMessage = evidence.roundFailed
        ? this.#managedPrompt("继续处理同一任务。", "execution.task-repair", { failures: evidence.failedCommandSummaries().join("\n") || "存在未解决错误" })
        : this.#managedPrompt("继续处理同一任务。", "execution.task-repair", { failures: "任务要求修改源码，但上一轮没有观察到任何文件变更" });
    }

    if (evidence.roundFailed || evidence.changedFiles.size === 0) {
      emitManaged(request, "task-execution", "blocked", taskRound - 1, TASK_ROUNDS, "修改过程仍有未解决错误，已停止自动续跑");
      return {
        ...response,
        managedStatus: "incomplete",
        pendingActions: [evidence.changedFiles.size === 0 ? "任务要求修改源码，但未观察到文件变更" : evidence.failedCommandSummaries().join("；") || "处理任务阶段未解决错误"],
        restartRequired: false,
        changedFiles: [...evidence.changedFiles],
        successfulCommands: evidence.successfulCommands(),
      };
    }
    emitManaged(request, "task-execution", "completed", Math.min(taskRound, TASK_ROUNDS), TASK_ROUNDS, "源码任务阶段完成");

    if (request.runCodeValidation) {
      return this.#runDesktopOwnedCodeValidation(request, evidence, response);
    }

    let validationMessage = this.#managedPrompt("继续验证本次修改。", "execution.code-validation", {
      files: [...evidence.changedFiles].join("\n"),
      maximumRounds: VALIDATION_ROUNDS,
    });
    for (let round = 1; round <= VALIDATION_ROUNDS; round += 1) {
      emitManaged(request, "code-validation", round === 1 ? "started" : "continuing", round, VALIDATION_ROUNDS,
        round === 1 ? "代码验证阶段：静态检查与后台隔离交互测试" : "检查失败后正在修复并复测");
      let interactionStarted = false;
      evidence.beginRound();
      response = await request.runTurn(validationMessage, (event) => {
        evidence.record(event);
        request.emit(event);
        if (!interactionStarted && event.type === "activity" && event.activity?.phase === "started" && isIsolatedInteractionTestCommand(event.activity.summary || "")) {
          interactionStarted = true;
          emitManaged(request, "interaction-validation", "started", round, VALIDATION_ROUNDS, "后台隔离 Electron 正在执行程序化交互测试");
        }
      }, "task-managed");
      const gate = evidence.codeValidationGate();
      if (gate.passed) {
        emitManaged(request, "code-validation", "completed", round, VALIDATION_ROUNDS, "静态检查已通过");
        emitManaged(request, "interaction-validation", "completed", round, VALIDATION_ROUNDS, "后台隔离 Electron 交互测试已通过");
        emitManaged(request, "completed", "completed", 1, 1, "代码级验证完成；需要时可以继续构建和运行测试");
        return {
          ...response,
          managedStatus: "code-verified",
          pendingActions: ["按需单独执行测试托管：构建、构建后测试和必要重启"],
          restartRequired: false,
          changedFiles: [...evidence.changedFiles],
          successfulCommands: evidence.successfulCommands(),
        };
      }
      validationMessage = this.#managedPrompt("继续完成同一任务的代码级验证。", "execution.code-validation-repair", {
        missing: gate.missing.join("；"),
        failures: evidence.failedCommandSummaries().join("；") || "无",
        maximumRounds: VALIDATION_ROUNDS,
      });
    }

    const gate = evidence.codeValidationGate();
    emitManaged(request, "code-validation", "blocked", VALIDATION_ROUNDS, VALIDATION_ROUNDS, gate.missing.join("；"));
    return { ...response, managedStatus: "incomplete", pendingActions: gate.missing, restartRequired: false, changedFiles: [...evidence.changedFiles], successfulCommands: evidence.successfulCommands() };
  }

  /** 协同 worktree 的固定测试由桌面主进程执行，Codex 只在失败后接收事实并修复源码。 */
  async #runDesktopOwnedCodeValidation(
    request: ManagedExecutionRequest,
    evidence: ExecutionEvidence,
    initialResponse: SendMessageOutDto,
  ): Promise<ManagedExecutionResult> {
    const runCodeValidation = request.runCodeValidation;
    if (!runCodeValidation) throw new Error("AI Desktop 内部验证入口未配置。");
    let response = initialResponse;
    let lastFailure = "";
    for (let round = 1; round <= VALIDATION_ROUNDS; round += 1) {
      emitManaged(request, "code-validation", round === 1 ? "started" : "continuing", round, VALIDATION_ROUNDS,
        round === 1 ? "AI Desktop 正在当前任务分支执行静态检查" : "源码修复后正在当前任务分支重新检查");
      emitManaged(request, "interaction-validation", "started", round, VALIDATION_ROUNDS, "AI Desktop 正在当前任务分支执行隔离 Playwright");
      try {
        await runCodeValidation(request.emit);
        emitManaged(request, "code-validation", "completed", round, VALIDATION_ROUNDS, "当前任务分支静态检查已通过");
        emitManaged(request, "interaction-validation", "completed", round, VALIDATION_ROUNDS, "当前任务分支隔离 Playwright 已通过");
        emitManaged(request, "completed", "completed", 1, 1, "代码级验证完成；需要时可以继续构建和运行测试");
        return {
          ...response,
          managedStatus: "code-verified",
          pendingActions: ["按需单独执行测试托管：构建、构建后测试和必要重启"],
          restartRequired: false,
          changedFiles: [...evidence.changedFiles],
          successfulCommands: evidence.successfulCommands(),
        };
      } catch (error) {
        lastFailure = error instanceof Error ? error.message : String(error);
        if (round === VALIDATION_ROUNDS) break;
        evidence.beginRound();
        response = await request.runTurn(this.#managedPrompt("继续修复当前任务。", "execution.desktop-validation-repair", { failure: lastFailure }), (event) => {
          evidence.record(event);
          request.emit(event);
        }, "task-managed");
        if (evidence.roundFailed) lastFailure = `${lastFailure}；修复阶段仍有失败命令：${evidence.failedCommandSummaries().join("；")}`;
      }
    }
    emitManaged(request, "code-validation", "blocked", VALIDATION_ROUNDS, VALIDATION_ROUNDS, lastFailure || "当前任务分支验证失败");
    emitManaged(request, "interaction-validation", "blocked", VALIDATION_ROUNDS, VALIDATION_ROUNDS, "Playwright 未通过，未进入集成队列");
    return { ...response, managedStatus: "incomplete", pendingActions: [lastFailure || "当前任务分支验证失败"], restartRequired: false, changedFiles: [...evidence.changedFiles], successfulCommands: evidence.successfulCommands() };
  }

  async #runBuildValidation(request: ManagedExecutionRequest): Promise<ManagedExecutionResult> {
    const evidence = new ExecutionEvidence();
    let response: SendMessageOutDto = { text: "", itemCount: 0 };
    let message = this.#managedPrompt(request.message, "execution.build-validation", {
      restartInstruction: request.restartRequired
        ? "完成后由桌面主进程受控重启一次，不要在命令中自行启动或重启当前应用。"
        : "只有确有运行时验证需要时才说明重启要求。",
    });
    for (let round = 1; round <= BUILD_ROUNDS; round += 1) {
      emitManaged(request, "build-validation", round === 1 ? "started" : "continuing", round, BUILD_ROUNDS,
        round === 1 ? "正在构建并执行构建后的测试" : "正在修复构建或测试问题并复测");
      evidence.beginRound();
      response = await request.runTurn(message, (event) => { evidence.record(event); request.emit(event); }, "test-managed");
      const gate = evidence.buildValidationGate();
      if (gate.passed) {
        emitManaged(request, "build-validation", "completed", round, BUILD_ROUNDS, "构建与构建后测试已通过");
        if (request.restartRequired) {
          emitManaged(request, "runtime-restart", "started", 1, 1, "当前应用将在本轮返回后只重启一次");
        }
        emitManaged(request, "completed", "completed", 1, 1, request.restartRequired ? "测试完成，接下来会受控重启一次" : "测试完成，本次不需要重启");
        return { ...response, managedStatus: "test-verified", pendingActions: [], restartRequired: request.restartRequired, changedFiles: [...evidence.changedFiles], successfulCommands: evidence.successfulCommands() };
      }
      message = this.#managedPrompt("继续完成同一任务的构建和测试。", "execution.build-validation-repair", {
        missing: gate.missing.join("；"),
        failures: evidence.failedCommandSummaries().join("；") || "无",
      });
    }
    const gate = evidence.buildValidationGate();
    emitManaged(request, "build-validation", "blocked", BUILD_ROUNDS, BUILD_ROUNDS, gate.missing.join("；"));
    return { ...response, managedStatus: "incomplete", pendingActions: gate.missing, restartRequired: false, changedFiles: [...evidence.changedFiles], successfulCommands: evidence.successfulCommands() };
  }

  /** 公共外壳保留不可隐藏的后台边界，具体阶段行为从提示词库按 ID 取得。 */
  #managedPrompt(message: string, promptId: string, variables: PromptVariables = {}): string {
    return managedPrompt(message, this.prompts.render(promptId, variables));
  }
}

class ExecutionEvidence {
  readonly changedFiles = new Set<string>();
  #sequence = 0;
  #lastChange = 0;
  #staticCheck = 0;
  #targetedTest = 0;
  #isolatedInteractionTest = 0;
  #build = 0;
  #unifiedDocumentValidation = 0;
  #roundFailures: string[] = [];
  #successfulCommands = new Set<string>();

  get roundFailed(): boolean { return this.#roundFailures.length > 0; }

  beginRound(): void { this.#roundFailures = []; }

  record(event: CodexStreamEventOutDto): void {
    this.#sequence += 1;
    if (event.type === "diff-updated") {
      // diff-updated 是当前工作树的完整路径快照，会在测试结束后重复上报；这里只汇总真实源码路径，不能刷新修改时间。
      for (const file of event.changedFiles || []) if (!isManagedValidationArtifact(file)) this.changedFiles.add(file);
    }
    const activity = event.activity;
    if (event.type !== "activity" || !activity) return;
    if (activity.itemType === "fileChange" && activity.phase === "completed") {
      const sourceFiles = (activity.summary?.split("\n") || []).filter((file) => file && !isManagedValidationArtifact(file));
      for (const file of sourceFiles) this.changedFiles.add(file);
      if (sourceFiles.length > 0) this.#lastChange = this.#sequence;
      return;
    }
    if (activity.itemType !== "commandExecution" || activity.phase !== "completed") return;
    const command = activity.summary || "(unknown command)";
    const succeeded = commandSucceeded(activity);
    if (!succeeded) {
      this.#roundFailures.push(command);
      return;
    }
    this.#successfulCommands.add(command);
    if (isStaticCheckCommand(command)) this.#staticCheck = this.#sequence;
    if (isTargetedTestCommand(command)) this.#targetedTest = this.#sequence;
    if (isIsolatedInteractionTestCommand(command)) this.#isolatedInteractionTest = this.#sequence;
    if (isBuildCommand(command)) this.#build = this.#sequence;
    // 固定统一入口会在一个外层命令事件中按共享文档顺序执行构建和后续测试；
    // 只有该入口成功时，才允许构建与测试证据使用同一事件序号。
    if (isUnifiedTestDocumentCommand(command)) this.#unifiedDocumentValidation = this.#sequence;
  }

  failedCommandSummaries(): string[] { return [...this.#roundFailures]; }
  successfulCommands(): string[] { return [...this.#successfulCommands]; }

  codeValidationGate(): { passed: boolean; missing: string[] } {
    const missing: string[] = [];
    if (this.#staticCheck <= this.#lastChange) missing.push("尚未在最后一次源码修改后通过静态检查");
    if (this.#targetedTest <= this.#lastChange) missing.push("尚未在最后一次源码修改后通过针对性快速测试");
    if (this.#isolatedInteractionTest <= this.#lastChange) missing.push("尚未在最后一次源码修改后通过后台隔离 Electron 交互测试");
    if (this.roundFailed) missing.push("当前验证轮次仍有失败命令");
    return { passed: missing.length === 0, missing };
  }

  buildValidationGate(): { passed: boolean; missing: string[] } {
    const missing: string[] = [];
    if (this.#build <= this.#lastChange) missing.push("尚未在最后一次源码修改后完成构建");
    const unifiedDocumentCompleted = this.#unifiedDocumentValidation === this.#build
      && this.#targetedTest === this.#build;
    if (this.#targetedTest < this.#build || (this.#targetedTest === this.#build && !unifiedDocumentCompleted)) {
      missing.push("尚未在最新构建后通过测试");
    }
    if (this.roundFailed) missing.push("当前构建验证轮次仍有失败命令");
    return { passed: missing.length === 0, missing };
  }
}

/** 共享测试文档、归档和 Playwright 临时证据属于验证产物，不得冒充源码修改或让刚通过的验证失效。 */
export function isManagedValidationArtifact(filePath: string): boolean {
  const normalized = filePath.replaceAll("\\", "/").replace(/^\.\//, "");
  return /(?:^|\/)OPTION\/temp\/[a-zA-Z0-9_-]+\/(?:执行日志\/(?:待执行|运行中)\/测试\/|临时材料\/测试证据\/)/.test(normalized)
    || /(?:^|\/)log\/[a-zA-Z0-9_-]+\/归档日志\/(?:测试归档\/|执行归档\/|协同归档\/|审批归档\/|诊断归档\/)/.test(normalized);
}

function commandSucceeded(activity: CodexStreamActivityOutDto): boolean {
  if (activity.exitCode !== undefined) return activity.exitCode === 0;
  return activity.status === "completed" || activity.status === "success";
}

export function isBuildCommand(command: string): boolean {
  return /(?:npm|pnpm|yarn)\s+(?:run\s+)?(?:build|start|dev|serve|preview|test:document)\b|vite\s+build|electron-builder|\belectron\s+\.|gradle(?:w)?\s+(?:build|assemble|bootRun)\b|cargo\s+(?:build|run)\b/i.test(command);
}

function isUnifiedTestDocumentCommand(command: string): boolean {
  return /(?:npm|pnpm|yarn)\s+(?:run\s+)?test:document\b/i.test(command);
}

export function isStaticCheckCommand(command: string): boolean {
  return /\btest:document\b/i.test(command) || (/\btypecheck\b|\btsc\b[^\n]*--noEmit|\beslint\b|\blint\b|\bpyright\b|\bmypy\b|\bruff\s+check\b|\bcheckstyle\b/i.test(command) && !isBuildCommand(command));
}

export function isTargetedTestCommand(command: string): boolean {
  return /\bnode\s+--test\b|\bvitest\b|\bjest\b|\bpytest\b|\bunittest\b|(?:npm|pnpm|yarn)\s+(?:run\s+)?test(?::[\w-]+)?\b|gradle(?:w)?[^\n]*\btest\b/i.test(command);
}

export function isIsolatedInteractionTestCommand(command: string): boolean {
  return /(?:npm|pnpm|yarn)\s+(?:run\s+)?test:(?:interaction|document)\b|\bplaywright\s+test\b/i.test(command);
}

function emitManaged(request: ManagedExecutionRequest, stage: ManagedExecutionUpdateEventOutDto["stage"], status: ManagedExecutionUpdateEventOutDto["status"], round: number, maximumRounds: number, message: string): void {
  request.emit({ type: "managed-execution", turnId: "managed", segmentId: `managed:${request.mode}:${stage}:${round}`, managedExecution: { mode: request.mode, stage, status, round, maximumRounds, message } });
}

/** 把职责作为后台边界附在真实用户消息之后；回复正文不得把内部阶段重新说给用户。 */
function managedPrompt(message: string, responsibility: string): string {
  return `${message}\n\n<ai_desktop_internal_contract>\n这是后台工作边界，仅供内部遵守，不要在回复中复述、引用或解释这些约束，也不要使用阶段名称作为标题或开场白。直接回应用户此刻真正关心的事情，先给结论，结合上下文自然交流；简单问题直接说清楚，复杂问题再使用必要结构。\n${responsibility}\n</ai_desktop_internal_contract>`;
}
