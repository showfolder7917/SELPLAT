import { mkdirSync } from "node:fs";
import path from "node:path";

import type {
  CollaborationMember,
  CollaborationRequirementPlan,
  CollaborationTask,
} from "../../../shared/contracts/collaboration.js";
import type {
  CodexApproval,
  CodexStreamEvent,
  CodexUserInputRequest,
  ResolveCodexUserInputRequest,
  WorkspaceState,
} from "../../../shared/contracts/desktop.js";
import { CodexService, type CodexServiceOptions } from "../codex-service.js";
import { CodexSessionStore } from "../codex-session-store.js";
import { ManagedTaskExecutor } from "../managed-task-executor.js";
import { TrustedCommandStore } from "../trusted-command-store.js";
import type {
  CollaborationExecutionResult,
  CollaborationExecutorSession,
  CollaborationReviewerSession,
  CollaborationSessionFactory,
} from "./collaboration-coordinator.js";
import { CollaborationDurationLog } from "./collaboration-duration-log.js";

interface RegisteredConnection {
  connectionId: string;
  taskId: string;
  memberId: string;
  memberName: string;
  role: "executor" | "reviewer";
  service: CodexService;
  sessions: CodexSessionStore;
}

/** 把多个 app-server 的局部请求 ID 映射为主进程唯一 ID，避免不同连接的审批互相串线。 */
export class CollaborationCodexRegistry {
  readonly #connections = new Map<string, RegisteredConnection>();
  readonly #approvalBindings = new Map<number, { connectionId: string; requestId: number }>();
  readonly #userInputBindings = new Map<number, { connectionId: string; requestId: number }>();
  readonly #approvalKeys = new Map<string, number>();
  readonly #userInputKeys = new Map<string, number>();
  readonly #approvalSpans = new Map<number, string>();
  readonly #userInputSpans = new Map<number, string>();
  readonly #durations: CollaborationDurationLog;
  #nextGlobalRequestId = 1_000_000;

  constructor(durations: CollaborationDurationLog) { this.#durations = durations; }

  register(connection: RegisteredConnection): void { this.#connections.set(connection.connectionId, connection); }

  unregister(connectionId: string): void {
    this.#connections.delete(connectionId);
    for (const [globalId, binding] of this.#approvalBindings) if (binding.connectionId === connectionId) {
      this.#approvalBindings.delete(globalId);
      this.#finishWait(this.#approvalSpans, globalId, "interrupted", "connection.retired");
    }
    for (const [globalId, binding] of this.#userInputBindings) if (binding.connectionId === connectionId) {
      this.#userInputBindings.delete(globalId);
      this.#finishWait(this.#userInputSpans, globalId, "interrupted", "connection.retired");
    }
    for (const key of this.#approvalKeys.keys()) if (key.startsWith(`${connectionId}:`)) this.#approvalKeys.delete(key);
    for (const key of this.#userInputKeys.keys()) if (key.startsWith(`${connectionId}:`)) this.#userInputKeys.delete(key);
  }

  pendingApprovals(): CodexApproval[] {
    return [...this.#connections.values()].flatMap((connection) => connection.service.pendingApprovals().map((approval) => {
      const globalId = this.#globalId("approval", connection.connectionId, approval.requestId);
      this.#approvalBindings.set(globalId, { connectionId: connection.connectionId, requestId: approval.requestId });
      if (!this.#approvalSpans.has(globalId)) this.#approvalSpans.set(globalId, this.#durations.startWait(connection.taskId, "approval-wait", "approval-wait", "codex-approval-required", "user-approval", connection.memberId));
      return {
        ...approval,
        requestId: globalId,
        title: `${connection.memberName} · ${approval.title}`,
        details: [approval.details, `协同任务：${connection.taskId}`, `角色：${connection.role}`].filter(Boolean).join("\n"),
      };
    }));
  }

  resolveApproval(globalRequestId: number, decision: "accept" | "decline", trust = false): { trusted: boolean; projectRoot: string | null } {
    const binding = this.#approvalBindings.get(globalRequestId);
    const connection = binding && this.#connections.get(binding.connectionId);
    if (!binding || !connection) throw new Error("协同审批已经失效。");
    const result = connection.service.resolveApproval(binding.requestId, decision, trust);
    this.#approvalBindings.delete(globalRequestId);
    this.#finishWait(this.#approvalSpans, globalRequestId, decision === "accept" ? "completed" : "interrupted", decision === "accept" ? "approval.accepted" : "approval.declined");
    return result;
  }

  pendingUserInputs(): CodexUserInputRequest[] {
    return [...this.#connections.values()].flatMap((connection) => connection.service.pendingUserInputs().map((request) => {
      const globalId = this.#globalId("input", connection.connectionId, request.requestId);
      this.#userInputBindings.set(globalId, { connectionId: connection.connectionId, requestId: request.requestId });
      if (!this.#userInputSpans.has(globalId)) this.#userInputSpans.set(globalId, this.#durations.startWait(connection.taskId, "user-wait", "user-wait", "codex-user-input-required", "user-answer", connection.memberId));
      return {
        ...request,
        requestId: globalId,
        questions: request.questions.map((question) => ({ ...question, header: `${connection.memberName} · ${question.header}` })),
      };
    }));
  }

  resolveUserInput(request: ResolveCodexUserInputRequest): void {
    const binding = this.#userInputBindings.get(request.requestId);
    const connection = binding && this.#connections.get(binding.connectionId);
    if (!binding || !connection) throw new Error("协同提问已经失效。");
    connection.service.resolveUserInput({ ...request, requestId: binding.requestId });
    this.#userInputBindings.delete(request.requestId);
    this.#finishWait(this.#userInputSpans, request.requestId, "completed", "user-input.resolved");
  }

  #globalId(kind: "approval" | "input", connectionId: string, localId: number): number {
    const key = `${connectionId}:${localId}`;
    const keys = kind === "approval" ? this.#approvalKeys : this.#userInputKeys;
    const existing = keys.get(key);
    if (existing) return existing;
    const globalId = ++this.#nextGlobalRequestId;
    keys.set(key, globalId);
    return globalId;
  }

  #finishWait(spans: Map<number, string>, requestId: number, outcome: "completed" | "interrupted", releaseEvent: string): void {
    const spanId = spans.get(requestId);
    if (!spanId) return;
    spans.delete(requestId);
    this.#durations.finish(spanId, outcome, { releaseEvent });
  }
}

