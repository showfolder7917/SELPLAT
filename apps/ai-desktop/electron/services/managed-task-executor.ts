import type {
  CodexStreamActivity,
  CodexStreamEvent,
  ManagedExecutionMode,
  ManagedExecutionUpdate,
  SendMessageResponse,
} from "../../shared/contracts/desktop.js";

type RunTurn = (
  message: string,
  onEvent: (event: CodexStreamEvent) => void,
  mode: ManagedExecutionMode,
) => Promise<SendMessageResponse>;

export interface ManagedExecutionRequest {
  mode: ManagedExecutionMode;
  message: string;
  restartRequired: boolean;
  runTurn: RunTurn;
  emit(event: CodexStreamEvent): void;
}

export interface ManagedExecutionResult extends SendMessageResponse {
  managedStatus: "conversation-ready" | "requirement-ready" | "code-verified" | "test-verified" | "incomplete";
  pendingActions: string[];
  restartRequired: boolean;
}

const TASK_ROUNDS = 3;
const VALIDATION_ROUNDS = 5;
const BUILD_ROUNDS = 3;

/** 在官方 Harness 外管理多轮任务，但把构建验证与日常代码验证分成两个明确入口。 */
export class ManagedTaskExecutor {
  async run(request: ManagedExecutionRequest): Promise<ManagedExecutionResult> {
    if (request.mode === "conversation-managed") return this.#runConversation(request);
    if (request.mode === "requirement-managed") return this.#runRequirementAnalysis(request);
    if (request.mode === "test-managed") return this.#runBuildValidation(request);
    return this.#runTask(request);
  }

