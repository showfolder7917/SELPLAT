import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";

import type {
  CodexAccount,
  CodexApproval,
  CodexHarnessStatus,
  CodexModelCatalog,
  CodexModelOption,
  CodexLoginResponse,
  CodexStreamEvent,
  CodexUserInputRequest,
  ResolveCodexUserInputRequest,
} from "../../../../contracts/platform/codex/index.js";
import type { Locale, ManagedExecutionMode, ModelServiceTier, ReasoningEffort, SandboxMode } from "../../../../contracts/foundation/base.js";
import type { SendMessageResponse } from "../../../../contracts/capabilities/conversation/index.js";
import type { DesktopSettings } from "../../../../contracts/platform/settings/index.js";
import type { WorkspaceState } from "../../../../contracts/platform/workspace/index.js";
import type { CodexSessionPersistence } from "./internal/codex-session.repository.js";
import { resolveCodexRuntime, type CodexRuntime } from "./internal/codex-runtime.resolver.js";
import { toCodexStreamEvent } from "./internal/codex-stream-event.mapper.js";
import { CommandGovernanceFacade as TrustedCommandStore } from "../security/index.js";

type JsonObject = Record<string, unknown>;

interface RpcMessage {
  id?: number;
  method?: string;
  params?: JsonObject;
  result?: unknown;
  error?: { message?: string };
}

interface PendingRequest {
  resolve(value: unknown): void;
  reject(error: Error): void;
}

interface TurnWaiter {
  itemCount: number;
  messageParts: Map<string, string>;
  emit(event: CodexStreamEvent): void;
  resolve(value: SendMessageResponse): void;
  reject(error: Error): void;
}

interface BufferedNotification {
  method: string;
  params: JsonObject;
}

export interface CodexServiceOptions {
  codexHome: string | null;
  serviceName: string;
  threadSource: string;
  migrateLegacySession: boolean;
  sessionStorage: "ai-desktop" | "legacy-default";
  validationOwner: "codex" | "desktop";
  readSettings: () => DesktopSettings;
  /** 读取主进程已校验的有效规则；返回空串时仅应用基础会话指令。 */
  readRuleInstructions?: () => string;
  /** 主人物回合完成后触发训练语料增量归档；内部自动化连接不配置此回调。 */
  onConversationTurnCompleted?: () => void | Promise<void>;
  /** 协作工作树由主进程签发的依赖租约；只携带标识，缓存根由子命令从 Git 公共仓库独立验证。 */
  dependencyLeaseId?: string;
  /** 固定人物会话允许工作区清单动态变化；仍恢复同一线程并用本轮最新工作区执行。 */
  preserveThreadAcrossWorkspaceChanges?: boolean;
}

const EMPTY_ACCOUNT: CodexAccount = {
  authenticated: false,
  authMode: null,
  email: null,
  planType: null,
  requiresOpenaiAuth: true,
};

/** 通过官方 openai/codex app-server 驱动桌面端，认证令牌和执行审批始终留在主进程。 */
export class CodexService {
  readonly #workingDirectory: string;
  readonly #pending = new Map<number, PendingRequest>();
  readonly #approvals = new Map<number, CodexApproval>();
  readonly #userInputs = new Map<number, CodexUserInputRequest>();
  readonly #turnWaiters = new Map<string, TurnWaiter>();
  readonly #notificationBacklog = new Map<string, BufferedNotification[]>();
  readonly #items = new Map<string, JsonObject>();
  #process: ChildProcessWithoutNullStreams | undefined;
  #ready: Promise<void> | undefined;
  #requestId = 0;
  #threadId: string | undefined;
  #threadWorkspaceSignature: string | undefined;
  #threadAttached = false;
  #activeTurnId: string | undefined;
  #lastError: string | null = null;
  #runtime: CodexRuntime | null = null;
  #storageReady: Promise<void> | undefined;
  #activeExecutionMode: ManagedExecutionMode | null = null;
  #activeWorkspaces: WorkspaceState | null = null;
  readonly #trustedCommands: TrustedCommandStore;
  readonly #sessions: CodexSessionPersistence;
  readonly #options: CodexServiceOptions;
  readonly #onTrustedCommandDecision: (details: Record<string, unknown>) => void;
  readonly #onThreadLifecycle: (details: Record<string, unknown>) => void;

  constructor(
    workingDirectory: string,
    trustedCommands: TrustedCommandStore,
    sessions: CodexSessionPersistence,
    options: CodexServiceOptions,
    onTrustedCommandDecision: (details: Record<string, unknown>) => void = () => undefined,
    onThreadLifecycle: (details: Record<string, unknown>) => void = () => undefined,
  ) {
    this.#workingDirectory = workingDirectory;
    this.#trustedCommands = trustedCommands;
    this.#sessions = sessions;
    this.#options = options;
    this.#onTrustedCommandDecision = onTrustedCommandDecision;
    this.#onThreadLifecycle = onThreadLifecycle;
  }

