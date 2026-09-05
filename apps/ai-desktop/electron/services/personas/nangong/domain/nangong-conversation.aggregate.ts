import type { EvolutionStateOutDto } from "../../../../../contracts/services/evolution/index.js";
import type {
  NangongConversationActionValue,
  NangongConversationSnapshotValue,
} from "../../../../../contracts/services/personas/nangong/index.js";

/**
 * 南宫婉会话聚合根。
 *
 * 它把当前会话、待确认邀请和一次性运行收敛成一个可读对象，应用服务不再
 * 在多个局部变量之间重复判断同一状态。聚合根只作确定性业务判断，不发送
 * Codex 消息，也不直接修改 Evolution 状态。
 */
export class NangongConversationAggregate {
  /** 当前会话和运行事实的不可变快照；每次处理用户消息前从 Store 重新恢复。 */
  readonly #snapshot: NangongConversationSnapshotValue;

  /** 使用已经验证的会话快照建立聚合根；构造过程没有持久化副作用。 */
  private constructor(snapshot: NangongConversationSnapshotValue) {
    this.#snapshot = snapshot;
  }

  /**
   * 从 Evolution 权威状态恢复南宫婉会话属性。
   * 真实传参示例：包含 active conversation 和 running oneShotRun 的 version=8 状态。
   * 真实返回示例：返回可判断独立 1、旧邀请和活动运行的会话聚合根。
   * 异常或副作用示例：本方法不写数据库；缺失可选运行事实时统一保存为 null。
   */
  static restore(state: EvolutionStateOutDto): NangongConversationAggregate {
    const confirmation = state.oneShotConfirmation;
    const run = state.oneShotRun;
    const snapshot: NangongConversationSnapshotValue = {
      conversationId: state.conversation.conversationId,
      messageCount: state.conversation.messages.length,
      pendingInvitationMessageId: confirmation?.invitationMessageId || null,
      pendingInvitationConversationId: confirmation?.conversationId || null,
      activeRunId: run?.runId || null,
      activeRunStatus: run?.status || null,
      activeRunAction: run?.action || null,
    };
    return new NangongConversationAggregate(snapshot);
  }

  /** 当前会话已经保存的消息数量；草稿服务据此拒绝整理空会话。 */
  messageCount(): number {
    return this.#snapshot.messageCount;
  }

  /**
   * 把一条用户输入归并为唯一会话动作。
   * 真实传参示例：message="1"、topicId=null、activeRunHasLiveOwner=true。
   * 真实返回示例：已有活动运行时返回 report-active-run，不重复启动。
   * 异常或副作用示例：空白或普通消息返回 continue-conversation；不会修改 Store。
   */
  decideUserMessage(message: string, topicId: string | null, activeRunHasLiveOwner: boolean): NangongConversationActionValue {
    const normalizedMessage = message.trim();
    if (normalizedMessage !== "1") {
      return this.#action("continue-conversation", topicId);
    }

    const invitationBelongsToCurrentConversation = Boolean(
      this.#snapshot.pendingInvitationMessageId
      && this.#snapshot.pendingInvitationConversationId
      && this.#snapshot.pendingInvitationConversationId === this.#snapshot.conversationId,
    );
    if (!invitationBelongsToCurrentConversation) {
      return this.#action("reject-missing-confirmation", topicId);
    }

    const hasRunningEvolution = this.#snapshot.activeRunStatus === "running";
    if (hasRunningEvolution && activeRunHasLiveOwner) {
      return this.#action("report-active-run", topicId);
    }
    if (hasRunningEvolution) {
      return this.#action("retire-orphan-and-start", topicId);
    }
    return this.#action("start-confirmed-evolution", topicId);
  }

  /** 使用当前快照补齐动作携带的活动运行信息，避免应用服务重新读取零散字段。 */
  #action(kind: NangongConversationActionValue["kind"], topicId: string | null): NangongConversationActionValue {
    return {
      kind,
      topicId,
      activeRunId: this.#snapshot.activeRunId,
      activeRunAction: this.#snapshot.activeRunAction,
    };
  }
}