  async #runConversation(request: ManagedExecutionRequest): Promise<ManagedExecutionResult> {
    emitManaged(request, "conversation", "started", 1, 1, "会话托管正在理解用户意图");
    const response = await request.runTurn(conversationPrompt(request.message), request.emit, "conversation-managed");
    emitManaged(request, "conversation", "completed", 1, 1, "意图理解完成，等待用户确认");
    emitManaged(request, "completed", "completed", 1, 1, "点击“就是这意思”或单独回复 1 进入需求分析");
    return { ...response, managedStatus: "conversation-ready", pendingActions: ["确认意图后进入需求托管"], restartRequired: false };
  }

  async #runRequirementAnalysis(request: ManagedExecutionRequest): Promise<ManagedExecutionResult> {
    emitManaged(request, "requirement-analysis", "started", 1, 1, "需求托管正在调查原因并整理修正方案");
    const response = await request.runTurn(requirementPrompt(request.message), request.emit, "requirement-managed");
    emitManaged(request, "requirement-analysis", "completed", 1, 1, "需求分析与修正方案已完成");
    emitManaged(request, "completed", "completed", 1, 1, "点击“按这个方案执行”或单独回复 1 进入任务托管");
    return { ...response, managedStatus: "requirement-ready", pendingActions: ["确认方案后进入任务托管"], restartRequired: false };
  }

  async #runTask(request: ManagedExecutionRequest): Promise<ManagedExecutionResult> {
    const evidence = new ExecutionEvidence();
    let response: SendMessageResponse = { text: "", itemCount: 0 };
    let taskRound = 0;
    let taskMessage = taskExecutionPrompt(request.message);

    for (taskRound = 1; taskRound <= TASK_ROUNDS; taskRound += 1) {
      emitManaged(request, "task-execution", taskRound === 1 ? "started" : "continuing", taskRound, TASK_ROUNDS,
        taskRound === 1 ? "任务托管正在分析并修改源码" : "任务托管正在修复修改过程中的错误");
      evidence.beginRound();
      response = await request.runTurn(taskMessage, (event) => { evidence.record(event); request.emit(event); }, "task-managed");
      if (!evidence.roundFailed && evidence.changedFiles.size > 0) break;
      taskMessage = evidence.roundFailed
        ? taskRepairPrompt(evidence.failedCommandSummaries())
        : taskRepairPrompt(["任务要求修改源码，但上一轮没有观察到任何文件变更"]);
    }

    if (evidence.roundFailed || evidence.changedFiles.size === 0) {
      emitManaged(request, "task-execution", "blocked", taskRound - 1, TASK_ROUNDS, "修改过程仍有未解决错误，已停止自动续跑");
      return {
        ...response,
        managedStatus: "incomplete",
        pendingActions: [evidence.changedFiles.size === 0 ? "任务要求修改源码，但未观察到文件变更" : "处理任务阶段未解决错误"],
        restartRequired: false,
      };
    }
    emitManaged(request, "task-execution", "completed", Math.min(taskRound, TASK_ROUNDS), TASK_ROUNDS, "源码任务阶段完成");

    let validationMessage = codeValidationPrompt([...evidence.changedFiles]);
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
        emitManaged(request, "completed", "completed", 1, 1, "代码级验证完成；构建与启动等待单独触发测试托管");
        return {
          ...response,
          managedStatus: "code-verified",
          pendingActions: ["按需单独执行测试托管：构建、构建后测试和必要重启"],
          restartRequired: false,
        };
      }
      validationMessage = codeValidationRepairPrompt(gate.missing, evidence.failedCommandSummaries());
    }

    const gate = evidence.codeValidationGate();
    emitManaged(request, "code-validation", "blocked", VALIDATION_ROUNDS, VALIDATION_ROUNDS, gate.missing.join("；"));
    return { ...response, managedStatus: "incomplete", pendingActions: gate.missing, restartRequired: false };
  }

  async #runBuildValidation(request: ManagedExecutionRequest): Promise<ManagedExecutionResult> {
    const evidence = new ExecutionEvidence();
    let response: SendMessageResponse = { text: "", itemCount: 0 };
    let message = buildValidationPrompt(request.message, request.restartRequired);
    for (let round = 1; round <= BUILD_ROUNDS; round += 1) {
      emitManaged(request, "build-validation", round === 1 ? "started" : "continuing", round, BUILD_ROUNDS,
        round === 1 ? "测试托管正在构建并执行构建后测试" : "构建或测试失败后正在修复并复测");
      evidence.beginRound();
      response = await request.runTurn(message, (event) => { evidence.record(event); request.emit(event); }, "test-managed");
      const gate = evidence.buildValidationGate();
      if (gate.passed) {
        emitManaged(request, "build-validation", "completed", round, BUILD_ROUNDS, "构建与构建后测试已通过");
        if (request.restartRequired) {
          emitManaged(request, "runtime-restart", "started", 1, 1, "当前应用将在本轮返回后只重启一次");
        }
        emitManaged(request, "completed", "completed", 1, 1, request.restartRequired ? "测试托管完成，等待一次受控重启" : "测试托管完成，无需重启");
        return { ...response, managedStatus: "test-verified", pendingActions: [], restartRequired: request.restartRequired };
      }
      message = buildValidationRepairPrompt(gate.missing, evidence.failedCommandSummaries());
    }
    const gate = evidence.buildValidationGate();
    emitManaged(request, "build-validation", "blocked", BUILD_ROUNDS, BUILD_ROUNDS, gate.missing.join("；"));
    return { ...response, managedStatus: "incomplete", pendingActions: gate.missing, restartRequired: false };
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
  #roundFailures: string[] = [];

  get roundFailed(): boolean { return this.#roundFailures.length > 0; }

  beginRound(): void { this.#roundFailures = []; }

  record(event: CodexStreamEvent): void {
    this.#sequence += 1;
    if (event.type === "diff-updated") {
      for (const file of event.changedFiles || []) this.changedFiles.add(file);
      if ((event.changedFiles || []).length > 0) this.#lastChange = this.#sequence;
    }
    const activity = event.activity;
    if (event.type !== "activity" || !activity) return;
    if (activity.itemType === "fileChange" && activity.phase === "completed") {
      for (const file of activity.summary?.split("\n") || []) if (file) this.changedFiles.add(file);
      this.#lastChange = this.#sequence;
      return;
    }
    if (activity.itemType !== "commandExecution" || activity.phase !== "completed") return;
    const command = activity.summary || "(unknown command)";
    const succeeded = commandSucceeded(activity);
    if (!succeeded) {
      this.#roundFailures.push(command);
      return;
    }
    if (isStaticCheckCommand(command)) this.#staticCheck = this.#sequence;
    if (isTargetedTestCommand(command)) this.#targetedTest = this.#sequence;
    if (isIsolatedInteractionTestCommand(command)) this.#isolatedInteractionTest = this.#sequence;
    if (isBuildCommand(command)) this.#build = this.#sequence;
  }

  failedCommandSummaries(): string[] { return [...this.#roundFailures]; }

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
    if (this.#targetedTest <= this.#build) missing.push("尚未在最新构建后通过测试");
    if (this.roundFailed) missing.push("当前构建验证轮次仍有失败命令");
    return { passed: missing.length === 0, missing };
  }
}

function commandSucceeded(activity: CodexStreamActivity): boolean {
  if (activity.exitCode !== undefined) return activity.exitCode === 0;
  return activity.status === "completed" || activity.status === "success";
}

export function isBuildCommand(command: string): boolean {
  return /(?:npm|pnpm|yarn)\s+(?:run\s+)?(?:build|start|dev|serve|preview)\b|vite\s+build|electron-builder|\belectron\s+\.|gradle(?:w)?\s+(?:build|assemble|bootRun)\b|cargo\s+(?:build|run)\b/i.test(command);
}

export function isStaticCheckCommand(command: string): boolean {
  return /\btypecheck\b|\btsc\b[^\n]*--noEmit|\beslint\b|\blint\b|\bpyright\b|\bmypy\b|\bruff\s+check\b|\bcheckstyle\b/i.test(command) && !isBuildCommand(command);
}

export function isTargetedTestCommand(command: string): boolean {
  return /\bnode\s+--test\b|\bvitest\b|\bjest\b|\bpytest\b|\bunittest\b|(?:npm|pnpm|yarn)\s+(?:run\s+)?test(?::[\w-]+)?\b|gradle(?:w)?[^\n]*\btest\b/i.test(command);
}

export function isIsolatedInteractionTestCommand(command: string): boolean {
  return /(?:npm|pnpm|yarn)\s+(?:run\s+)?test:interaction\b|\bplaywright\s+test\b/i.test(command);
}

function emitManaged(request: ManagedExecutionRequest, stage: ManagedExecutionUpdate["stage"], status: ManagedExecutionUpdate["status"], round: number, maximumRounds: number, message: string): void {
  request.emit({ type: "managed-execution", turnId: "managed", managedExecution: { mode: request.mode, stage, status, round, maximumRounds, message } });
}

function taskExecutionPrompt(message: string): string {
  return `[任务托管执行：源码任务阶段]\n${message}\n\n用户已经确认最近一份需求分析和修正方案。按该方案分析、修改源码并处理修改过程中的错误；必须产生可追踪的源码变更。本阶段禁止构建、启动或重启程序。完成源码修改后简要报告。`;
}

function conversationPrompt(message: string): string {
  return `[会话托管]\n${message}\n\n只负责理解并复述用户意图。禁止调查源码、执行命令、修改文件、提出已经执行的结果。若存在一个或多个仍需确认的含义，必须调用结构化 request_user_input：每个疑问单独成题并提供互斥选项；收到全部答案后，必须重新输出一份完整意图理解，不得只复述答案。只有没有剩余疑问时才等待用户点击“就是这意思”或单独回复 1。`;
}

function requirementPrompt(message: string): string {
  return `[需求托管]\n${message}\n\n上一阶段意图已经由用户确认。只负责只读调查原因、定位问题点并给出具体修正方案；禁止修改、新增、删除文件，禁止构建、启动或重启。完成后等待用户点击“按这个方案执行”或单独回复 1。`;
}

function taskRepairPrompt(failures: string[]): string {
  return `[任务托管执行：源码修复阶段]\n继续同一任务，修复上一轮修改过程中的错误：\n${failures.join("\n") || "存在未解决错误"}\n禁止构建、启动或重启。`;
}

function codeValidationPrompt(files: string[]): string {
  return `[任务托管执行：代码验证阶段]\n接手本任务已经修改的文件：\n${files.join("\n")}\n按“静态检查 → npm run test:interaction”执行代码级验证。test:interaction 会在后台启动隔离 Electron，通过 Playwright 定位器执行真实程序化交互，成功不截图，失败自动把截图和结果写入应用 temp 后关闭隔离实例。禁止正式构建、启动或重启当前 AI Desktop；若任一步失败，根据错误和截图修复源码后重新执行，两类检查最多共同复测 ${VALIDATION_ROUNDS} 轮。`;
}

function codeValidationRepairPrompt(missing: string[], failures: string[]): string {
  return `[任务托管执行：代码验证修复]\n继续同一任务并完成代码级验证。\n未满足：${missing.join("；")}\n失败命令：${failures.join("；") || "无"}\n读取 temp/interaction 中的失败截图和结果，修复后重新执行静态检查与 npm run test:interaction。最多复测 ${VALIDATION_ROUNDS} 轮；禁止正式构建、启动或重启当前 AI Desktop。`;
}

function buildValidationPrompt(message: string, restartRequired: boolean): string {
  return `[测试托管执行]\n${message}\n\n按“构建 → 构建后的针对性测试”执行；失败时修复并重新构建、复测。${restartRequired ? "完成后由桌面主进程受控重启一次，不要在命令中自行启动或重启 AI Desktop。" : "只有确有运行时验证需要时才说明重启要求。"}`;
}

function buildValidationRepairPrompt(missing: string[], failures: string[]): string {
  return `[测试托管执行：失败修复复测]\n继续同一测试任务。未满足：${missing.join("；")}。失败命令：${failures.join("；") || "无"}。修复后重新构建并执行构建后的针对性测试；不要自行重复启动 AI Desktop。`;
}