  async newChat(): Promise<void> {
    await this.#ensureStorageReady();
    await this.cancel();
    const stored = this.#readStoredSession();
    const threadId = this.#threadId || stored?.threadId;
    if (threadId) {
      try {
        await this.#ensureReady();
        await this.#request("thread/delete", { threadId });
        this.#onThreadLifecycle({ action: "deleted", threadId, reason: "user_new_chat" });
      } catch (error) {
        this.#onThreadLifecycle({ action: "delete_failed", threadId, reason: errorMessage(error) });
        // 官方硬删除未确认成功时保留本地恢复凭据，避免界面清空但任务仍留在官方存储。
        throw new Error(`无法丢弃当前 Codex 任务：${errorMessage(error)}`);
      }
    }
    this.#forgetThread();
  }

  activeSession(): { threadId: string | null } {
    // 迁移完成前仍回显旧线程 ID，确保用户可以看到并明确处理待迁移的活动任务。
    return { threadId: this.#threadId || this.#sessions.read()?.threadId || null };
  }

  /** 只报告本地 app-server 子进程是否仍存活，不发起账号或网络请求。 */
  isAlive(): boolean {
    return Boolean(this.#process && this.#process.exitCode === null && !this.#process.killed);
  }

  async getStatus(): Promise<CodexHarnessStatus> {
    try {
      await this.#ensureReady();
      const result = asObject(await this.#request("account/read", { refreshToken: false }));
      return { connected: true, account: normalizeAccount(result), error: null, runtime: runtimeInfo(this.#runtime) };
    } catch (error) {
      this.#lastError = errorMessage(error);
      return { connected: false, account: { ...EMPTY_ACCOUNT }, error: this.#lastError, runtime: runtimeInfo(this.#runtime) };
    }
  }

  /** 模型和能力始终来自当前固定 app-server，避免前端维护会过期的提供商或模型常量。 */
  async getModels(): Promise<CodexModelCatalog> {
    await this.#ensureReady();
    const result = asObject(await this.#request("model/list", { includeHidden: false }));
    const source = Array.isArray(result.data) ? result.data : Array.isArray(result.models) ? result.models : [];
    return { models: source.map(normalizeModelOption).filter((model): model is CodexModelOption => Boolean(model)) };
  }

  async loginWithChatGPT(): Promise<CodexLoginResponse> {
    await this.#ensureReady();
    const result = asObject(await this.#request("account/login/start", {
      type: "chatgpt",
      useHostedLoginSuccessPage: true,
      appBrand: "codex",
    }));
    const loginId = stringValue(result.loginId);
    const authUrl = stringValue(result.authUrl);
    if (!loginId || !authUrl || !isTrustedLoginUrl(authUrl)) {
      throw new Error("Codex harness returned an invalid ChatGPT login URL.");
    }
    return { loginId, authUrl };
  }

  async logout(): Promise<CodexHarnessStatus> {
    await this.#ensureReady();
    await this.#request("account/logout", {});
    await this.newChat();
    return this.getStatus();
  }

  pendingApprovals(): CodexApproval[] {
    return [...this.#approvals.values()];
  }

  resolveApproval(requestId: number, decision: "accept" | "decline", trustProjectCommand = false): { trusted: boolean; projectRoot: string | null } {
    const approval = this.#approvals.get(requestId);
    if (!Number.isSafeInteger(requestId) || !approval) {
      throw new Error("Codex approval request is no longer active.");
    }
    const trustResult = decision === "accept" && trustProjectCommand && approval.kind === "command" && approval.command
      ? this.#trustedCommands.trust(approval.command, approval.cwd, this.#activeWorkspaces)
      : { trusted: false, projectRoot: null };
    this.#approvals.delete(requestId);
    this.#respond(requestId, { decision });
    if (trustResult.trusted) {
      this.#onTrustedCommandDecision({ action: "trusted", requestId, command: approval.command, cwd: approval.cwd, projectRoot: trustResult.projectRoot });
    }
    return trustResult;
  }

  pendingUserInputs(): CodexUserInputRequest[] {
    return [...this.#userInputs.values()];
  }

  resolveUserInput(request: ResolveCodexUserInputRequest): void {
    if (!request || !Number.isSafeInteger(request.requestId)) throw new Error("Invalid Codex user input request.");
    const pending = this.#userInputs.get(request.requestId);
    if (!pending) throw new Error("Codex user input request is no longer active.");
    const answers: Record<string, { answers: string[] }> = {};
    for (const question of pending.questions) {
      const values = request.answers?.[question.id];
      if (!Array.isArray(values) || values.length !== 1 || typeof values[0] !== "string" || !values[0].trim()) {
        throw new Error(`An answer is required for ${question.id}.`);
      }
      answers[question.id] = { answers: [values[0].trim().slice(0, 2_000)] };
    }
    this.#userInputs.delete(request.requestId);
    this.#respond(request.requestId, { answers });
  }

  async cancel(): Promise<boolean> {
    this.#clearUserInputs();
    if (!this.#threadId || !this.#activeTurnId) return false;
    await this.#request("turn/interrupt", { threadId: this.#threadId, turnId: this.#activeTurnId });
    return true;
  }

  /** 把用户明确选择的排队消息注入当前官方回合；没有活动回合时拒绝，绝不退化成第二个 turn/start。 */
  async steer(message: string, attachmentPaths: string[] = []): Promise<void> {
    const normalizedMessage = message.trim();
    if ((!normalizedMessage && attachmentPaths.length === 0) || normalizedMessage.length > 20_000) {
      throw new Error("补充内容或截图不能为空，文字最多 20000 个字符。");
    }
    await this.#ensureReady();
    if (!this.#threadId || !this.#activeTurnId) throw new Error("当前没有可接收补充的 Codex 回合。");
    const input: JsonObject[] = normalizedMessage ? [{ type: "text", text: normalizedMessage }] : [];
    input.push(...attachmentPaths.map((filePath) => ({ type: "localImage", path: filePath })));
    await this.#request("turn/steer", {
      threadId: this.#threadId,
      expectedTurnId: this.#activeTurnId,
      input,
    });
  }

  async send(
    message: string,
    locale: Locale,
    sandboxMode: SandboxMode,
    workspaces: WorkspaceState,
    attachmentPaths: string[] = [],
    onStreamEvent: (event: CodexStreamEvent) => void = () => undefined,
    executionMode: ManagedExecutionMode | null = null,
  ): Promise<SendMessageResponse> {
    const normalizedMessage = message.trim();
    if ((!normalizedMessage && attachmentPaths.length === 0) || normalizedMessage.length > 20_000) {
      throw new Error("Message or screenshot attachment is required, with at most 20000 text characters.");
    }

    await this.#ensureReady();
    await this.cancel();
    const primaryRoot = workspaces.roots.find((root) => root.id === workspaces.primaryId) || workspaces.roots[0];
    if (!primaryRoot) throw new Error("At least one registered workspace is required.");
    const threadId = await this.#getThread(sandboxMode, workspaces, primaryRoot.path, locale);
    const userTask = normalizedMessage || (locale === "ja" ? "添付画像を確認してください。" : "请阅读并分析附加截图。");
    const input: JsonObject[] = [{
      type: "text",
      // 真实任务放在第一段；工作区仍是同一条用户输入的授权上下文，但不再抢占官方线程标题。
      text: `${userTask}\n\n${workspaceContext(workspaces)}`,
    }];
    // 官方 app-server 0.149.0 的 turn/start 使用 localImage 路径读取本地主进程已校验的 PNG。
    input.push(...attachmentPaths.map((filePath) => ({ type: "localImage", path: filePath })));
    this.#activeExecutionMode = executionMode;
    this.#activeWorkspaces = workspaces;
    try {
      // 每轮读取最新全局值，让持久会话与临时协同连接同时生效且没有会话级覆盖分支。
      const modelSettings = this.#options.readSettings();
      await this.#assertModelSettingsSupported(modelSettings);
      const result = asObject(await this.#request("turn/start", {
        threadId,
        cwd: primaryRoot.path,
        approvalPolicy: "on-request",
        approvalsReviewer: "user",
        sandboxPolicy: createSandboxPolicy(sandboxMode, workspaces),
        ...(modelSettings.defaultModel ? { model: modelSettings.defaultModel } : {}),
        ...(modelSettings.reasoningEffort ? { effort: modelSettings.reasoningEffort } : {}),
        serviceTier: modelSettings.serviceTier,
        input,
      }));
      const turnId = stringValue(asObject(result.turn).id);
      if (!turnId) throw new Error("Codex harness did not return a turn id.");
      this.#activeTurnId = turnId;
      const response = { ...await this.#waitForTurn(turnId, onStreamEvent), threadId };
      // 官方 rollout 已落盘后再推进检查点；失败由持久源和未更新水位留待下次启动重试。
      await this.#options.onConversationTurnCompleted?.();
      return response;
    } finally {
      this.#activeExecutionMode = null;
      this.#activeWorkspaces = null;
    }
  }

  /**
   * app-server 已明确列出模型能力时，禁止把不支持的全局选择静默降级为默认值。
   * 这同时覆盖主会话、协同执行和协同审核，因为三者共用 send 调用路径。
   */
  async #assertModelSettingsSupported(settings: DesktopSettings): Promise<void> {
    if (!settings.defaultModel && !settings.reasoningEffort && settings.serviceTier === "default") return;
    const catalog = await this.getModels();
    const model = settings.defaultModel
      ? catalog.models.find((entry) => entry.id === settings.defaultModel)
      : catalog.models.find((entry) => entry.isDefault);
    if (!model) {
      if (settings.defaultModel) throw new Error(`全局默认模型“${settings.defaultModel}”当前不可用，请在设置中重新选择。`);
      return;
    }
    if (settings.reasoningEffort && model.supportedReasoningEfforts.length > 0 && !model.supportedReasoningEfforts.includes(settings.reasoningEffort)) {
      throw new Error(`模型“${model.displayName}”不支持推理强度“${settings.reasoningEffort}”，请在设置中重新选择。`);
    }
    if (settings.serviceTier !== "default" && !model.supportedServiceTiers.includes(settings.serviceTier)) {
      throw new Error(`模型“${model.displayName}”不支持快速处理，请在设置中切换为标准速度或选择支持该速度的模型。`);
    }
  }

  dispose(): void {
    this.#clearUserInputs();
    this.#process?.kill();
    this.#process = undefined;
    this.#ready = undefined;
  }

  async #getThread(sandboxMode: SandboxMode, workspaces: WorkspaceState, cwd: string, locale: Locale): Promise<string> {
    const developerInstructions = this.#developerInstructions(locale);
    const workspaceSignature = JSON.stringify({ workspaces, developerInstructions });
    if (this.#threadId && this.#threadWorkspaceSignature === workspaceSignature && this.#threadAttached) return this.#threadId;

    const stored = this.#readStoredSession();
    const preservePersonaThread = this.#options.preserveThreadAcrossWorkspaceChanges === true;
    const resumableThreadId = this.#threadId && (preservePersonaThread || this.#threadWorkspaceSignature === workspaceSignature)
      ? this.#threadId
      : stored && (preservePersonaThread || stored.workspaceSignature === workspaceSignature) ? stored.threadId : null;
    if (resumableThreadId) {
      try {
        const resumed = asObject(await this.#request("thread/resume", { threadId: resumableThreadId }));
        const threadId = stringValue(asObject(resumed.thread).id) || resumableThreadId;
        this.#rememberThread(threadId, workspaceSignature);
        this.#onThreadLifecycle({ action: "resumed", threadId });
        return threadId;
      } catch (error) {
        // 恢复失败可能只是临时连接故障；保留凭据并让用户重试，禁止静默删除仍可恢复的任务。
        this.#onThreadLifecycle({ action: "resume_failed", threadId: resumableThreadId, reason: errorMessage(error) });
        throw new Error(`无法恢复当前 Codex 任务：${errorMessage(error)}`);
      }
    }

    const previousThreadId = this.#threadId || stored?.threadId;
    if (previousThreadId) {
      try {
        await this.#request("thread/delete", { threadId: previousThreadId });
        this.#onThreadLifecycle({ action: "deleted", threadId: previousThreadId, reason: "workspace_signature_changed" });
      } catch (error) {
        this.#onThreadLifecycle({ action: "delete_failed", threadId: previousThreadId, reason: errorMessage(error) });
        throw new Error(`工作区已变化，但无法丢弃旧 Codex 任务：${errorMessage(error)}`);
      }
      this.#forgetThread();
    }
    const result = asObject(await this.#request("thread/start", {
      cwd,
      approvalPolicy: "on-request",
      // 桌面 UI 必须由当前用户审查审批；不能继承全局 auto_review 后静默代审。
      approvalsReviewer: "user",
      sandbox: sandboxMode,
      // 当前活动线程需要跨 Electron 重建恢复；用户点击新建任务时再通过 thread/delete 明确丢弃。
      ephemeral: false,
      // 这两个字段只用于官方事件审计；会话隔离由专属 CODEX_HOME 保证。
      serviceName: this.#options.serviceName,
      threadSource: this.#options.threadSource,
      // 风格与语言属于客户端开发约束，不混入用户正文或污染任务标题。
      developerInstructions,
    }));
    const threadId = stringValue(asObject(result.thread).id);
    if (!threadId) throw new Error("Codex harness did not return a thread id.");
    this.#rememberThread(threadId, workspaceSignature);
    this.#onThreadLifecycle({ action: "started", threadId });
    return threadId;
  }

  #rememberThread(threadId: string, workspaceSignature: string): void {
    this.#threadId = threadId;
    this.#threadWorkspaceSignature = workspaceSignature;
    this.#threadAttached = true;
    this.#sessions.write(threadId, workspaceSignature);
  }

  #forgetThread(): void {
    this.#threadId = undefined;
    this.#threadWorkspaceSignature = undefined;
    this.#threadAttached = false;
    this.#sessions.clear();
  }

  #ensureReady(): Promise<void> {
    if (!this.#ready) {
      this.#ready = this.#ensureStorageReady()
        .then(() => this.#start())
        .catch((error) => {
          this.#ready = undefined;
          throw error;
        });
    }
    return this.#ready;
  }

  #ensureStorageReady(): Promise<void> {
    if (!this.#storageReady) {
      this.#storageReady = this.#migrateLegacySession().catch((error) => {
        this.#storageReady = undefined;
        throw error;
      });
    }
    return this.#storageReady;
  }

  /** 仅删除当前会话文件保存的旧线程；不枚举默认 Codex 数据域，也不触碰用户的其他会话。 */
  async #migrateLegacySession(): Promise<void> {
    const stored = this.#sessions.read();
    if (!this.#options.migrateLegacySession || !stored || stored.version !== 1) return;
    const legacyService = new CodexService(
      this.#workingDirectory,
      this.#trustedCommands,
      this.#sessions,
      {
        codexHome: null,
        serviceName: `${this.#options.serviceName}_legacy_migration`,
        threadSource: this.#options.threadSource,
        migrateLegacySession: false,
        sessionStorage: "legacy-default",
        validationOwner: this.#options.validationOwner,
        readSettings: this.#options.readSettings,
      },
      this.#onTrustedCommandDecision,
      this.#onThreadLifecycle,
    );
    try {
      await legacyService.#deleteStoredThread("storage_domain_migration");
    } finally {
      legacyService.dispose();
    }
  }

  async #deleteStoredThread(reason: string): Promise<void> {
    const stored = this.#readStoredSession();
    if (!stored) return;
    try {
      await this.#ensureReady();
      await this.#request("thread/delete", { threadId: stored.threadId });
      this.#onThreadLifecycle({ action: "deleted", threadId: stored.threadId, reason });
      this.#forgetThread();
    } catch (error) {
      this.#onThreadLifecycle({ action: "delete_failed", threadId: stored.threadId, reason: errorMessage(error) });
      // 删除未确认时必须保留旧恢复凭据，禁止在专属数据域中覆盖后失去精确清理目标。
      throw new Error(`无法迁移旧 Codex 任务：${errorMessage(error)}`);
    }
  }

  #readStoredSession() {
    const stored = this.#sessions.read();
    if (!stored) return null;
    if (this.#options.sessionStorage === "legacy-default") return stored.version === 1 ? stored : null;
    return stored.version === 2 && stored.storageDomain === "ai-desktop" ? stored : null;
  }

  async #start(): Promise<void> {
    // 运行时探测与 app-server 使用完全相同的数据域，避免读取另一个 App 的模型缓存和认证状态。
    const childEnvironment = createCodexChildEnvironment(process.env, this.#options.codexHome, this.#options.dependencyLeaseId);
    const runtime = await resolveCodexRuntime(childEnvironment);
    this.#runtime = runtime;
    this.#onThreadLifecycle({ action: "harness_runtime_selected", source: runtime.source, version: runtime.version });
    if (runtime.electronRunAsNode) childEnvironment.ELECTRON_RUN_AS_NODE = "1";
    else delete childEnvironment.ELECTRON_RUN_AS_NODE;
    const child = spawn(runtime.command, [...runtime.argsPrefix, "app-server", "--stdio", "--enable", "default_mode_request_user_input"], {
      cwd: this.#workingDirectory,
      env: childEnvironment,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      shell: process.platform === "win32" && /\.(cmd|bat)$/i.test(runtime.command),
    });
    this.#process = child;
    createInterface({ input: child.stdout }).on("line", (line) => this.#handleLine(line));
    child.stderr.on("data", (chunk: Buffer) => {
      const message = chunk.toString("utf8").trim();
      if (message) this.#lastError = message.slice(-2_000);
    });
    child.once("exit", (code, signal) => this.#handleExit(code, signal));
    child.once("error", (error) => this.#handleExit(null, error.message));

    await this.#request("initialize", {
      clientInfo: {
        name: "selplat_ai_desktop",
        title: "SELPLAT AI Desktop",
        version: "0.1.0",
      },
      // 会话托管在默认协作模式中使用官方结构化提问，客户端必须显式接收实验性请求协议。
      capabilities: { experimentalApi: true },
    });
    this.#notify("initialized", {});
  }

  #request(method: string, params: JsonObject): Promise<unknown> {
    const child = this.#process;
    if (!child || child.stdin.destroyed) return Promise.reject(new Error("Codex harness is not running."));
    const id = ++this.#requestId;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      child.stdin.write(`${JSON.stringify({ method, id, params })}\n`, (error) => {
        if (!error) return;
        this.#pending.delete(id);
        reject(error);
      });
    });
  }

  #notify(method: string, params: JsonObject): void {
    this.#write({ method, params });
  }

  #respond(id: number, result: JsonObject): void {
    this.#write({ id, result });
  }

  #write(message: JsonObject): void {
    const child = this.#process;
    if (!child || child.stdin.destroyed) return;
    child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  #handleLine(line: string): void {
    let message: RpcMessage;
    try {
      message = JSON.parse(line) as RpcMessage;
    } catch {
      return;
    }
    if (typeof message.id === "number" && message.method) {
      this.#handleServerRequest(message.id, message.method, message.params || {});
      return;
    }
    if (typeof message.id === "number") {
      const pending = this.#pending.get(message.id);
      if (!pending) return;
      this.#pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message || "Codex harness request failed."));
      else pending.resolve(message.result);
      return;
    }
    if (message.method && message.params) this.#handleNotification(message.method, message.params);
  }

  #handleServerRequest(id: number, method: string, params: JsonObject): void {
    if (method === "mcpServer/elicitation/request") {
      this.#respond(id, { action: "cancel", content: null });
      return;
    }
    if (method === "item/permissions/requestApproval") {
      this.#respond(id, { scope: "turn", permissions: {} });
      return;
    }
    if (method === "item/tool/requestUserInput") {
      const request = normalizeUserInputRequest(id, params);
      if (!request) {
        this.#respond(id, { answers: {} });
        return;
      }
      // 官方请求保持悬而未决，直到渲染层通过白名单 IPC 提交答案；禁止用空答案跳过真实疑问。
      this.#userInputs.set(id, request);
      return;
    }
    if (method !== "item/commandExecution/requestApproval" && method !== "item/fileChange/requestApproval") {
      // 未声明支持的动态工具请求返回空结果，不把未知能力误当成执行授权。
      this.#respond(id, {});
      return;
    }
    const itemId = stringValue(params.itemId) || "";
    const item = this.#items.get(itemId) || {};
    const isCommand = method === "item/commandExecution/requestApproval";
    const command = displayValue(params.command || item.command);
    const cwd = stringValue(params.cwd || item.cwd);
    const analysisOnly = this.#activeExecutionMode === "conversation-managed" || this.#activeExecutionMode === "requirement-managed";
    if (analysisOnly) {
      this.#respond(id, { decision: "decline" });
      this.#emitCommandPolicy(id, command || displayValue(item.changes), "会话托管和需求托管只允许只读分析，不能申请命令提权或修改文件。");
      return;
    }
    if (isCommand && this.#activeExecutionMode === "task-managed" && command && isManagedBuildOrStartCommand(command)) {
      this.#respond(id, { decision: "decline" });
      this.#emitCommandPolicy(id, command, "任务托管只允许代码级验证；构建、启动和重启需单独使用测试托管执行。");
      return;
    }
    if (isCommand && this.#activeExecutionMode === "task-managed" && this.#options.validationOwner === "desktop"
      && command && isDesktopOwnedValidationCommand(command)) {
      this.#respond(id, { decision: "decline" });
      this.#emitCommandPolicy(id, command, "当前协同任务的固定测试由 AI Desktop 在签发 worktree 内执行，无需 Agent 申请 Playwright 权限。", "completed");
      return;
    }
    if (isCommand && command) {
      const trusted = this.#trustedCommands.isTrusted(command, cwd, this.#activeWorkspaces);
      if (trusted.trusted) {
        this.#respond(id, { decision: "accept" });
        this.#onTrustedCommandDecision({ action: "auto-approved", requestId: id, command, cwd, projectRoot: trusted.projectRoot });
        this.#emitCommandPolicy(id, command, "已按当前项目登记的可信命令自动允许。", "completed");
        return;
      }
    }
    this.#approvals.set(id, {
      requestId: id,
      kind: isCommand ? "command" : "fileChange",
      title: isCommand ? "Codex requests command execution" : "Codex requests file changes",
      reason: stringValue(params.reason),
      command,
      cwd,
      details: isCommand ? displayValue(params.commandActions) : displayValue(item.changes),
      trustEligible: isCommand && this.#trustedCommands.canTrust(command, cwd, this.#activeWorkspaces),
    });
  }

  #emitCommandPolicy(id: number, detail: string | null, summary: string, status = "blocked"): void {
    const turnId = this.#activeTurnId;
    const waiter = turnId ? this.#turnWaiters.get(turnId) : undefined;
    waiter?.emit({
      type: "activity",
      turnId: turnId || "managed",
      activity: { id: `policy-${id}`, itemType: "commandPolicy", phase: "completed", status, summary, detail },
    });
  }

  #handleNotification(method: string, params: JsonObject): void {
    const turnId = stringValue(params.turnId) || stringValue(asObject(params.turn).id);
    if (method === "item/started") {
      const item = asObject(params.item);
      const itemId = stringValue(item.id);
      if (itemId) this.#items.set(itemId, item);
    }
    if (!turnId) return;
    const waiter = this.#turnWaiters.get(turnId);
    if (!waiter) {
      // turn/start 的响应可能晚于首批通知；先按 turnId 有界缓存，绑定等待器后再按原顺序重放。
      const backlog = this.#notificationBacklog.get(turnId) || [];
      if (backlog.length < 2_000) backlog.push({ method, params });
      this.#notificationBacklog.set(turnId, backlog);
      return;
    }
    this.#processTurnNotification(turnId, method, params, waiter);
  }

  #processTurnNotification(turnId: string, method: string, params: JsonObject, waiter: TurnWaiter): void {
    const streamEvent = toCodexStreamEvent(method, params, turnId);
    if (streamEvent) waiter.emit(streamEvent);
    if (method === "item/agentMessage/delta") {
      const itemId = stringValue(params.itemId) || "agent";
      waiter.messageParts.set(itemId, `${waiter.messageParts.get(itemId) || ""}${stringValue(params.delta) || ""}`);
      return;
    }
    if (method === "item/completed") {
      waiter.itemCount += 1;
      const item = asObject(params.item);
      if (item.type === "agentMessage" && typeof item.text === "string") {
        waiter.messageParts.set(stringValue(item.id) || "agent", item.text);
      }
      return;
    }
    if (method !== "turn/completed") return;
    const turn = asObject(params.turn);
    this.#finishTurn(turnId, turn, waiter);
  }

  #waitForTurn(turnId: string, emit: (event: CodexStreamEvent) => void): Promise<SendMessageResponse> {
    return new Promise((resolve, reject) => {
      const waiter: TurnWaiter = { itemCount: 0, messageParts: new Map(), emit, resolve, reject };
      this.#turnWaiters.set(turnId, waiter);
      const backlog = this.#notificationBacklog.get(turnId) || [];
      this.#notificationBacklog.delete(turnId);
      // 重放过程中 turn/completed 可能结束并移除等待器；完成后不再处理异常的尾随事件。
      for (const notification of backlog) {
        if (!this.#turnWaiters.has(turnId)) break;
        this.#processTurnNotification(turnId, notification.method, notification.params, waiter);
      }
    });
  }

  #finishTurn(turnId: string, turn: JsonObject, waiter: TurnWaiter): void {
    this.#turnWaiters.delete(turnId);
    this.#notificationBacklog.delete(turnId);
    this.#userInputs.clear();
    if (this.#activeTurnId === turnId) this.#activeTurnId = undefined;
    const status = stringValue(turn.status);
    if (status === "failed") {
      waiter.reject(new Error(stringValue(asObject(turn.error).message) || "Codex turn failed."));
      return;
    }
    const streamedText = [...waiter.messageParts.values()].join("\n").trim();
    const finalItem = Array.isArray(turn.items)
      ? turn.items.map(asObject).find((item) => item.type === "agentMessage")
      : undefined;
    const text = streamedText
      || stringValue(finalItem?.text)
      || (status === "interrupted" ? "Turn interrupted." : "");
    waiter.resolve({ text, itemCount: waiter.itemCount });
  }

  #handleExit(code: number | null, signal: string | null): void {
    const detail = this.#lastError || `Codex harness exited (${code ?? signal ?? "unknown"}).`;
    const error = new Error(detail);
    for (const pending of this.#pending.values()) pending.reject(error);
    for (const [turnId, waiter] of this.#turnWaiters) {
      waiter.emit({ type: "error", turnId, error: detail });
      waiter.reject(error);
    }
    this.#pending.clear();
    this.#turnWaiters.clear();
    this.#notificationBacklog.clear();
    this.#approvals.clear();
    this.#userInputs.clear();
    this.#process = undefined;
    this.#ready = undefined;
    this.#threadAttached = false;
  }

  #clearUserInputs(): void {
    for (const requestId of this.#userInputs.keys()) this.#respond(requestId, { answers: {} });
    this.#userInputs.clear();
  }

  #developerInstructions(locale: Locale): string {
    const conversationInstructions = locale === "ja"
      ? "Reply in natural Japanese unless the user explicitly requests another language. Lead with the outcome and speak like a thoughtful collaborator with warmth, judgment, and awareness of the user's context. Answer ordinary questions directly instead of converting every message into a formal requirement. Acknowledge frustration or uncertainty when it matters, and be candid about what is known or still unverified. Use Markdown only when it materially improves readability. Keep execution constraints and workflow state internal instead of repeating stage names, rules, tags, or fixed templates."
      : "除非用户明确要求其他语言，否则请使用自然、清晰的简体中文回答。先给结论，像体贴、可靠的协作伙伴一样结合上下文交流，表达应有温度、有判断，也要坦诚说明尚未确认的部分。普通问题直接回答，不要把用户每句话都改写成正式需求；用户困惑或受挫时先回应真正关心的问题。短问题直接说清楚，复杂内容才使用必要的 Markdown 结构。执行门禁和流程状态属于内部约束，不要机械复述阶段名称、规则、标签或固定模板。";
    const ruleInstructions = this.#options.readRuleInstructions?.().trim();
    // 规则正文参与工作区签名：客户覆盖变化后不会错误复用带旧规则的 Codex 线程。
    return ruleInstructions ? `${conversationInstructions}\n\n${ruleInstructions}` : conversationInstructions;
  }
}

