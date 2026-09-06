import { mkdirSync } from "node:fs";
import path from "node:path";

import type {
  CollaborationMemberOutDto,
  CollaborationRequirementPlanOutDto,
  CollaborationRepairDiagnosisOutDto,
  CollaborationTaskOutDto,
} from "../../../../../../contracts/services/workflow/index.js";
import type {
  CodexApprovalOutDto,
  CodexStreamEventOutDto,
  CodexUserInputRequestOutDto,
  ResolveCodexUserInputInDto,
} from "../../../../../../contracts/services/support/platform/codex/index.js";
import type { WorkspaceStateOutDto } from "../../../../../../contracts/services/support/platform/workspace/index.js";
import {
  CodexFacade as CodexService,
  createFileCodexSessionRepository,
  type CodexFacadeOptions as CodexServiceOptions,
  type CodexSessionPersistence,
} from "../../../platform/codex/index.js";
import { ManagedExecutionFacade as ManagedTaskExecutor } from "../../execution/index.js";
import type { PromptLibraryPort } from "../../prompts/index.js";
import { CommandGovernanceFacade as TrustedCommandStore } from "../../../platform/security/index.js";
import type {
  ExecutorExecutionResultOutDto,
  ExecutorSessionFactoryPort,
  ExecutorSessionPort,
} from "../../../../personas/executor/index.js";
import {
  acquireManagedDependencyLease,
  releaseManagedDependencyLease,
  type ManagedDependencyLease,
} from "../../release/index.js";

// 会话能力只提交等待事实，不反向持有 Workflow 的具体耗时日志实现。
interface ConversationDurationPort {
  startWait(
    taskId: string,
    segment: "approval-wait" | "user-wait",
    waitType: "approval-wait" | "user-wait",
    reasonCode: string,
    resource: string,
    resourceOwner: string | null,
  ): string;
  finish(spanId: string, outcome: "completed" | "failed" | "interrupted", details: Record<string, unknown>): void;
}

interface RegisteredConnection {
  connectionId: string;
  taskId: string;
  memberId: string;
  memberName: string;
  role: "executor";
  service: CodexService;
  sessions: CodexSessionPersistence;
  persistentPersona: boolean;
  releasePersonaWriter: (() => void) | null;
  dependencyLease: ManagedDependencyLease | null;
}

/** 统一授权路由实际需要的最小连接属性；人物长期会话没有协作 taskId。 */
interface RegisteredInteractionConnection {
  /** 不同 app-server 连接之间稳定且唯一的路由标识。 */
  connectionId: string;
  /** 所属协作任务；人物自由会话和内部研讨没有任务时为 null。 */
  taskId: string | null;
  /** 发起授权的人物或执行成员标识。 */
  memberId: string;
  /** 授权弹窗和状态栏使用的人物显示名。 */
  memberName: string;
  /** 当前连接承担的业务角色，用于授权详情说明。 */
  role: "executor" | "persona-conversation" | "persona-inquiry";
  /** 保存局部授权请求并接收最终决定的 Codex 服务。 */
  service: CodexService;
}

interface PersonaWriterState {
  activeTaskId: string | null;
  tail: Promise<void>;
}

/**
 * 固定人物会话的唯一写入入口。同一人物的后续任务只排队，不会再创建并发 writer；
 * 队列只约束该人物，页面事件和其他执行人物仍可并行推进。
 */
export class PersonaSessionWriterQueue {
  readonly #states = new Map<string, PersonaWriterState>();

