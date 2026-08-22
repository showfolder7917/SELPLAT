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
  #unifiedDocumentValidation = 0;
  #roundFailures: string[] = [];

  get roundFailed(): boolean { return this.#roundFailures.length > 0; }

  beginRound(): void { this.#roundFailures = []; }

  record(event: CodexStreamEvent): void {
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
    if (isStaticCheckCommand(command)) this.#staticCheck = this.#sequence;
    if (isTargetedTestCommand(command)) this.#targetedTest = this.#sequence;
    if (isIsolatedInteractionTestCommand(command)) this.#isolatedInteractionTest = this.#sequence;
    if (isBuildCommand(command)) this.#build = this.#sequence;
    // 固定统一入口会在一个外层命令事件中按共享文档顺序执行构建和后续测试；
    // 只有该入口成功时，才允许构建与测试证据使用同一事件序号。
    if (isUnifiedTestDocumentCommand(command)) this.#unifiedDocumentValidation = this.#sequence;
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
  return /(?:^|\/)apps\/ai-desktop\/(?:测试文档\.md|\.测试文档\.lock\.json|测试文档归档\/|temp\/interaction\/)/.test(normalized)
    || /^(?:测试文档\.md|\.测试文档\.lock\.json|测试文档归档\/|temp\/interaction\/)/.test(normalized);
}

function commandSucceeded(activity: CodexStreamActivity): boolean {
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

function emitManaged(request: ManagedExecutionRequest, stage: ManagedExecutionUpdate["stage"], status: ManagedExecutionUpdate["status"], round: number, maximumRounds: number, message: string): void {
  request.emit({ type: "managed-execution", turnId: "managed", segmentId: `managed:${request.mode}:${stage}:${round}`, managedExecution: { mode: request.mode, stage, status, round, maximumRounds, message } });
}

function taskExecutionPrompt(message: string): string {
  return `[任务托管执行：源码任务阶段]\n${message}\n\n用户已经确认最近一份需求分析和修正方案。按该方案分析、修改源码并处理修改过程中的错误；必须产生可追踪的源码变更。本阶段禁止构建、启动或重启程序。把待验证命令登记到应用唯一共享的 apps/ai-desktop/测试文档.md，不得创建会话级测试文档。完成源码修改后简要报告。`;
}

function conversationPrompt(message: string): string {
  return `[会话托管]\n${message}\n\n只负责理解并复述用户意图。禁止调查源码、执行命令、修改文件、提出已经执行的结果。若仍有需要确认的含义，每次必须只选择一个最高优先级疑问并调用结构化 request_user_input，提供互斥选项；用户确认该点后必须重新理解完整会话，仍有歧义时再提出下一个结构化疑问。只有全部疑问消除后，才重新输出一份完整意图理解并等待用户点击“就是这意思”或单独回复 1，不得只复述最后一个答案。`;
}

function requirementPrompt(message: string): string {
  return `[需求托管]\n${message}\n\n上一阶段意图已经由用户确认。只负责只读调查原因、定位问题点并给出具体修正方案；禁止修改、新增、删除文件，禁止构建、启动或重启。完成后等待用户点击“按这个方案执行”或单独回复 1。`;
}

function taskRepairPrompt(failures: string[]): string {
  return `[任务托管执行：源码修复阶段]\n继续同一任务，修复上一轮修改过程中的错误：\n${failures.join("\n") || "存在未解决错误"}\n禁止构建、启动或重启。`;
}

function codeValidationPrompt(files: string[]): string {
  return `[任务托管执行：代码验证阶段]\n接手本任务已经修改的文件：\n${files.join("\n")}\n确认唯一共享测试文档 apps/ai-desktop/测试文档.md 已登记 npm run typecheck 与 npm run test:interaction，然后只通过固定命令 npm run test:document 取得独占锁并统一执行；命令不得追加 executor、task、thread 或其他动态参数。占用时必须报告锁中的执行者、任务、线程和当前项；完成后运行器会立即归档测试文档。test:interaction 会在后台启动隔离 Electron，通过 Playwright 定位器执行真实程序化交互。禁止正式构建、启动或重启当前 AI Desktop；失败时创建新一轮共享测试文档再修复复测，最多 ${VALIDATION_ROUNDS} 轮。`;
}

function codeValidationRepairPrompt(missing: string[], failures: string[]): string {
  return `[任务托管执行：代码验证修复]\n继续同一任务并完成代码级验证。\n未满足：${missing.join("；")}\n失败命令：${failures.join("；") || "无"}\n读取 temp/interaction 中的失败截图和结果，修复后重新执行静态检查与 npm run test:interaction。最多复测 ${VALIDATION_ROUNDS} 轮；禁止正式构建、启动或重启当前 AI Desktop。`;
}

function buildValidationPrompt(message: string, restartRequired: boolean): string {
  return `[测试托管执行]\n${message}\n\n把构建与构建后针对性测试登记到唯一共享的 apps/ai-desktop/测试文档.md，然后只通过固定命令 npm run test:document 取得独占锁并统一执行；命令不得追加 executor、task、thread 或其他动态参数。读取到占用锁时报告正在执行的人、任务、线程和当前项。每轮执行完成后测试文档必须立即归档；失败修复时创建新的共享测试文档再复测。${restartRequired ? "完成后由桌面主进程受控重启一次，不要在命令中自行启动或重启 AI Desktop。" : "只有确有运行时验证需要时才说明重启要求。"}`;
}

function buildValidationRepairPrompt(missing: string[], failures: string[]): string {
  return `[测试托管执行：失败修复复测]\n继续同一测试任务。未满足：${missing.join("；")}。失败命令：${failures.join("；") || "无"}。修复后重新构建并执行构建后的针对性测试；不要自行重复启动 AI Desktop。`;
}