/** 为 AI Desktop Harness 建立明确的数据域，并移除宿主 App 注入的来源冒充标记。 */
export function createCodexChildEnvironment(environment: NodeJS.ProcessEnv, codexHome: string | null, dependencyLeaseId?: string): NodeJS.ProcessEnv {
  const childEnvironment = { ...environment };
  if (codexHome) childEnvironment.CODEX_HOME = codexHome;
  else delete childEnvironment.CODEX_HOME;
  delete childEnvironment.CODEX_INTERNAL_ORIGINATOR_OVERRIDE;
  // 宿主环境不得把旧任务租约泄漏给新连接；只有当前连接显式持有租约时才重新注入无路径标识。
  delete childEnvironment.AI_DESKTOP_DEPENDENCY_LEASE_ID;
  if (dependencyLeaseId) {
    if (!/^[a-zA-Z0-9._-]+$/.test(dependencyLeaseId)) throw new Error("Dependency lease id is invalid");
    childEnvironment.AI_DESKTOP_DEPENDENCY_LEASE_ID = dependencyLeaseId;
  }
  return childEnvironment;
}

function runtimeInfo(runtime: CodexRuntime | null): CodexHarnessStatus["runtime"] {
  return runtime ? { source: runtime.source, version: runtime.version } : null;
}