  async acquire(
    memberId: string,
    taskId: string,
    onState: (state: "queued" | "acquired" | "released", activeTaskId: string | null) => void = () => undefined,
  ): Promise<() => void> {
    const previous = this.#states.get(memberId);
    let releaseCurrent!: () => void;
    const current = new Promise<void>((resolve) => { releaseCurrent = resolve; });
    const predecessor = previous?.tail || Promise.resolve();
    const tail = predecessor.catch(() => undefined).then(() => current);
    this.#states.set(memberId, { activeTaskId: previous?.activeTaskId || null, tail });
    if (previous) onState("queued", previous.activeTaskId);
    await predecessor.catch(() => undefined);
    const state = this.#states.get(memberId);
    if (state) state.activeTaskId = taskId;
    onState("acquired", taskId);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const currentState = this.#states.get(memberId);
      if (currentState?.tail === tail) currentState.activeTaskId = null;
      releaseCurrent();
      void tail.finally(() => {
        if (this.#states.get(memberId)?.tail === tail) this.#states.delete(memberId);
      });
      onState("released", taskId);
    };
  }
}

/** 把多个 app-server 的局部请求 ID 映射为主进程唯一 ID，避免不同连接的审批互相串线。 */
export class CollaborationCodexRegistry {
  readonly #connections = new Map<string, RegisteredInteractionConnection>();
  readonly #approvalBindings = new Map<number, { connectionId: string; requestId: number }>();
  readonly #userInputBindings = new Map<number, { connectionId: string; requestId: number }>();
  readonly #approvalKeys = new Map<string, number>();
  readonly #userInputKeys = new Map<string, number>();
  readonly #approvalSpans = new Map<number, string>();
  readonly #userInputSpans = new Map<number, string>();
  readonly #durations: ConversationDurationPort;
  #nextGlobalRequestId = 1_000_000;