export interface CodexCollaborationSessionFactoryOptions {
  projectRoot: string;
  sessionRoot: string;
  codexHome: string;
  trustedCommands: TrustedCommandStore;
  registry: CollaborationCodexRegistry;
  resolveAttachmentPaths(attachmentIds: string[]): Promise<string[]>;
  runCodeValidation(task: CollaborationTask, emit: (event: CodexStreamEvent) => void): Promise<void>;
  readSettings: CodexServiceOptions["readSettings"];
  recordEvent(type: string, details: Record<string, unknown>, taskId: string): void;
}

/** 每次分配创建一条新 Codex 管道；执行与审核完成后先删线程，再关闭进程并注销请求路由。 */
export class CodexCollaborationSessionFactory implements CollaborationSessionFactory {
  readonly #options: CodexCollaborationSessionFactoryOptions;

  constructor(options: CodexCollaborationSessionFactoryOptions) {
    this.#options = options;
    mkdirSync(options.sessionRoot, { recursive: true });
  }

  async createExecutor(task: CollaborationTask, member: CollaborationMember): Promise<CollaborationExecutorSession> {
    const connection = this.#createConnection(task, member, "executor");
    return new CodexExecutorSession(
      connection,
      this.#options.registry,
      this.#options.resolveAttachmentPaths,
      this.#options.runCodeValidation,
    );
  }