/** 兼容 app-server 模型目录的稳定字段和旧版别名，同时只向渲染层暴露选择器需要的信息。 */
function normalizeModelOption(value: unknown): CodexModelOption | null {
  const model = asObject(value);
  const id = stringValue(model.id) || stringValue(model.model);
  if (!id) return null;
  const effortSource = Array.isArray(model.supportedReasoningEfforts) ? model.supportedReasoningEfforts : [];
  const supportedReasoningEfforts = effortSource
    .map((entry) => typeof entry === "string"
      ? normalizeReasoningEffort(entry)
      : normalizeReasoningEffort(stringValue(asObject(entry).reasoningEffort) || stringValue(asObject(entry).effort)))
    .filter((effort): effort is ReasoningEffort => Boolean(effort));
  const serviceTierSource = [
    // 新版目录直接给出受支持服务层级；其他字段保留给固定旧版 app-server 的兼容读取。
    ...(Array.isArray(model.supportedServiceTiers) ? model.supportedServiceTiers : []),
    ...(Array.isArray(model.serviceTiers) ? model.serviceTiers : []),
    ...(Array.isArray(model.additionalSpeedTiers) ? model.additionalSpeedTiers : []),
    ...(model.supportsFastMode === true ? ["fast"] : []),
  ];
  const supportedServiceTiers = [...new Set([
    "default" as ModelServiceTier,
    ...serviceTierSource.map((entry) => normalizeServiceTier(typeof entry === "string" ? entry : stringValue(asObject(entry).serviceTier))).filter((tier): tier is ModelServiceTier => Boolean(tier)),
  ])];
  return {
    id,
    displayName: stringValue(model.displayName) || id,
    provider: stringValue(model.provider) || stringValue(model.modelProvider),
    supportedReasoningEfforts,
    supportedServiceTiers,
    defaultReasoningEffort: normalizeReasoningEffort(stringValue(model.defaultReasoningEffort)),
    isDefault: model.isDefault === true,
  };
}