  constructor(durations: ConversationDurationPort) { this.#durations = durations; }

  register(connection: RegisteredConnection): void { this.#connections.set(connection.connectionId, connection); }

  /**
   * 把人物长期 Codex 连接加入统一授权与结构化提问路由。
   * 真实传参示例：南宫婉自由会话连接、memberId=nangong-wan、taskId=null。
   * 真实返回示例：该连接的局部请求会以全局 ID 出现在现有授权弹窗。
   * 异常或副作用示例：同 connectionId 会替换旧连接；不会自动允许任何请求。
   */
  registerPersona(connection: Omit<RegisteredInteractionConnection, "taskId">): void {
    this.#connections.set(connection.connectionId, { ...connection, taskId: null });
  }

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

  pendingApprovals(): CodexApprovalOutDto[] {
    return [...this.#connections.values()].flatMap((connection) => connection.service.pendingApprovals().map((approval) => {
      const globalId = this.#globalId("approval", connection.connectionId, approval.requestId);
      this.#approvalBindings.set(globalId, { connectionId: connection.connectionId, requestId: approval.requestId });
      if (connection.taskId && !this.#approvalSpans.has(globalId)) {
        const spanId = this.#durations.startWait(connection.taskId, "approval-wait", "approval-wait", "codex-approval-required", "user-approval", connection.memberId);
        this.#approvalSpans.set(globalId, spanId);
      }
      const connectionDetails: string[] = [];
      if (approval.details) connectionDetails.push(approval.details);
      if (connection.taskId) connectionDetails.push(`协同任务：${connection.taskId}`);
      connectionDetails.push(`角色：${connection.role}`);
      return {
        ...approval,
        requestId: globalId,
        title: `${connection.memberName} · ${approval.title}`,
        details: connectionDetails.join("\n"),
        ownerMemberId: connection.memberId,
        ownerMemberName: connection.memberName,
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

  pendingUserInputs(): CodexUserInputRequestOutDto[] {
    return [...this.#connections.values()].flatMap((connection) => connection.service.pendingUserInputs().map((request) => {
      const globalId = this.#globalId("input", connection.connectionId, request.requestId);
      this.#userInputBindings.set(globalId, { connectionId: connection.connectionId, requestId: request.requestId });
      if (connection.taskId && !this.#userInputSpans.has(globalId)) {
        const spanId = this.#durations.startWait(connection.taskId, "user-wait", "user-wait", "codex-user-input-required", "user-answer", connection.memberId);
        this.#userInputSpans.set(globalId, spanId);
      }
      return {
        ...request,
        requestId: globalId,
        questions: request.questions.map((question) => ({ ...question, header: `${connection.memberName} · ${question.header}` })),
      };
    }));
  }

  resolveUserInput(request: ResolveCodexUserInputInDto): void {
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
  runCodeValidation(task: CollaborationTaskOutDto, authorizedFiles: readonly string[], emit: (event: CodexStreamEventOutDto) => void): Promise<void>;
  /** 从签发给任务的工作区读取真实 Git 变更，供首次实施冻结范围。 */
  readTaskChangedFiles(task: CollaborationTaskOutDto): Promise<string[]>;
  readSettings: CodexServiceOptions["readSettings"];
  readRuleInstructions?: CodexServiceOptions["readRuleInstructions"];
  readRuleInstructionsForMember?: (memberId: string, task: CollaborationTaskOutDto) => string;
  readWorkspaceState?: () => WorkspaceStateOutDto;
  prompts: PromptLibraryPort;
  personaSessionStore?: (memberId: string) => CodexSessionPersistence | null;
  recordEvent(type: string, details: Record<string, unknown>, taskId: string): void;
}

/** 每次分配创建一条执行人物 Codex 管道；任务完成后先删线程，再关闭进程并注销请求路由。 */
export class CodexCollaborationSessionFactory implements ExecutorSessionFactoryPort {
  readonly #options: CodexCollaborationSessionFactoryOptions;
  readonly #personaWriters = new PersonaSessionWriterQueue();

  constructor(options: CodexCollaborationSessionFactoryOptions) {
    this.#options = options;
    mkdirSync(options.sessionRoot, { recursive: true });
  }

  async createExecutor(task: CollaborationTaskOutDto, member: CollaborationMemberOutDto): Promise<ExecutorSessionPort> {
    const persistentPersona = ["han-li", "nangong-wan", "linghu-ancestor"].includes(member.memberId) && Boolean(this.#options.personaSessionStore?.(member.memberId));
    const releasePersonaWriter = persistentPersona
      ? await this.#personaWriters.acquire(member.memberId, task.taskId, (state, activeTaskId) => {
        this.#options.recordEvent(`persona_session.writer_${state}`, {
          memberId: member.memberId,
          requestedTaskId: task.taskId,
          activeTaskId,
        }, task.taskId);
      })
      : null;
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
      const connection = this.#createConnection(task, member, "executor", dependencyLease, releasePersonaWriter);
      return new CodexExecutorSession(
        connection,
        this.#options.registry,
        this.#options.resolveAttachmentPaths,
        this.#options.runCodeValidation,
        this.#options.readTaskChangedFiles,
        this.#options.readWorkspaceState,
        this.#options.prompts,
      );
    } catch (error) {
      releaseManagedDependencyLease(dependencyLease);
      releasePersonaWriter?.();
      throw error;
    }
  }

  #createConnection(task: CollaborationTaskOutDto, member: CollaborationMemberOutDto, role: RegisteredConnection["role"], dependencyLease: ManagedDependencyLease | null, releasePersonaWriter: (() => void) | null): RegisteredConnection {
    const persistentSessions = ["han-li", "nangong-wan", "linghu-ancestor"].includes(member.memberId) ? this.#options.personaSessionStore?.(member.memberId) || null : null;
    const connectionId = persistentSessions ? `persona:${member.memberId}` : `${task.taskId}:${role}:${member.memberId}`;
    const sessionPath = path.join(this.#options.sessionRoot, `${safeName(connectionId)}.json`);
    const sessions = persistentSessions || createFileCodexSessionRepository(sessionPath);
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
        readRuleInstructions: this.#options.readRuleInstructionsForMember
          ? () => this.#options.readRuleInstructionsForMember!(member.memberId, task)
          : this.#options.readRuleInstructions,
      },
      (details) => this.#options.recordEvent("collaboration.trusted_command.decision", { connectionId, memberId: member.memberId, role, ...details }, task.taskId),
      (details) => this.#options.recordEvent("collaboration.thread.lifecycle", { connectionId, memberId: member.memberId, role, ...details }, task.taskId),
    );
    const connection = { connectionId, taskId: task.taskId, memberId: member.memberId, memberName: member.displayName, role, service, sessions, dependencyLease, persistentPersona: Boolean(persistentSessions), releasePersonaWriter };
    this.#options.registry.register(connection);
    return connection;
  }
}

