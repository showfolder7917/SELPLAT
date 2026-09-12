import type { PersonaConversationOutDto } from "../../../contracts/services/personas/conversation/index.js";
import type { EvolutionStateOutDto } from "../../../contracts/services/evolution/index.js";
import type { CollaborationStateOutDto, CollaborationTimelineSnapshotOutDto, DesktopOperatingModeValue } from "../../../contracts/services/workflow/index.js";

type IsolatedAcceptanceScenario = "empty-task-group" | "failure-recovery-timeline";

const scenarioTaskId = "acceptance-failure-recovery-task";
const scenarioTopicId = "acceptance-failure-recovery-topic";
const scenarioProposalId = "acceptance-failure-recovery-proposal";
const hanli = { memberId: "han-li", displayName: "韩立" };
const linghu = { memberId: "linghu-laozu", displayName: "令狐老祖" };

/**
 * 为独立验收窗口保存最小、非持久化运行态。
 *
 * 该会话只覆盖登记的 webContents；正式窗口仍读取和写入正式协作状态。
 */
export class AcceptanceEmptyTaskGroupSession {
  #scenarios = new Map<number, IsolatedAcceptanceScenario>();
  #selectedMembers = new Map<number, string>();
  #operatingModes = new Map<number, DesktopOperatingModeValue>();

  register(webContentsId: number, sceneKind: IsolatedAcceptanceScenario = "empty-task-group"): void {
    this.#scenarios.set(webContentsId, sceneKind);
    this.#selectedMembers.set(webContentsId, "han-li");
    this.#operatingModes.set(webContentsId, "collaboration");
  }

  remove(webContentsId: number): void {
    this.#scenarios.delete(webContentsId);
    this.#selectedMembers.delete(webContentsId);
    this.#operatingModes.delete(webContentsId);
  }

  isActive(webContentsId: number): boolean {
    return this.#scenarios.has(webContentsId);
  }

  collaborationState(webContentsId: number, actual: CollaborationStateOutDto): CollaborationStateOutDto {
    return {
      ...actual,
      mode: this.#operatingModes.get(webContentsId) || "collaboration",
      selectedMemberId: this.#selectedMembers.get(webContentsId) || "han-li",
      // 独立验收只能查看真实成员入口，不能读取或改变正式任务与集成批次。
      tasks: [],
      integrationBatches: [],
      updatedAt: new Date().toISOString(),
    };
  }

  /** 模式只属于该验收窗口的导航状态，不写入正式协作 Store。 */
  setMode(webContentsId: number, mode: DesktopOperatingModeValue, actual: CollaborationStateOutDto): CollaborationStateOutDto {
    if (mode !== "single-conversation" && mode !== "collaboration") throw new Error("无效的桌面运行模式。");
    this.#operatingModes.set(webContentsId, mode);
    return this.collaborationState(webContentsId, actual);
  }

  selectMember(webContentsId: number, memberId: string, actual: CollaborationStateOutDto): CollaborationStateOutDto {
    if (!actual.members.some((member) => member.memberId === memberId)) throw new Error("独立验收会话不包含该协作成员。");
    this.#selectedMembers.set(webContentsId, memberId);
    return this.collaborationState(webContentsId, actual);
  }

  timeline(webContentsId?: number): CollaborationTimelineSnapshotOutDto {
    if (webContentsId !== undefined && this.#scenarios.get(webContentsId) === "failure-recovery-timeline") return failureRecoveryTimeline();
    return { version: 1, groups: [], updatedAt: new Date().toISOString() };
  }

  evolutionState(actual: EvolutionStateOutDto): EvolutionStateOutDto {
    return { ...actual, activeTopicId: null, topics: [], proposals: [], deliberations: [], archiveRecords: [], oneShotConfirmation: null, oneShotRun: null, currentTopicStage: undefined, updatedAt: new Date().toISOString() };
  }

  conversation(personaId: string, actual: PersonaConversationOutDto): PersonaConversationOutDto {
    return { ...actual, ownerPersonaId: personaId, conversationId: null, messages: [], activity: undefined, contextReadStats: undefined, updatedAt: new Date().toISOString() };
  }

  rejectMutation(): never {
    throw new Error("独立验收会话为只读，不能修改正式协作数据或人物会话。");
  }
}

/** 失败恢复场景只投影可审计事实；它不创建任务、不提交恢复，也不读取正式专题。 */
function failureRecoveryTimeline(): CollaborationTimelineSnapshotOutDto {
  const now = new Date().toISOString();
  const node = (nodeId: string, eventType: string, kind: "verification" | "repair", status: "completed" | "waiting" | "failed", action: string, summary: string, content: string, detail: string, detailRole: "verification-evidence" | "result-evidence" | "recovery-conditions") => ({
    nodeId, taskId: scenarioTaskId, eventType, kind, actor: kind === "repair" ? linghu : hanli, recipients: [], status, action, summary, content, detailRole, detail,
    contentRole: kind === "repair" ? "repair-output" as const : "verification-output" as const, startedAt: now, completedAt: status === "waiting" ? null : now, durationMs: 0, automaticOpen: status !== "completed", manualApprovalProposalId: null,
  });
  return {
    version: 1, updatedAt: now, groups: [{
      groupId: scenarioTopicId, topicId: scenarioTopicId, proposalId: scenarioProposalId, title: "失败与恢复详情验收场景", status: "blocked",
      summary: "等待核对失败详情与恢复条件", executingCount: 0, verifyingCount: 0, waitingCount: 1, completedCount: 2,
      startedAt: now, updatedAt: now, durationMs: 0, nextStep: "查看恢复条件", failureNextStep: "确认恢复条件后继续执行", nextOwner: linghu,
      nodes: [
        node("acceptance:failure", "unified_test.failed", "verification", "failed", "统一测试发现失败", "候选差异检查失败", "本批候选发现 trailing whitespace。", "失败原因：candidate.txt:1: trailing whitespace\n位置：候选差异检查\n影响：统一测试未通过，候选不能发布。", "verification-evidence"),
        node("acceptance:investigation", "unified_test.repair_investigated", "repair", "completed", "调查失败根因", "已完成根因调查", "令狐已定位异常输出未被保留。", "调查：Git 校验的 stdout 未进入统一错误。\n修复：统一 Git 入口保留 stdout、stderr 与命令上下文。\n测试：候选差异回归测试通过。", "result-evidence"),
        node("acceptance:recovery", "task.interrupted", "repair", "waiting", "等待恢复操作", "等待继续执行", "恢复入口仅用于验证可达性。", "恢复标识：等待令狐继续执行。\n恢复条件：确认修复结果后重新统一测试。\n本场景为只读，不会提交恢复或修改正式任务。", "recovery-conditions"),
      ],
    }],
  };
}
