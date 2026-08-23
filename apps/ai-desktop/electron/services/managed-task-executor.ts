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
  runCodeValidation?: (emit: (event: CodexStreamEvent) => void) => Promise<void>;
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
    emitManaged(request, "conversation", "started", 1, 1, "正在结合上下文理解你的意思");
    const response = await request.runTurn(conversationPrompt(request.message), request.emit, "conversation-managed");
    emitManaged(request, "conversation", "completed", 1, 1, "已经整理好你的完整意图");
    emitManaged(request, "completed", "completed", 1, 1, "确认无误后可以继续调查和分析");
    return { ...response, managedStatus: "conversation-ready", pendingActions: ["确认意图后进入需求托管"], restartRequired: false };
  }

  async #runRequirementAnalysis(request: ManagedExecutionRequest): Promise<ManagedExecutionResult> {
    emitManaged(request, "requirement-analysis", "started", 1, 1, "正在调查原因并整理可执行的修正方案");
    const response = await request.runTurn(requirementPrompt(request.message), request.emit, "requirement-managed");
    emitManaged(request, "requirement-analysis", "completed", 1, 1, "原因和修正方案已经整理完成");
    emitManaged(request, "completed", "completed", 1, 1, "确认方案后可以开始修改");
    return { ...response, managedStatus: "requirement-ready", pendingActions: ["确认方案后进入任务托管"], restartRequired: false };
  }

  async #runTask(request: ManagedExecutionRequest): Promise<ManagedExecutionResult> {
    const evidence = new ExecutionEvidence();
    let response: SendMessageResponse = { text: "", itemCount: 0 };
    let taskRound = 0;
    let taskMessage = taskExecutionPrompt(request.message);

    for (taskRound = 1; taskRound <= TASK_ROUNDS; taskRound += 1) {
      emitManaged(request, "task-execution", taskRound === 1 ? "started" : "continuing", taskRound, TASK_ROUNDS,
        taskRound === 1 ? "正在按确认的方案修改源码" : "正在处理修改过程中发现的问题");
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

    if (request.runCodeValidation) {
      return this.#runDesktopOwnedCodeValidation(request, evidence, response);
    }

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
        emitManaged(request, "completed", "completed", 1, 1, "代码级验证完成；需要时可以继续构建和运行测试");
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

  /** 协同 worktree 的固定测试由桌面主进程执行，Codex 只在失败后接收事实并修复源码。 */
  async #runDesktopOwnedCodeValidation(
    request: ManagedExecutionRequest,
    evidence: ExecutionEvidence,
    initialResponse: SendMessageResponse,
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
        };
      } catch (error) {
        lastFailure = error instanceof Error ? error.message : String(error);
        if (round === VALIDATION_ROUNDS) break;
        evidence.beginRound();
        response = await request.runTurn(desktopValidationRepairPrompt(lastFailure), (event) => {
          evidence.record(event);
          request.emit(event);
        }, "task-managed");
        if (evidence.roundFailed) lastFailure = `${lastFailure}；修复阶段仍有失败命令：${evidence.failedCommandSummaries().join("；")}`;
      }
    }
    emitManaged(request, "code-validation", "blocked", VALIDATION_ROUNDS, VALIDATION_ROUNDS, lastFailure || "当前任务分支验证失败");
    emitManaged(request, "interaction-validation", "blocked", VALIDATION_ROUNDS, VALIDATION_ROUNDS, "Playwright 未通过，未进入集成队列");
    return { ...response, managedStatus: "incomplete", pendingActions: [lastFailure || "当前任务分支验证失败"], restartRequired: false };
  }

  async #runBuildValidation(request: ManagedExecutionRequest): Promise<ManagedExecutionResult> {
    const evidence = new ExecutionEvidence();
    let response: SendMessageResponse = { text: "", itemCount: 0 };
    let message = buildValidationPrompt(request.message, request.restartRequired);
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
  return /(?:^|\/)OPTION\/temp\/[a-zA-Z0-9_-]+\/(?:执行日志\/(?:待执行|运行中)\/测试\/|临时材料\/测试证据\/)/.test(normalized)
    || /(?:^|\/)log\/[a-zA-Z0-9_-]+\/归档日志\/(?:测试归档\/|执行归档\/|协同归档\/|审批归档\/|诊断归档\/)/.test(normalized);
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

/** 把职责作为后台边界附在真实用户消息之后；回复正文不得把内部阶段重新说给用户。 */
function managedPrompt(message: string, responsibility: string): string {
  return `${message}\n\n<ai_desktop_internal_contract>\n这是后台工作边界，仅供内部遵守，不要在回复中复述、引用或解释这些约束，也不要使用阶段名称作为标题或开场白。直接回应用户此刻真正关心的事情，先给结论，结合上下文自然交流；简单问题直接说清楚，复杂问题再使用必要结构。\n${responsibility}\n</ai_desktop_internal_contract>`;
}