  async createReviewer(task: CollaborationTask, member: CollaborationMember): Promise<CollaborationReviewerSession> {
    const connection = this.#createConnection(task, member, "reviewer");
    return new CodexReviewerSession(connection, this.#options.registry, this.#options.resolveAttachmentPaths);
  }

  #createConnection(task: CollaborationTask, member: CollaborationMember, role: RegisteredConnection["role"]): RegisteredConnection {
    const connectionId = `${task.taskId}:${role}:${member.memberId}:g${member.generation}`;
    const sessionPath = path.join(this.#options.sessionRoot, `${safeName(connectionId)}.json`);
    const sessions = new CodexSessionStore(sessionPath);
    const service = new CodexService(
      task.versionWorkspace?.rootPath || this.#options.projectRoot,
      this.#options.trustedCommands,
      sessions,
      {
        codexHome: this.#options.codexHome,
        serviceName: "selplat_ai_desktop_collaboration",
        threadSource: "ai-desktop-collaboration",
        migrateLegacySession: true,
        sessionStorage: "ai-desktop",
        validationOwner: "desktop",
        readSettings: this.#options.readSettings,
      },
      (details) => this.#options.recordEvent("collaboration.trusted_command.decision", { connectionId, memberId: member.memberId, role, ...details }, task.taskId),
      (details) => this.#options.recordEvent("collaboration.thread.lifecycle", { connectionId, memberId: member.memberId, role, ...details }, task.taskId),
    );
    const connection = { connectionId, taskId: task.taskId, memberId: member.memberId, memberName: member.displayName, role, service, sessions };
    this.#options.registry.register(connection);
    return connection;
  }
}

class CodexExecutorSession implements CollaborationExecutorSession {
  readonly #connection: RegisteredConnection;
  readonly #registry: CollaborationCodexRegistry;
  readonly #resolveAttachmentPaths: CodexCollaborationSessionFactoryOptions["resolveAttachmentPaths"];
  readonly #runCodeValidation: CodexCollaborationSessionFactoryOptions["runCodeValidation"];
  readonly #managed = new ManagedTaskExecutor();

  constructor(
    connection: RegisteredConnection,
    registry: CollaborationCodexRegistry,
    resolveAttachmentPaths: CodexCollaborationSessionFactoryOptions["resolveAttachmentPaths"],
    runCodeValidation: CodexCollaborationSessionFactoryOptions["runCodeValidation"],
  ) {
    this.#connection = connection;
    this.#registry = registry;
    this.#resolveAttachmentPaths = resolveAttachmentPaths;
    this.#runCodeValidation = runCodeValidation;
  }

  async analyze(task: CollaborationTask, emit: (event: CodexStreamEvent) => void): Promise<string> {
    return this.#runRequirement(task, task.snapshot.confirmedIntent, emit);
  }

  isAlive(): boolean { return this.#connection.service.isAlive(); }

  async optimize(task: CollaborationTask, feedback: string, emit: (event: CodexStreamEvent) => void): Promise<string> {
    const currentPlan = task.plans.find((plan) => plan.version === task.currentPlanVersion)?.text || "";
    return this.#runRequirement(task, `继续优化同一任务方案。\n\n当前方案：\n${currentPlan}\n\n审核反馈：\n${feedback}`, emit);
  }

  async execute(task: CollaborationTask, plan: CollaborationRequirementPlan, emit: (event: CodexStreamEvent) => void): Promise<CollaborationExecutionResult> {
    const workspaceState = collaborationWorkspaceState(task);
    const attachmentPaths = await this.#resolveAttachmentPaths(task.snapshot.attachmentIds);
    const result = await this.#managed.run({
      mode: "task-managed",
      message: [
        `已确认任务：\n${task.snapshot.confirmedIntent}`,
        `已通过质量门禁的方案：\n${plan.text}`,
        "完成源码修改与代码级验证后，最终回答必须在最前面依次使用以下独立 Markdown 标题，并在每个标题下给出简短、可直接归档的事实：最终执行结果、原来存在的问题、本次解决的问题、具体修正或改变、完成状态、遗留内容。之后可以再补充详细说明。禁止省略标题；没有遗留内容时明确写“无”。",
      ].join("\n\n"),
      restartRequired: false,
      emit,
      runCodeValidation: (onEvent) => this.#runCodeValidation(task, onEvent),
      runTurn: (message, onEvent, mode) => this.#connection.service.send(message, task.snapshot.locale, "workspace-write", workspaceState, attachmentPaths, onEvent, mode),
    });
    return { status: result.managedStatus === "code-verified" ? "code-verified" : "incomplete", text: result.text, pendingActions: result.pendingActions };
  }

