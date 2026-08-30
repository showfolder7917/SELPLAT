import { mkdirSync } from "node:fs";
import path from "node:path";

import type {
  CollaborationMember,
  CollaborationRequirementPlan,
  CollaborationRepairDiagnosis,
  CollaborationTask,
} from "../../../contracts/collaboration/collaboration.js";
import type {
  CodexApproval,
  CodexStreamEvent,
  CodexUserInputRequest,
  ResolveCodexUserInputRequest,
  WorkspaceState,
} from "../../../contracts/desktop/desktop.js";
import { CodexService, type CodexServiceOptions } from "../codex-service.js";
import { CodexSessionStore, type CodexSessionPersistence } from "../codex-session-store.js";
import { ManagedTaskExecutor } from "../managed-task-executor.js";
import { TrustedCommandStore } from "../trusted-command-store.js";
import type {
  CollaborationExecutionResult,
  CollaborationExecutorSession,
  CollaborationSessionFactory,
} from "./collaboration-coordinator.js";
import { CollaborationDurationLog } from "./collaboration-duration-log.js";
import {
  acquireManagedDependencyLease,
  releaseManagedDependencyLease,
  type ManagedDependencyLease,
} from "./integration-verifier.js";

interface RegisteredConnection {
  connectionId: string;
  taskId: string;
  memberId: string;
  memberName: string;
  role: "executor";
  service: CodexService;
  sessions: CodexSessionPersistence;
  persistentPersona: boolean;
  dependencyLease: ManagedDependencyLease | null;
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
  applicationName: string;
  sessionRoot: string;
  codexHome: string;
  trustedCommands: TrustedCommandStore;
  registry: CollaborationCodexRegistry;
  resolveAttachmentPaths(attachmentIds: string[]): Promise<string[]>;
  runCodeValidation(task: CollaborationTask, emit: (event: CodexStreamEvent) => void): Promise<void>;
  readSettings: CodexServiceOptions["readSettings"];
  readRuleInstructions?: CodexServiceOptions["readRuleInstructions"];
  readWorkspaceState?: () => WorkspaceState;
  personaSessionStore?: (memberId: string) => CodexSessionPersistence | null;
  recordEvent(type: string, details: Record<string, unknown>, taskId: string): void;
}

/** 每次分配创建一条执行人物 Codex 管道；任务完成后先删线程，再关闭进程并注销请求路由。 */
export class CodexCollaborationSessionFactory implements CollaborationSessionFactory {
  readonly #options: CodexCollaborationSessionFactoryOptions;

  constructor(options: CodexCollaborationSessionFactoryOptions) {
    this.#options = options;
    mkdirSync(options.sessionRoot, { recursive: true });
  }

  async createExecutor(task: CollaborationTask, member: CollaborationMember): Promise<CollaborationExecutorSession> {
    const workspaceRoot = task.versionWorkspace?.rootPath;
    const dependencyLease = workspaceRoot
      ? await acquireManagedDependencyLease(
        workspaceRoot,
        this.#options.projectRoot,
        this.#options.applicationName,
        `executor-${task.taskId}-${member.memberId}-g${member.generation}`,
      )
      : null;
    try {
      const connection = this.#createConnection(task, member, "executor", dependencyLease);
      return new CodexExecutorSession(
        connection,
        this.#options.registry,
        this.#options.resolveAttachmentPaths,
        this.#options.runCodeValidation,
        this.#options.readWorkspaceState,
      );
    } catch (error) {
      releaseManagedDependencyLease(dependencyLease);
      throw error;
    }
  }