function normalizeReasoningEffort(value: string | null): ReasoningEffort | null {
  return value === "none" || value === "minimal" || value === "low" || value === "medium"
    || value === "high" || value === "xhigh" || value === "max" ? value : null;
}

function normalizeServiceTier(value: string | null): ModelServiceTier | null {
  return value === "default" || value === "fast" ? value : null;
}

function asObject(value: unknown): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function normalizeUserInputRequest(requestId: number, params: JsonObject): CodexUserInputRequest | null {
  if (!Array.isArray(params.questions)) return null;
  const seenIds = new Set<string>();
  const questions = params.questions.map(asObject).map((question) => {
    const id = stringValue(question.id)?.trim().slice(0, 80) || "";
    const prompt = stringValue(question.question)?.trim().slice(0, 2_000) || "";
    if (!id || !prompt || seenIds.has(id)) return null;
    seenIds.add(id);
    const options = Array.isArray(question.options)
      ? question.options.map(asObject).map((option) => ({
        label: stringValue(option.label)?.trim().slice(0, 200) || "",
        description: stringValue(option.description)?.trim().slice(0, 500) || "",
      })).filter((option) => option.label)
      : [];
    return {
      id,
      header: stringValue(question.header)?.trim().slice(0, 80) || id,
      question: prompt,
      options,
    };
  }).filter((question): question is NonNullable<typeof question> => question !== null);
  return questions.length > 0 ? { requestId, questions } : null;
}

