import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createRequire } from "node:module";
import { createInterface } from "node:readline";

import type {
  CodexAccount,
  CodexApproval,
  CodexHarnessStatus,
  CodexLoginResponse,
  CodexStreamActivity,
  CodexStreamEvent,
  CodexStreamPlanStep,
  Locale,
  SandboxMode,
  SendMessageResponse,
  WorkspaceState,
} from "../../shared/contracts/desktop.js";

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
  readonly #turnWaiters = new Map<string, TurnWaiter>();
  readonly #notificationBacklog = new Map<string, BufferedNotification[]>();
  readonly #items = new Map<string, JsonObject>();
  #process: ChildProcessWithoutNullStreams | undefined;
  #ready: Promise<void> | undefined;
  #requestId = 0;
  #threadId: string | undefined;
  #threadSandbox: SandboxMode | undefined;
  #threadWorkspaceSignature: string | undefined;
  #activeTurnId: string | undefined;
  #lastError: string | null = null;

  constructor(workingDirectory: string) {
    this.#workingDirectory = workingDirectory;
  }

  newChat(): void {
    void this.cancel();
    this.#threadId = undefined;
    this.#threadSandbox = undefined;
    this.#threadWorkspaceSignature = undefined;
  }

  async getStatus(): Promise<CodexHarnessStatus> {
    try {
      await this.#ensureReady();
      const result = asObject(await this.#request("account/read", { refreshToken: false }));
      return { connected: true, account: normalizeAccount(result), error: null };
    } catch (error) {
      this.#lastError = errorMessage(error);
      return { connected: false, account: { ...EMPTY_ACCOUNT }, error: this.#lastError };
    }
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
    this.newChat();
    return this.getStatus();
  }

  pendingApprovals(): CodexApproval[] {
    return [...this.#approvals.values()];
  }

  resolveApproval(requestId: number, decision: "accept" | "decline"): void {
    if (!Number.isSafeInteger(requestId) || !this.#approvals.has(requestId)) {
      throw new Error("Codex approval request is no longer active.");
    }
    this.#approvals.delete(requestId);
    this.#respond(requestId, { decision });
  }

  async cancel(): Promise<boolean> {
    if (!this.#threadId || !this.#activeTurnId) return false;
    await this.#request("turn/interrupt", { threadId: this.#threadId, turnId: this.#activeTurnId });
    return true;
  }

  async send(
    message: string,
    locale: Locale,
    sandboxMode: SandboxMode,
    workspaces: WorkspaceState,
    attachmentPaths: string[] = [],
    onStreamEvent: (event: CodexStreamEvent) => void = () => undefined,
  ): Promise<SendMessageResponse> {
    const normalizedMessage = message.trim();
    if ((!normalizedMessage && attachmentPaths.length === 0) || normalizedMessage.length > 20_000) {
      throw new Error("Message or screenshot attachment is required, with at most 20000 text characters.");
    }

    await this.#ensureReady();
    await this.cancel();
    const primaryRoot = workspaces.roots.find((root) => root.id === workspaces.primaryId) || workspaces.roots[0];
    if (!primaryRoot) throw new Error("At least one registered workspace is required.");
    const threadId = await this.#getThread(sandboxMode, workspaces, primaryRoot.path);
    const userTask = normalizedMessage || (locale === "ja" ? "添付画像を確認してください。" : "请阅读并分析附加截图。");
    const input: JsonObject[] = [{
      type: "text",
      text: `${this.#responseLanguage(locale)}\n\n${workspaceContext(workspaces)}\n\n${userTask}`,
    }];
    // 官方 app-server 0.146.0 的 turn/start 使用 localImage 路径读取本地主进程已校验的 PNG。
    input.push(...attachmentPaths.map((filePath) => ({ type: "localImage", path: filePath })));
    const result = asObject(await this.#request("turn/start", {
      threadId,
      cwd: primaryRoot.path,
      approvalPolicy: "on-request",
      approvalsReviewer: "user",
      sandboxPolicy: createSandboxPolicy(sandboxMode, workspaces),
      input,
    }));
    const turnId = stringValue(asObject(result.turn).id);
    if (!turnId) throw new Error("Codex harness did not return a turn id.");
    this.#activeTurnId = turnId;
    return this.#waitForTurn(turnId, onStreamEvent);
  }

  dispose(): void {
    this.#process?.kill();
    this.#process = undefined;
    this.#ready = undefined;
  }

  async #getThread(sandboxMode: SandboxMode, workspaces: WorkspaceState, cwd: string): Promise<string> {
    const workspaceSignature = JSON.stringify(workspaces);
    if (
      this.#threadId
      && this.#threadSandbox === sandboxMode
      && this.#threadWorkspaceSignature === workspaceSignature
    ) return this.#threadId;
    const result = asObject(await this.#request("thread/start", {
      cwd,
      approvalPolicy: "on-request",
      // 桌面 UI 必须由当前用户审查审批；不能继承全局 auto_review 后静默代审。
      approvalsReviewer: "user",
      sandbox: sandboxMode,
    }));
    const threadId = stringValue(asObject(result.thread).id);
    if (!threadId) throw new Error("Codex harness did not return a thread id.");
    this.#threadId = threadId;
    this.#threadSandbox = sandboxMode;
    this.#threadWorkspaceSignature = workspaceSignature;
    return threadId;
  }

  #ensureReady(): Promise<void> {
    if (!this.#ready) this.#ready = this.#start();
    return this.#ready;
  }

  async #start(): Promise<void> {
    const require = createRequire(import.meta.url);
    const codexEntry = require.resolve("@openai/codex/bin/codex.js");
    // Electron 自带的 Node 运行时启动官方 CLI，开发机不需要另外维护全局 codex 命令。
    const child = spawn(process.execPath, [codexEntry, "app-server", "--stdio"], {
      cwd: this.#workingDirectory,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
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
      this.#respond(id, { answers: {} });
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
    this.#approvals.set(id, {
      requestId: id,
      kind: isCommand ? "command" : "fileChange",
      title: isCommand ? "Codex requests command execution" : "Codex requests file changes",
      reason: stringValue(params.reason),
      command: displayValue(params.command || item.command),
      cwd: stringValue(params.cwd || item.cwd),
      details: isCommand ? displayValue(params.commandActions) : displayValue(item.changes),
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
    this.#process = undefined;
    this.#ready = undefined;
  }

  #responseLanguage(locale: Locale): string {
    return locale === "ja"
      ? "Reply in natural Japanese unless the user explicitly requests another language."
      : "除非用户明确要求其他语言，否则请使用自然、清晰的简体中文回答。";
  }
}

