import type { PersonaConversationOutDto } from "../../../contracts/services/personas/conversation/index.js";
import type { EvolutionStateOutDto } from "../../../contracts/services/evolution/index.js";
import type { CollaborationStateOutDto, CollaborationTimelineSnapshotOutDto } from "../../../contracts/services/workflow/index.js";

/**
 * 为需要验证任务协作群空状态的独立窗口保存最小运行态。
 *
 * 该会话只覆盖登记的 webContents；正式窗口仍读取和写入正式协作状态。
 */
export class AcceptanceEmptyTaskGroupSession {
  #webContentsIds = new Set<number>();
  #selectedMembers = new Map<number, string>();

  register(webContentsId: number): void {
    this.#webContentsIds.add(webContentsId);
    this.#selectedMembers.set(webContentsId, "han-li");
  }

  remove(webContentsId: number): void {
    this.#webContentsIds.delete(webContentsId);
    this.#selectedMembers.delete(webContentsId);
  }

  isActive(webContentsId: number): boolean {
    return this.#webContentsIds.has(webContentsId);
  }

  collaborationState(webContentsId: number, actual: CollaborationStateOutDto): CollaborationStateOutDto {
    return {
      ...actual,
      selectedMemberId: this.#selectedMembers.get(webContentsId) || "han-li",
      // 独立验收只能查看真实成员入口，不能读取或改变正式任务与集成批次。
      tasks: [],
      integrationBatches: [],
      updatedAt: new Date().toISOString(),
    };
  }

  selectMember(webContentsId: number, memberId: string, actual: CollaborationStateOutDto): CollaborationStateOutDto {
    if (!actual.members.some((member) => member.memberId === memberId)) {
      throw new Error("独立验收会话不包含该协作成员。");
    }
    this.#selectedMembers.set(webContentsId, memberId);
    return this.collaborationState(webContentsId, actual);
  }

  timeline(): CollaborationTimelineSnapshotOutDto {
    return { version: 1, groups: [], updatedAt: new Date().toISOString() };
  }

  evolutionState(actual: EvolutionStateOutDto): EvolutionStateOutDto {
    return {
      ...actual,
      activeTopicId: null,
      topics: [],
      proposals: [],
      deliberations: [],
      archiveRecords: [],
      oneShotConfirmation: null,
      oneShotRun: null,
      currentTopicStage: undefined,
      updatedAt: new Date().toISOString(),
    };
  }

  conversation(personaId: string, actual: PersonaConversationOutDto): PersonaConversationOutDto {
    return {
      ...actual,
      ownerPersonaId: personaId,
      conversationId: null,
      messages: [],
      activity: undefined,
      contextReadStats: undefined,
      updatedAt: new Date().toISOString(),
    };
  }

  rejectMutation(): never {
    throw new Error("独立空状态验收会话为只读，不能修改正式协作数据或人物会话。");
  }
}