function displayValue(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value === undefined || value === null) return null;
  return JSON.stringify(value, null, 2);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Codex harness is unavailable.";
}

function normalizeAccount(result: JsonObject): CodexAccount {
  const account = asObject(result.account);
  const type = stringValue(account.type);
  return {
    authenticated: Boolean(type),
    authMode: type,
    email: stringValue(account.email),
    planType: stringValue(account.planType),
    requiresOpenaiAuth: result.requiresOpenaiAuth !== false,
  };
}

function isTrustedLoginUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "chatgpt.com" || url.hostname === "auth.openai.com");
  } catch {
    return false;
  }
}

function isManagedBuildOrStartCommand(command: string): boolean {
  return /(?:npm|pnpm|yarn)\s+(?:run\s+)?(?:build|start|dev|serve|preview)\b|vite\s+build|electron-builder|\belectron\s+\.|gradle(?:w)?\s+(?:build|assemble|bootRun)\b|cargo\s+(?:build|run)\b/i.test(command);
}

/** 协同任务只允许桌面主进程触发这些固定验证，Agent 的重复请求直接返回策略结果而不进入审批队列。 */
function isDesktopOwnedValidationCommand(command: string): boolean {
  return /(?:npm|pnpm|yarn)\s+(?:run\s+)?(?:typecheck|test:(?:interaction|document))\b|\bplaywright\s+test\b/i.test(command);
}

/** 把全局只读开关和逐目录权限合成为官方 app-server 的精确沙箱策略。 */
export function createSandboxPolicy(sandboxMode: SandboxMode, workspaces: WorkspaceState): JsonObject {
  if (sandboxMode === "read-only") return { type: "readOnly", networkAccess: false };
  const writableRoots = workspaces.roots
    .filter((root) => root.permission === "workspace-write")
    .map((root) => root.path);
  // 官方 legacy workspaceWrite 在空根集合时可能把 cwd 当默认可写根；这里显式降级，确保逐根只读不会被绕过。
  if (writableRoots.length === 0) return { type: "readOnly", networkAccess: false };
  return {
    type: "workspaceWrite",
    writableRoots,
    networkAccess: false,
    excludeTmpdirEnvVar: false,
    excludeSlashTmp: false,
  };
}

/** 每轮显式告诉模型哪些目录已登记，避免它把相邻目录误认为已授权工作区。 */
function workspaceContext(workspaces: WorkspaceState): string {
  const lines = workspaces.roots.map((root) => {
    const role = root.id === workspaces.primaryId ? "primary" : "additional";
    return `- ${root.path} (${role}, ${root.permission})`;
  });
  return `Registered workspace roots:\n${lines.join("\n")}`;
}
