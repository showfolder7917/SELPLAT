import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

import type {
  CollaborationMember,
  CollaborationState,
  CollaborationTask,
  CreateCollaborationMemberRequest,
  DesktopOperatingMode,
  SubmitCollaborationTaskRequest,
  UpdateCollaborationMemberRequest,
} from "../../../shared/contracts/collaboration.js";

type StateListener = (state: CollaborationState, reason: string) => void;

const DEFAULT_MEMBERS: ReadonlyArray<{ memberId: string; displayName: string; kind: CollaborationMember["kind"] }> = [
  { memberId: "han-li", displayName: "韩立", kind: "conversation-owner" },
  { memberId: "nangong-wan", displayName: "南宫婉", kind: "worker" },
  { memberId: "zi-ling", displayName: "紫灵", kind: "worker" },
  { memberId: "yuan-yao", displayName: "元瑶", kind: "worker" },
  { memberId: "song-yu", displayName: "宋玉", kind: "worker" },
  { memberId: "ice-soul", displayName: "冰魄仙子", kind: "worker" },
  { memberId: "mo-caihuan", displayName: "墨彩环", kind: "worker" },
  { memberId: "doctor-mo", displayName: "墨大夫", kind: "worker" },
  { memberId: "li-feiyu", displayName: "厉飞雨", kind: "worker" },
  { memberId: "zhang-tie", displayName: "张铁", kind: "worker" },
  { memberId: "linghu-ancestor", displayName: "令狐老祖", kind: "worker" },
  { memberId: "li-huayuan", displayName: "李化元", kind: "worker" },
];

const TERMINAL_TASK_STATES = new Set<CollaborationTask["state"]>(["integrated", "cancelled"]);

/** 持久保存协同人物、任务和恢复点；所有修改都在 Electron 主进程内原子提交。 */
export class CollaborationStore {
  readonly #filePath: string;
  readonly #listeners = new Set<StateListener>();
  #state: CollaborationState;

  constructor(filePath: string) {
    this.#filePath = filePath;
    this.#state = this.#load();
  }