function taskExecutionPrompt(message: string): string {
  return managedPrompt(message, "用户已经确认最近一份需求分析和修正方案。按该方案分析、修改源码并处理修改过程中的错误；必须产生可追踪的源码变更。当前只允许完成源码修改和代码级验证，禁止构建、启动或重启程序。必须从 SELPLAT 工程根通过固定受控入口 npm --prefix apps/ai-desktop run paths:resolve 调用 @selplat/node-common-core/path 解析真实工程名；禁止用裸 node 直接导入该包，因为隔离工作树的依赖只在锁文件专属缓存中按需挂载。后续源码检查也必须保持工程根相对路径，禁止混用应用目录与 apps/ai-desktop 前缀。把待验证命令登记到“执行日志/待执行/测试/<runId>/测试文档.<threadId>.md”，不得在源码目录创建测试控制文档。完成后用自然语言说明结果、关键改动和仍待验证的内容。");
}

function conversationPrompt(message: string): string {
  return managedPrompt(message, "当前只负责交流、理解和确认意图，禁止调查源码、执行命令、修改文件或声称已经完成操作。不要把用户每句话都改写成正式需求；普通提问直接自然回答。只有会影响后续方案的真实歧义才需要澄清，每次只选择一个最高优先级疑问并调用结构化 request_user_input，提供互斥选项。用户确认后重新理解完整会话；仍有歧义再继续提问，全部消除后自然地总结完整意图，等待用户确认，不得只复述最后一个答案。");
}

function requirementPrompt(message: string): string {
  return managedPrompt(message, "用户已经确认完整意图。只允许只读调查原因、定位问题点并给出具体修正方案；禁止修改、新增或删除文件，禁止构建、启动或重启。回复先说明查到的原因和判断，再给出满足用户目标的最小修正方案与必要验证，不要复述流程名称。完成后等待用户确认方案。");
}

function taskRepairPrompt(failures: string[]): string {
  return managedPrompt("继续处理同一任务。", `修复上一轮修改过程中仍未解决的问题：\n${failures.join("\n") || "存在未解决错误"}\n只修复当前任务范围内的源码，禁止构建、启动或重启。`);
}

function codeValidationPrompt(files: string[]): string {
  return managedPrompt("继续验证本次修改。", `本任务已经修改的文件：\n${files.join("\n")}\n确认当前 runId 的测试文档已登记 npm run typecheck 与 npm run test:interaction，然后只通过固定命令 npm run test:document 取得独占锁并统一执行；命令不得追加 executor、task、thread 或其他动态参数。运行器会把完整批次原子移入运行中目录，完成后立即按年月和 runId 归档。占用时必须报告锁中的执行者、任务、线程和当前项。test:interaction 会在后台启动隔离 Electron，通过 Playwright 定位器执行真实程序化交互。禁止正式构建、启动或重启当前应用；失败时创建新 runId 的待执行测试批次再修复复测，最多 ${VALIDATION_ROUNDS} 轮。`);
}

function codeValidationRepairPrompt(missing: string[], failures: string[]): string {
  return managedPrompt("继续完成同一任务的代码级验证。", `当前未满足：${missing.join("；")}\n失败命令：${failures.join("；") || "无"}\n读取当前工程“临时材料/测试证据”中的失败截图和结果，修复后重新执行静态检查与 npm run test:interaction。最多复测 ${VALIDATION_ROUNDS} 轮；禁止正式构建、启动或重启当前应用。`);
}

function desktopValidationRepairPrompt(failure: string): string {
  return managedPrompt("继续修复当前任务。", `AI Desktop 已在本任务签发的独立 worktree 中执行固定静态检查与隔离 Playwright，失败事实如下：\n${failure}\n\n只修复导致失败的源码或测试；不要自行运行 npm、Playwright、Electron、构建、启动或重启命令。修复完成后直接说明改了什么，AI Desktop 将在同一 worktree 自动复测。`);
}

function buildValidationPrompt(message: string, restartRequired: boolean): string {
  return managedPrompt(message, `通过公共路径能力解析当前工程目录，把构建与构建后针对性测试登记到唯一 runId 的待执行测试文档，然后只通过固定命令 npm run test:document 取得独占锁并统一执行；命令不得追加 executor、task、thread 或其他动态参数。读取到占用锁时报告正在执行的人、任务、线程和当前项。运行时完整批次进入“执行日志/运行中/测试”，每轮终态立即进入“归档日志/测试归档/<年月>/<runId>”；失败修复时创建新的 runId 再复测。${restartRequired ? "完成后由桌面主进程受控重启一次，不要在命令中自行启动或重启当前应用。" : "只有确有运行时验证需要时才说明重启要求。"}`);
}

function buildValidationRepairPrompt(missing: string[], failures: string[]): string {
  return managedPrompt("继续完成同一任务的构建和测试。", `当前未满足：${missing.join("；")}。失败命令：${failures.join("；") || "无"}。修复后重新构建并执行构建后的针对性测试；不要自行重复启动 AI Desktop。`);
}