  async dispose(): Promise<void> {
    await retireConnection(this.#connection, this.#registry);
  }

  async #runRequirement(task: CollaborationTask, message: string, emit: (event: CodexStreamEvent) => void): Promise<string> {
    const workspaceState = collaborationWorkspaceState(task);
    const attachmentPaths = await this.#resolveAttachmentPaths(task.snapshot.attachmentIds);
    const result = await this.#managed.run({
      mode: "requirement-managed",
      message,
      restartRequired: false,
      emit,
      runTurn: (prompt, onEvent, mode) => this.#connection.service.send(prompt, task.snapshot.locale, "read-only", workspaceState, attachmentPaths, onEvent, mode),
    });
    if (result.managedStatus !== "requirement-ready" || !result.text.trim()) throw new Error("执行人没有产生可审核的需求方案。");
    return result.text.trim();
  }
}

class CodexReviewerSession implements CollaborationReviewerSession {
  readonly #connection: RegisteredConnection;
  readonly #registry: CollaborationCodexRegistry;
  readonly #resolveAttachmentPaths: CodexCollaborationSessionFactoryOptions["resolveAttachmentPaths"];

  constructor(connection: RegisteredConnection, registry: CollaborationCodexRegistry, resolveAttachmentPaths: CodexCollaborationSessionFactoryOptions["resolveAttachmentPaths"]) {
    this.#connection = connection;
    this.#registry = registry;
    this.#resolveAttachmentPaths = resolveAttachmentPaths;
  }

  isAlive(): boolean { return this.#connection.service.isAlive(); }

  async review(task: CollaborationTask, plan: CollaborationRequirementPlan, emit: (event: CodexStreamEvent) => void): Promise<CollaborationReviewSessionResult> {
    const prompt = [
      "[协同方案质量审核]",
      "只读审核下面的方案是否已经满足客户已确认任务的最低必要需求。满足最低需求必须通过；更安全、更简单、更可靠或更完整的做法只能作为非阻断优化建议，禁止据此扩大问题或驳回。禁止修改文件和执行构建。",
      `任务版本：${task.taskRevision}`,
      `方案版本：${plan.version}`,
      `已确认任务：\n${task.snapshot.confirmedIntent}`,
      `待审核方案：\n${plan.text}`,
      "只有明确指出未满足的原始客户需求及其证据时才允许驳回；否则应一次通过。请先给出具体依据和必要改进意见，并在正文任意独立位置输出且只输出一个结构化结论标记：<review_decision>PASSED</review_decision> 或 <review_decision>REJECTED</review_decision>。",
    ].join("\n\n");
    const attachmentPaths = await this.#resolveAttachmentPaths(task.snapshot.attachmentIds);
    const response = await this.#connection.service.send(prompt, task.snapshot.locale, "read-only", collaborationWorkspaceState(task), attachmentPaths, emit, "requirement-managed");
    const normalized = response.text.trim();
    try {
      return await resolveCollaborationReviewDecision(normalized, async () => {
        // 审核正文已经完成时只向原审核员补取机器结论，避免丢弃有效分析并重新消耗另一名审核员。
        const clarification = await this.#connection.service.send(
          "你的审核正文已收到，但没有识别到唯一结论。请仅返回 <review_decision>PASSED</review_decision> 或 <review_decision>REJECTED</review_decision>，不要添加其他文字。",
          task.snapshot.locale,
          "read-only",
          collaborationWorkspaceState(task),
          [],
          emit,
          "requirement-managed",
        );
        return clarification.text.trim();
      });
    } catch (error) {
      // 补取期间的连接异常仍属于基础设施失败，但必须把已经完成的原审核正文带回协调器持久化。
      throw new CollaborationReviewTransportError(normalized, error);
    }
  }

  async dispose(): Promise<void> {
    await retireConnection(this.#connection, this.#registry);
  }
}

export type CollaborationReviewDecisionSource = "tag" | "legacy-marker" | "explicit-chinese" | "clarification";

export type CollaborationReviewSessionResult =
  | {
    outcome: "decided";
    decision: "passed" | "rejected";
    decisionSource: CollaborationReviewDecisionSource;
    feedback: string;
    rawOutput: string;
    clarificationOutput: string | null;
  }
  | {
    outcome: "decision-unrecognized";
    feedback: string;
    rawOutput: string;
    clarificationOutput: string;
    error: string;
  };

export class CollaborationReviewTransportError extends Error {
  readonly rawOutput: string;
  readonly clarificationOutput: string | null = null;