  state(): CollaborationState {
    return structuredClone(this.#state);
  }

  subscribe(listener: StateListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  setMode(mode: DesktopOperatingMode): CollaborationState {
    if (mode !== "single-conversation" && mode !== "collaboration") throw new Error("无效的桌面运行模式。");
    return this.#commit("mode.changed", (state) => { state.mode = mode; });
  }

  selectMember(memberId: string): CollaborationState {
    this.#member(memberId);
    return this.#commit("member.selected", (state) => { state.selectedMemberId = memberId; });
  }

  createMember(request: CreateCollaborationMemberRequest): CollaborationState {
    const displayName = normalizeMemberName(request?.displayName);
    if (this.#state.members.some((member) => member.displayName === displayName)) throw new Error("协同人物名称已存在。");
    const now = new Date().toISOString();
    const member: CollaborationMember = {
      memberId: `member-${randomUUID()}`,
      displayName,
      kind: "worker",
      protected: false,
      enabled: true,
      state: "idle",
      role: null,
      phase: null,
      generation: 0,
      currentTaskId: null,
      blockingReason: null,
      lastHeartbeatAt: null,
      lastProtocolProgressAt: null,
      lastAssignedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    return this.#commit("member.created", (state) => { state.members.push(member); });
  }

  updateMember(memberId: string, request: UpdateCollaborationMemberRequest): CollaborationState {
    const member = this.#member(memberId);
    const displayName = request.displayName === undefined ? member.displayName : normalizeMemberName(request.displayName);
    if (this.#state.members.some((candidate) => candidate.memberId !== memberId && candidate.displayName === displayName)) {
      throw new Error("协同人物名称已存在。");
    }
    if (member.protected && request.enabled === false) throw new Error("韩立是受保护的会话负责人，不能停用。");
    return this.#commit("member.updated", (state) => {
      const target = requireMember(state, memberId);
      target.displayName = displayName;
      if (request.enabled !== undefined) target.enabled = request.enabled;
      target.updatedAt = new Date().toISOString();
    });
  }

  deleteMember(memberId: string): CollaborationState {
    const member = this.#member(memberId);
    if (member.protected) throw new Error("韩立是受保护的会话负责人，不能删除。");
    if (member.currentTaskId || !["idle", "offline"].includes(member.state)) {
      return this.#commit("member.draining", (state) => {
        const target = requireMember(state, memberId);
        target.enabled = false;
        target.state = "draining";
        target.blockingReason = "当前工作结束并释放 Codex 后删除";
        target.updatedAt = new Date().toISOString();
      });
    }
    return this.#commit("member.deleted", (state) => {
      state.members = state.members.filter((candidate) => candidate.memberId !== memberId);
      if (state.selectedMemberId === memberId) state.selectedMemberId = "han-li";
    });
  }

  submitTask(request: SubmitCollaborationTaskRequest): CollaborationTask {
    if (!request || typeof request.confirmedIntent !== "string" || !request.confirmedIntent.trim()) {
      throw new Error("必须提供韩立已经确认的完整任务意图。");
    }
    if (!request.workspaceState?.roots?.length) throw new Error("协同任务至少需要一个已登记工作区。");
    const now = new Date().toISOString();
    const taskId = `collab-${now.replaceAll(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
    const normalizedIntent = request.confirmedIntent.trim().slice(0, 20_000);
    const task: CollaborationTask = {
      taskId,
      taskRevision: 1,
      assignmentId: null,
      workerGeneration: 0,
      state: "queued-executor",
      phase: null,
      executorMemberId: null,
      currentReviewerMemberId: null,
      currentPlanVersion: 0,
      explicitRejectionCount: 0,
      infrastructureFailureCount: 0,
      mergeStrategy: request.mergeStrategy || "INDEPENDENT",
      atomicGroupId: request.atomicGroupId?.trim() || null,
      dependencyTaskIds: [...new Set(request.dependencyTaskIds || [])],
      integrationGeneration: null,
      snapshot: {
        title: request.title.trim().slice(0, 160) || normalizedIntent.slice(0, 80),
        problemStatement: request.problemStatement.trim().slice(0, 8_000),
        confirmedIntent: normalizedIntent,
        constraints: (request.constraints || []).map((item) => item.trim()).filter(Boolean),
        acceptanceCriteria: (request.acceptanceCriteria || []).map((item) => item.trim()).filter(Boolean),
        sourceMessageIds: [...new Set(request.sourceMessageIds || [])],
        attachmentIds: [...new Set(request.attachmentIds || [])],
        workspaceState: structuredClone(request.workspaceState),
        locale: request.locale,
        contentHash: sha256(normalizedIntent),
      },
      plans: [],
      reviews: [],
      versionWorkspace: null,
      finalResult: null,
      blockingReason: null,
      recoveryTargetState: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };
    this.#commit("task.submitted", (state) => { state.tasks.push(task); });
    return structuredClone(task);
  }

  task(taskId: string): CollaborationTask {
    const task = this.#state.tasks.find((candidate) => candidate.taskId === taskId);
    if (!task) throw new Error("协同任务不存在。");
    return structuredClone(task);
  }

  updateTask(taskId: string, reason: string, update: (task: CollaborationTask, state: CollaborationState) => void): CollaborationState {
    this.task(taskId);
    return this.#commit(reason, (state) => {
      const task = state.tasks.find((candidate) => candidate.taskId === taskId);
      if (!task) throw new Error("协同任务不存在。");
      update(task, state);
      task.updatedAt = new Date().toISOString();
    });
  }

  cancelTask(taskId: string): CollaborationState {
    return this.updateTask(taskId, "task.cancelled", (task, state) => {
      task.state = "cancelled";
      task.phase = null;
      task.blockingReason = "用户取消任务";
      task.recoveryTargetState = null;
      task.completedAt = new Date().toISOString();
      releaseTaskMembers(state, taskId);
    });
  }

  continueTask(taskId: string): CollaborationState {
    return this.updateTask(taskId, "task.recovery_requested", (task, state) => {
      if (task.state !== "recovering" && task.state !== "blocked") throw new Error("当前任务不需要恢复。");
      releaseTaskMembers(state, taskId);
      if (task.versionWorkspace?.resultSha) {
        task.state = "ready-for-integration";
        task.recoveryTargetState = null;
      } else {
        task.state = "queued-executor";
        task.currentReviewerMemberId = null;
        task.assignmentId = null;
      }
      task.phase = null;
      task.blockingReason = null;
    });
  }

  #member(memberId: string): CollaborationMember {
    return structuredClone(requireMember(this.#state, memberId));
  }

  #commit(reason: string, mutate: (state: CollaborationState) => void): CollaborationState {
    const next = structuredClone(this.#state);
    mutate(next);
    next.updatedAt = new Date().toISOString();
    this.#write(next);
    this.#state = next;
    const snapshot = this.state();
    for (const listener of this.#listeners) listener(snapshot, reason);
    return snapshot;
  }

  #load(): CollaborationState {
    let loaded: CollaborationState | null = null;
    try {
      const value = JSON.parse(readFileSync(this.#filePath, "utf8")) as CollaborationState;
      if (value.version === 1 && Array.isArray(value.members) && Array.isArray(value.tasks)) loaded = value;
    } catch {
      // 首次启动或损坏状态都从稳定默认人物集合恢复，后续写入仍采用原子替换。
    }
    const state = loaded || createInitialState();
    mergeDefaultMembers(state);
    recoverInterruptedState(state);
    this.#write(state);
    return state;
  }

  #write(state: CollaborationState): void {
    mkdirSync(path.dirname(this.#filePath), { recursive: true });
    const temporary = `${this.#filePath}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    renameSync(temporary, this.#filePath);
  }
}

