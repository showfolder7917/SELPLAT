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
import { CodexService } from "../codex-service.js";
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
  trustedCommands: TrustedCommandStore;
  registry: CollaborationCodexRegistry;
  resolveAttachmentPaths(attachmentIds: string[]): Promise<string[]>;
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
    return new CodexExecutorSession(connection, this.#options.registry, this.#options.resolveAttachmentPaths);
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
  readonly #managed = new ManagedTaskExecutor();

  constructor(connection: RegisteredConnection, registry: CollaborationCodexRegistry, resolveAttachmentPaths: CodexCollaborationSessionFactoryOptions["resolveAttachmentPaths"]) {
    this.#connection = connection;
    this.#registry = registry;
    this.#resolveAttachmentPaths = resolveAttachmentPaths;
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
      message: `已确认任务：\n${task.snapshot.confirmedIntent}\n\n已通过质量门禁的方案：\n${plan.text}`,
      restartRequired: false,
      emit,
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

  async review(task: CollaborationTask, plan: CollaborationRequirementPlan, emit: (event: CodexStreamEvent) => void): Promise<{ decision: "passed" | "rejected"; feedback: string }> {
    const prompt = [
      "[协同方案质量审核]",
      "只读审核下面的方案能否完整解决已确认任务，并检查是否有更安全、更简单或更可靠的方案。禁止修改文件和执行构建。",
      `任务版本：${task.taskRevision}`,
      `方案版本：${plan.version}`,
      `已确认任务：\n${task.snapshot.confirmedIntent}`,
      `待审核方案：\n${plan.text}`,
      "第一行必须且只能写 DECISION: PASSED 或 DECISION: REJECTED，随后给出具体依据和改进意见。",
    ].join("\n\n");
    const attachmentPaths = await this.#resolveAttachmentPaths(task.snapshot.attachmentIds);
    const response = await this.#connection.service.send(prompt, task.snapshot.locale, "read-only", collaborationWorkspaceState(task), attachmentPaths, emit, "requirement-managed");
    const normalized = response.text.trim();
    const firstLine = normalized.split(/\r?\n/, 1)[0]?.trim().toUpperCase();
    if (firstLine === "DECISION: PASSED") return { decision: "passed", feedback: normalized };
    if (firstLine === "DECISION: REJECTED") return { decision: "rejected", feedback: normalized };
    throw new Error("审核结果缺少合法的结构化决定。");
  }

  async dispose(): Promise<void> {
    await retireConnection(this.#connection, this.#registry);
  }
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