  constructor(rawOutput: string, cause: unknown) {
    super(`补取审核结论时连接异常：${cause instanceof Error ? cause.message : String(cause)}`, { cause });
    this.name = "CollaborationReviewTransportError";
    this.rawOutput = rawOutput;
  }
}

/** 原审核输出无法机器识别时只补取一次结论；无论补取成败都保留原始审核正文。 */
export async function resolveCollaborationReviewDecision(rawOutput: string, requestClarification: () => Promise<string>): Promise<CollaborationReviewSessionResult> {
  const normalized = rawOutput.trim();
  const parsed = parseCollaborationReviewDecision(normalized);
  if (parsed) return { outcome: "decided", ...parsed, feedback: normalized, rawOutput: normalized, clarificationOutput: null };

  const clarificationOutput = (await requestClarification()).trim();
  const clarified = parseCollaborationReviewDecision(clarificationOutput);
  if (clarified) {
    return {
      outcome: "decided",
      decision: clarified.decision,
      decisionSource: "clarification",
      feedback: normalized || clarificationOutput,
      rawOutput: normalized,
      clarificationOutput,
    };
  }
  return {
    outcome: "decision-unrecognized",
    feedback: normalized,
    rawOutput: normalized,
    clarificationOutput,
    error: "审核正文已生成，但原始输出和一次结论补取都没有包含唯一、明确的审核决定。",
  };
}

/** 只接受唯一且明确的审核结论，兼容结构化标签、旧协议和明确中文结论，不从普通正文猜测。 */
export function parseCollaborationReviewDecision(text: string): { decision: "passed" | "rejected"; decisionSource: Exclude<CollaborationReviewDecisionSource, "clarification"> } | null {
  const normalized = text.replace(/^\uFEFF/, "").trim();
  if (!normalized) return null;

  const taggedValues = [...normalized.matchAll(/<review_decision>\s*(PASSED|REJECTED)\s*<\/review_decision>/gi)].map((match) => match[1]);
  if (taggedValues.length > 0) {
    const tagged = uniqueDecision(taggedValues);
    return tagged ? { decision: tagged, decisionSource: "tag" } : null;
  }

  const semanticLines = normalized.split(/\r?\n/).map(normalizeDecisionLine).filter(Boolean);
  const legacyValues = semanticLines.flatMap((line) => {
    const match = line.match(/^DECISION\s*[:：]\s*(PASSED|REJECTED)\s*[.!。！]?$/i);
    return match ? [match[1]] : [];
  });
  if (legacyValues.length > 0) {
    const legacy = uniqueDecision(legacyValues);
    return legacy ? { decision: legacy, decisionSource: "legacy-marker" } : null;
  }

  const chineseValues = semanticLines.flatMap((line) => {
    const match = line.match(/^(?:审核)?结论\s*[:：]\s*(通过|不通过|驳回|拒绝)\s*[。！!]?$/);
    if (!match) return [];
    return [match[1] === "通过" ? "PASSED" : "REJECTED"];
  });
  const chinese = uniqueDecision(chineseValues);
  return chinese ? { decision: chinese, decisionSource: "explicit-chinese" } : null;
}

function normalizeDecisionLine(line: string): string {
  return line
    .trim()
    .replace(/^```\w*\s*$/i, "")
    .replace(/^(?:[-*+>#]|\d+[.)])\s*/, "")
    .replace(/[*_`]/g, "")
    .trim();
}

function uniqueDecision(values: Array<string | undefined>): "passed" | "rejected" | null {
  const decisions = new Set(values.filter((value): value is string => Boolean(value)).map((value) => value.toUpperCase() === "PASSED" ? "passed" : "rejected"));
  return decisions.size === 1 ? [...decisions][0] : null;
}

function collaborationWorkspaceState(task: CollaborationTask): WorkspaceState {
  const workspace = task.versionWorkspace;
  if (!workspace) return structuredClone(task.snapshot.workspaceState);
  return {
    primaryId: workspace.workspaceId,
    roots: [{ id: workspace.workspaceId, name: path.basename(workspace.rootPath), path: workspace.rootPath, permission: "workspace-write" }],
  };
}

function safeName(value: string): string {
  return value.replaceAll(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 180);
}

async function retireConnection(connection: RegisteredConnection, registry: CollaborationCodexRegistry): Promise<void> {
  try { await connection.service.newChat(); }
  finally {
    connection.service.dispose();
    connection.sessions.clear();
    registry.unregister(connection.connectionId);
  }
}