function createInitialState(): CollaborationState {
  const now = new Date().toISOString();
  return {
    version: 1,
    mode: "single-conversation",
    selectedMemberId: "han-li",
    members: DEFAULT_MEMBERS.map((member) => createDefaultMember(member, now)),
    tasks: [],
    integrationBatches: [],
    nextIntegrationGeneration: 1,
    updatedAt: now,
  };
}

function createDefaultMember(member: (typeof DEFAULT_MEMBERS)[number], now: string): CollaborationMember {
  const owner = member.kind === "conversation-owner";
  return {
    ...member,
    protected: owner,
    enabled: true,
    state: owner ? "conversation" : "idle",
    role: owner ? "conversation" : null,
    phase: null,
    generation: owner ? 1 : 0,
    currentTaskId: null,
    blockingReason: null,
    lastHeartbeatAt: null,
    lastProtocolProgressAt: null,
    lastAssignedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function mergeDefaultMembers(state: CollaborationState): void {
  const now = new Date().toISOString();
  for (const item of DEFAULT_MEMBERS) {
    if (!state.members.some((member) => member.memberId === item.memberId)) state.members.push(createDefaultMember(item, now));
  }
  for (const member of state.members) {
    member.lastHeartbeatAt ??= null;
    member.lastProtocolProgressAt ??= null;
  }
  for (const task of state.tasks) task.recoveryTargetState ??= null;
  if (!state.members.some((member) => member.memberId === state.selectedMemberId)) state.selectedMemberId = "han-li";
}

function recoverInterruptedState(state: CollaborationState): void {
  const interruptedTaskIds = new Set<string>();
  for (const task of state.tasks) {
    if (TERMINAL_TASK_STATES.has(task.state) || task.state === "queued-executor" || task.state === "ready-for-integration") continue;
    task.recoveryTargetState ??= task.state;
    task.state = "recovering";
    task.phase = null;
    task.blockingReason = "应用重建后等待继续执行";
    task.updatedAt = new Date().toISOString();
    interruptedTaskIds.add(task.taskId);
  }
  for (const batch of state.integrationBatches) {
    if (batch.state === "frozen" || batch.state === "integrating" || batch.state === "verified") {
      batch.state = "failed";
      batch.completedAt = new Date().toISOString();
      batch.failureReason = "应用重建中断集成，等待用户恢复";
    }
  }
  for (const member of state.members) {
    if (member.protected) continue;
    if (member.currentTaskId && interruptedTaskIds.has(member.currentTaskId)) {
      member.state = "recovering";
      member.phase = null;
      member.blockingReason = "原 Codex 已关闭，等待恢复任务";
      member.lastHeartbeatAt = null;
      member.lastProtocolProgressAt = null;
    } else if (member.state !== "draining") {
      member.state = "idle";
      member.role = null;
      member.phase = null;
      member.currentTaskId = null;
      member.blockingReason = null;
      member.lastHeartbeatAt = null;
      member.lastProtocolProgressAt = null;
    }
    member.updatedAt = new Date().toISOString();
  }
}

function releaseTaskMembers(state: CollaborationState, taskId: string): void {
  const deleteMemberIds = new Set<string>();
  for (const member of state.members.filter((candidate) => candidate.currentTaskId === taskId)) {
    if ((member.state === "draining" || !member.enabled) && !member.protected) {
      deleteMemberIds.add(member.memberId);
      continue;
    }
    member.currentTaskId = null;
    member.role = null;
    member.phase = null;
    member.blockingReason = null;
    member.lastHeartbeatAt = null;
    member.lastProtocolProgressAt = null;
    member.state = member.state === "draining" ? "draining" : "idle";
    member.updatedAt = new Date().toISOString();
  }
  if (deleteMemberIds.size > 0) {
    state.members = state.members.filter((member) => !deleteMemberIds.has(member.memberId));
    if (deleteMemberIds.has(state.selectedMemberId)) state.selectedMemberId = "han-li";
  }
}

function requireMember(state: CollaborationState, memberId: string): CollaborationMember {
  const member = state.members.find((candidate) => candidate.memberId === memberId);
  if (!member) throw new Error("协同人物不存在。");
  return member;
}

function normalizeMemberName(value: string): string {
  const name = typeof value === "string" ? value.trim().slice(0, 40) : "";
  if (!name) throw new Error("人物名称不能为空。");
  return name;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