  #createConnection(task: CollaborationTask, member: CollaborationMember, role: RegisteredConnection["role"], dependencyLease: ManagedDependencyLease | null): RegisteredConnection {
    const persistentSessions = this.#options.personaSessionStore?.(member.memberId) || null;
    const connectionId = persistentSessions ? `persona:${member.memberId}` : `${task.taskId}:${role}:${member.memberId}:g${member.generation}`;
    const sessionPath = path.join(this.#options.sessionRoot, `${safeName(connectionId)}.json`);
    const sessions = persistentSessions || new CodexSessionStore(sessionPath);
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
        dependencyLeaseId: dependencyLease?.leaseId,
        preserveThreadAcrossWorkspaceChanges: Boolean(persistentSessions),
        readSettings: this.#options.readSettings,
        readRuleInstructions: this.#options.readRuleInstructions,
      },
      (details) => this.#options.recordEvent("collaboration.trusted_command.decision", { connectionId, memberId: member.memberId, role, ...details }, task.taskId),
      (details) => this.#options.recordEvent("collaboration.thread.lifecycle", { connectionId, memberId: member.memberId, role, ...details }, task.taskId),
    );
    const connection = { connectionId, taskId: task.taskId, memberId: member.memberId, memberName: member.displayName, role, service, sessions, dependencyLease, persistentPersona: Boolean(persistentSessions) };
    this.#options.registry.register(connection);
    return connection;
  }
}

class CodexExecutorSession implements CollaborationExecutorSession {
  readonly #connection: RegisteredConnection;
  readonly #registry: CollaborationCodexRegistry;
  readonly #resolveAttachmentPaths: CodexCollaborationSessionFactoryOptions["resolveAttachmentPaths"];
  readonly #runCodeValidation: CodexCollaborationSessionFactoryOptions["runCodeValidation"];
  readonly #readWorkspaceState: CodexCollaborationSessionFactoryOptions["readWorkspaceState"];
  readonly #managed = new ManagedTaskExecutor();

  constructor(
    connection: RegisteredConnection,
    registry: CollaborationCodexRegistry,
    resolveAttachmentPaths: CodexCollaborationSessionFactoryOptions["resolveAttachmentPaths"],
    runCodeValidation: CodexCollaborationSessionFactoryOptions["runCodeValidation"],
    readWorkspaceState: CodexCollaborationSessionFactoryOptions["readWorkspaceState"],
  ) {
    this.#connection = connection;
    this.#registry = registry;
    this.#resolveAttachmentPaths = resolveAttachmentPaths;
    this.#runCodeValidation = runCodeValidation;
    this.#readWorkspaceState = readWorkspaceState;
  }