/** 把官方 app-server 通知收敛成渲染层允许消费的稳定、最小化实时事件。 */
export function toCodexStreamEvent(method: string, params: JsonObject, turnId: string): CodexStreamEvent | null {
  if (method === "turn/started") return { type: "turn-started", turnId, status: "inProgress" };
  if (method === "item/agentMessage/delta") {
    return {
      type: "message-delta",
      turnId,
      itemId: stringValue(params.itemId) || undefined,
      delta: stringValue(params.delta) || "",
    };
  }
  if (method === "item/reasoning/summaryTextDelta") {
    return {
      type: "reasoning-summary-delta",
      turnId,
      itemId: stringValue(params.itemId) || undefined,
      delta: stringValue(params.delta) || "",
    };
  }
  // 原始 reasoning textDelta 不进入 UI，只显示官方单独提供的可读 summaryTextDelta。
  if (method === "item/reasoning/textDelta") return null;
  if (method === "item/commandExecution/outputDelta") {
    return {
      type: "activity",
      turnId,
      activity: {
        id: stringValue(params.itemId) || "command-output",
        itemType: "commandExecution",
        phase: "output",
        status: "inProgress",
        summary: null,
        detail: truncate(stringValue(params.delta), 2_000),
      },
    };
  }
  if (method === "turn/plan/updated") {
    const plan = Array.isArray(params.plan)
      ? params.plan.map(asObject).map((entry): CodexStreamPlanStep => ({
        step: stringValue(entry.step) || "",
        status: normalizePlanStatus(entry.status),
      })).filter((entry) => entry.step)
      : [];
    return { type: "plan-updated", turnId, plan };
  }
  if (method === "turn/diff/updated") {
    return { type: "diff-updated", turnId, changedFiles: changedFilesFromDiff(stringValue(params.diff) || "") };
  }
  if (method === "item/started" || method === "item/completed") {
    const item = asObject(params.item);
    const itemId = stringValue(item.id) || "unknown-item";
    if (item.type === "userMessage") return null;
    if (method === "item/completed" && item.type === "agentMessage") {
      return { type: "message-completed", turnId, itemId, text: stringValue(item.text) || "" };
    }
    return {
      type: "activity",
      turnId,
      activity: createStreamActivity(item, itemId, method === "item/started" ? "started" : "completed"),
    };
  }
  if (method === "turn/completed") {
    const turn = asObject(params.turn);
    const error = stringValue(asObject(turn.error).message) || undefined;
    return { type: "turn-completed", turnId, status: stringValue(turn.status) || "completed", error };
  }
  if (method === "error") {
    return { type: "error", turnId, error: stringValue(asObject(params.error).message) || "Codex stream failed." };
  }
  return null;
}

function createStreamActivity(item: JsonObject, itemId: string, phase: "started" | "completed"): CodexStreamActivity {
  const itemType = stringValue(item.type) || "unknown";
  return {
    id: itemId,
    itemType,
    phase,
    status: stringValue(item.status),
    summary: summarizeStreamItem(itemType, item),
    detail: phase === "completed" && itemType === "commandExecution"
      ? truncate(stringValue(item.aggregatedOutput), 2_000)
      : null,
  };
}

function summarizeStreamItem(itemType: string, item: JsonObject): string | null {
  if (itemType === "commandExecution") return truncate(displayValue(item.command), 800);
  if (itemType === "fileChange") {
    const paths = Array.isArray(item.changes)
      ? item.changes.map(asObject).map((change) => stringValue(change.path)).filter((path): path is string => Boolean(path))
      : [];
    return paths.join("\n") || null;
  }
  if (itemType === "mcpToolCall") {
    return [stringValue(item.server), stringValue(item.tool)].filter(Boolean).join(" / ") || null;
  }
  if (itemType === "dynamicToolCall" || itemType === "collabToolCall") return stringValue(item.tool);
  if (itemType === "webSearch") return stringValue(item.query);
  if (itemType === "imageView") return stringValue(item.path);
  if (itemType === "enteredReviewMode" || itemType === "exitedReviewMode") return stringValue(item.review);
  return null;
}

function normalizePlanStatus(value: unknown): CodexStreamPlanStep["status"] {
  if (value === "inProgress" || value === "completed") return value;
  return "pending";
}

function changedFilesFromDiff(diff: string): string[] {
  const paths = new Set<string>();
  for (const line of diff.split("\n")) {
    const header = /^diff --git a\/.+ b\/(.+)$/.exec(line);
    const added = /^\+\+\+ b\/(.+)$/.exec(line);
    const path = header?.[1] || added?.[1];
    if (path && path !== "/dev/null") paths.add(path);
  }
  return [...paths];
}

function truncate(value: string | null, maximum: number): string | null {
  if (!value) return null;
  return value.length <= maximum ? value : `${value.slice(0, maximum)}…`;
}

function asObject(value: unknown): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
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