class CodexExecutorSession implements ExecutorSessionPort {
  readonly #connection: RegisteredConnection;
  readonly #registry: CollaborationCodexRegistry;
  readonly #resolveAttachmentPaths: CodexCollaborationSessionFactoryOptions["resolveAttachmentPaths"];
  readonly #runCodeValidation: CodexCollaborationSessionFactoryOptions["runCodeValidation"];
  /** 保存工作区只读端口，执行人物不直接依赖 Git 实现。 */
  readonly #readTaskChangedFiles: CodexCollaborationSessionFactoryOptions["readTaskChangedFiles"];
  readonly #readWorkspaceState: CodexCollaborationSessionFactoryOptions["readWorkspaceState"];
  readonly #prompts: PromptLibraryPort;
  readonly #managed: ManagedTaskExecutor;

  constructor(
    connection: RegisteredConnection,
    registry: CollaborationCodexRegistry,
    resolveAttachmentPaths: CodexCollaborationSessionFactoryOptions["resolveAttachmentPaths"],
    runCodeValidation: CodexCollaborationSessionFactoryOptions["runCodeValidation"],
    readTaskChangedFiles: CodexCollaborationSessionFactoryOptions["readTaskChangedFiles"],
    readWorkspaceState: CodexCollaborationSessionFactoryOptions["readWorkspaceState"],
    prompts: PromptLibraryPort,
  ) {
    this.#connection = connection;
    this.#registry = registry;
    this.#resolveAttachmentPaths = resolveAttachmentPaths;
    this.#runCodeValidation = runCodeValidation;
    // 保存真实文件读取端口，首次冻结范围时由 ManagedTaskExecutor 调用。
    this.#readTaskChangedFiles = readTaskChangedFiles;
    this.#readWorkspaceState = readWorkspaceState;
    this.#prompts = prompts;
    this.#managed = new ManagedTaskExecutor(prompts);
  }