  async analyze(task: CollaborationTask, emit: (event: CodexStreamEvent) => void): Promise<string> {
    return this.#runRequirement(task, [
      "[执行人物技术分析]",
      "南宫婉已经完成客户需求、目标、范围、验收标准和任务拆分。不要重新解释客户为什么要做，也不要重复南宫婉的需求分析。",
      "只分析如何落地：代码位置、现有调用链、最小实现、技术风险和验证方式。若源码事实与南宫婉任务描述冲突，明确报告冲突并停止扩大实现，等待退回南宫婉修正。",
      `已确认任务：\n${task.snapshot.confirmedIntent}`,
    ].join("\n\n"), emit);
  }

  isAlive(): boolean { return this.#connection.service.isAlive(); }

  async optimize(task: CollaborationTask, feedback: string, emit: (event: CodexStreamEvent) => void): Promise<string> {
    const currentPlan = task.plans.find((plan) => plan.version === task.currentPlanVersion)?.text || "";
    return this.#runRequirement(task, `依据已登记的技术失败证据修正同一实施方案，不重复需求分析。\n\n当前技术分析：\n${currentPlan}\n\n失败证据：\n${feedback}`, emit);
  }

  async execute(task: CollaborationTask, plan: CollaborationRequirementPlan, emit: (event: CodexStreamEvent) => void): Promise<CollaborationExecutionResult> {
    return this.#executePlan(task, [
      `已确认任务：\n${task.snapshot.confirmedIntent}`,
      `执行人完成的技术分析：\n${plan.text}`,
    ], emit);
  }

  async #executePlan(task: CollaborationTask, instructions: string[], emit: (event: CodexStreamEvent) => void): Promise<CollaborationExecutionResult> {
    const workspaceState = collaborationWorkspaceState(task, this.#readWorkspaceState?.());
    const attachmentPaths = await this.#resolveAttachmentPaths(task.snapshot.attachmentIds);
    const result = await this.#managed.run({
      mode: "task-managed",
      message: [
        ...instructions,
        "完成源码修改与代码级验证后，最终回答必须在最前面依次使用以下独立 Markdown 标题，并在每个标题下给出简短、可直接归档的事实：最终执行结果、原来存在的问题、本次解决的问题、具体修正或改变、完成状态、遗留内容。之后可以再补充详细说明。禁止省略标题；没有遗留内容时明确写“无”。",
      ].join("\n\n"),
      restartRequired: false,
      emit,
      runCodeValidation: (onEvent) => this.#runCodeValidation(task, onEvent),
      runTurn: (message, onEvent, mode) => this.#connection.service.send(message, task.snapshot.locale, "workspace-write", workspaceState, attachmentPaths, onEvent, mode),
    });
    return { status: result.managedStatus === "code-verified" ? "code-verified" : "incomplete", text: result.text, pendingActions: result.pendingActions, changedFiles: result.changedFiles, successfulCommands: result.successfulCommands };
  }

  async investigateRepair(task: CollaborationTask, failure: string, emit: (event: CodexStreamEvent) => void): Promise<string> {
    return this.#runRequirement(task, [
      "[令狐故障只读调查]",
      "先调查本次真实失败事实，再决定修复。禁止复述或执行原专题方案，禁止修改文件。",
      "说明失败阶段、直接原因、证据位置、最小修复边界、禁止触碰范围和必须重跑的验证命令。若证据不足，明确指出缺少什么，不得猜测。",
      `失败事实：\n${failure}`,
    ].join("\n\n"), emit);
  }

  async executeRepair(task: CollaborationTask, diagnosis: CollaborationRepairDiagnosis, emit: (event: CodexStreamEvent) => void): Promise<CollaborationExecutionResult> {
    return this.#executePlan(task, [
      "[故障修复专用执行]",
      diagnosis.repairInstruction,
      `失败阶段：${diagnosis.failureStage}`,
      `失败摘要：${diagnosis.failureSummary}`,
      `技术证据：\n${diagnosis.technicalEvidence.join("\n")}`,
      "只修复上述调查结论覆盖的问题；禁止读取或复用原专题实施方案，禁止重新完成原专题任务，禁止扩大范围。",
    ], emit);
  }

  async dispose(): Promise<void> {
    await retireConnection(this.#connection, this.#registry);
  }

  async #runRequirement(task: CollaborationTask, message: string, emit: (event: CodexStreamEvent) => void): Promise<string> {
    const workspaceState = collaborationWorkspaceState(task, this.#readWorkspaceState?.());
    const attachmentPaths = await this.#resolveAttachmentPaths(task.snapshot.attachmentIds);
    const result = await this.#managed.run({
      mode: "requirement-managed",
      message,
      restartRequired: false,
      emit,
      runTurn: (prompt, onEvent, mode) => this.#connection.service.send(prompt, task.snapshot.locale, "read-only", workspaceState, attachmentPaths, onEvent, mode),
    });
    if (result.managedStatus !== "requirement-ready" || !result.text.trim()) throw new Error("执行人没有产生可执行的技术分析。");
    return result.text.trim();
  }

}

function collaborationWorkspaceState(task: CollaborationTask, configured?: WorkspaceState): WorkspaceState {
  const workspace = task.versionWorkspace;
  const base = configured || task.snapshot.workspaceState;
  if (!workspace) return structuredClone(base);
  const roots = base.roots.filter((root) => path.resolve(root.path) !== path.resolve(workspace.rootPath));
  return {
    primaryId: workspace.workspaceId,
    roots: [{ id: workspace.workspaceId, name: path.basename(workspace.rootPath), path: workspace.rootPath, permission: "workspace-write" }, ...roots],
  };
}

function safeName(value: string): string {
  return value.replaceAll(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 180);
}

async function retireConnection(connection: RegisteredConnection, registry: CollaborationCodexRegistry): Promise<void> {
  try {
    if (!connection.persistentPersona) await connection.service.newChat();
  } finally {
    connection.service.dispose();
    if (!connection.persistentPersona) connection.sessions.clear();
    registry.unregister(connection.connectionId);
    releaseManagedDependencyLease(connection.dependencyLease);
  }
}