  async analyze(task: CollaborationTaskOutDto, emit: (event: CodexStreamEventOutDto) => void): Promise<string> {
    return this.#runRequirement(task, this.#prompts.render("executor.technical-analysis", {
      confirmedIntent: task.snapshot.confirmedIntent,
    }), emit);
  }

  isAlive(): boolean { return this.#connection.service.isAlive(); }

  async optimize(task: CollaborationTaskOutDto, feedback: string, emit: (event: CodexStreamEventOutDto) => void): Promise<string> {
    const currentPlan = task.plans.find((plan) => plan.version === task.currentPlanVersion)?.text || "";
    return this.#runRequirement(task, this.#prompts.render("executor.optimize-analysis", { currentPlan, feedback }), emit);
  }

  async execute(task: CollaborationTaskOutDto, plan: CollaborationRequirementPlanOutDto, emit: (event: CodexStreamEventOutDto) => void): Promise<ExecutorExecutionResultOutDto> {
    return this.#executePlan(task, this.#prompts.render("executor.execution", {
      confirmedIntent: task.snapshot.confirmedIntent,
      planText: plan.text,
    }), emit);
  }

  async #executePlan(task: CollaborationTaskOutDto, message: string, emit: (event: CodexStreamEventOutDto) => void): Promise<ExecutorExecutionResultOutDto> {
    const workspaceState = collaborationWorkspaceState(task, this.#readWorkspaceState?.());
    const attachmentPaths = await this.#resolveAttachmentPaths(task.snapshot.attachmentIds);
    const result = await this.#managed.run({
      mode: "task-managed",
      message,
      restartRequired: false,
      emit,
      runCodeValidation: (authorizedFiles, onEvent) => this.#runCodeValidation(task, authorizedFiles, onEvent),
      // 每次执行会话都绑定当前任务，不允许人物传入其他工作区路径。
      readChangedFiles: () => this.#readTaskChangedFiles(task),
      runTurn: (message, onEvent, mode) => this.#connection.service.send(message, task.snapshot.locale, "workspace-write", workspaceState, attachmentPaths, onEvent, mode),
    });
    let status: ExecutorExecutionResultOutDto["status"] = "incomplete";
    if (result.managedStatus === "code-verified") {
      status = "code-verified";
    }
    return {
      status,
      text: result.text,
      pendingActions: result.pendingActions,
      changedFiles: result.changedFiles,
      authorizedFiles: result.authorizedFiles,
      successfulCommands: result.successfulCommands,
      // 把结构化范围失败传给 Workflow，避免下游重新解析错误文字。
      failureKind: result.failureKind,
    };
  }

  async investigateRepair(task: CollaborationTaskOutDto, failure: string, emit: (event: CodexStreamEventOutDto) => void): Promise<string> {
    return this.#runRequirement(task, this.#prompts.render("executor.repair-investigation", { failure }), emit);
  }

  async executeRepair(task: CollaborationTaskOutDto, diagnosis: CollaborationRepairDiagnosisOutDto, emit: (event: CodexStreamEventOutDto) => void): Promise<ExecutorExecutionResultOutDto> {
    return this.#executePlan(task, this.#prompts.render("executor.repair-execution", {
      repairInstruction: diagnosis.repairInstruction,
      failureStage: diagnosis.failureStage,
      failureSummary: diagnosis.failureSummary,
      technicalEvidence: diagnosis.technicalEvidence.join("\n"),
    }), emit);
  }

  async dispose(): Promise<void> {
    await retireConnection(this.#connection, this.#registry);
  }

  async #runRequirement(task: CollaborationTaskOutDto, message: string, emit: (event: CodexStreamEventOutDto) => void): Promise<string> {
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

export function collaborationWorkspaceState(task: CollaborationTaskOutDto, configured?: WorkspaceStateOutDto): WorkspaceStateOutDto {
  const workspace = task.versionWorkspace;
  const base = configured || task.snapshot.workspaceState;
  if (!workspace) return structuredClone(base);
  // 执行人物只能写自己的任务工作树；主工作区和其他登记工程保留只读调查能力，不能被绝对路径补丁绕过。
  const roots: WorkspaceStateOutDto["roots"] = base.roots
    .filter((root) => path.resolve(root.path) !== path.resolve(workspace.rootPath))
    .map((root) => ({ ...root, permission: "read-only" as const }));
  const originalPrimary = task.snapshot.workspaceState.roots.find((root) => root.id === task.snapshot.workspaceState.primaryId);
  const testRecordPath = originalPrimary
    ? path.join(originalPrimary.path, "OPTION", "temp", "ai-desktop", "执行日志", "待执行", "测试", safeName(task.taskId))
    : null;
  // 测试文档是唯一允许回写主工程的数据；目录收窄到当前任务，不能借此取得主工程源码写权限。
  if (testRecordPath) {
    mkdirSync(testRecordPath, { recursive: true });
    roots.push({ id: `collaboration-test-record-${safeName(task.taskId)}`, name: "当前任务测试记录", path: testRecordPath, permission: "workspace-write" });
  }
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
    // 释放进程连接不删除任务会话；同任务恢复继续原上下文，新任务由任务 ID 隔离。
    connection.service.dispose();
  } finally {
    registry.unregister(connection.connectionId);
    releaseManagedDependencyLease(connection.dependencyLease);
    connection.releasePersonaWriter?.();
  }
}
