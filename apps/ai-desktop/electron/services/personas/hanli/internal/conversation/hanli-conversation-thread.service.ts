import type { AsyncCollaborationMemoryPort } from "../../../../../../contracts/services/support/capabilities/event-center/index.js";

/** 已完成条件认领的线程租约；仅本次创建的租约允许失败补偿。 */
export interface HanliConversationThreadLease {
  threadId: string;
  workspaceSignature: string;
  createdByRequest: boolean;
}

/** 普通韩立会话使用的最小 Codex 线程端口。 */
export interface HanliConversationThreadCodexPort {
  startDetachedConversationSession(): Promise<{ threadId: string; workspaceSignature: string }>;
  activateConversationSession(session: { threadId: string; workspaceSignature: string }): void;
  deleteDetachedConversationSession(threadId: string): Promise<void>;
  recoverConversationSession(session: { threadId: string; workspaceSignature: string }): Promise<{ status: string; successorThreadId?: string | null; summary: string } | undefined>;
}

/** 以业务会话为边界串行认领线程，避免不同窗口把人物级缓存误当作归属事实。 */
export class HanliConversationThreadService {
  readonly #pendingByConversation = new Map<string, Promise<unknown>>();

  constructor(
    private readonly memory: AsyncCollaborationMemoryPort,
    private readonly chat: HanliConversationThreadCodexPort,
  ) {}

  /** 读取既有绑定或创建并条件认领本次线程；模型发送前必须成功返回租约。 */
  ensure(ownerPersonaId: string, conversationId: string): Promise<HanliConversationThreadLease> {
    const key = `${ownerPersonaId}:${conversationId}`;
    const previous = this.#pendingByConversation.get(key) || Promise.resolve();
    const current = previous.catch(() => undefined).then(() => this.#ensure(ownerPersonaId, conversationId));
    this.#pendingByConversation.set(key, current);
    return current.finally(() => {
      if (this.#pendingByConversation.get(key) === current) this.#pendingByConversation.delete(key);
    });
  }

  /** 在同一业务会话内串行执行认领后的完整模型回合，防止不同消息互相取消 turn。 */
  run<T>(ownerPersonaId: string, conversationId: string, action: (lease: HanliConversationThreadLease) => Promise<T>): Promise<T> {
    const key = `${ownerPersonaId}:${conversationId}`;
    const previous = this.#pendingByConversation.get(key) || Promise.resolve();
    const current = previous.catch(() => undefined).then(async () => {
      const lease = await this.#ensure(ownerPersonaId, conversationId);
      try {
        return await action(lease);
      } catch (error) {
        try {
          await this.compensate(ownerPersonaId, conversationId, lease);
        } catch (cleanupError) {
          throw new Error(`${error instanceof Error ? error.message : String(error)}；${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`);
        }
        throw error;
      }
    });
    this.#pendingByConversation.set(key, current);
    return current.finally(() => {
      if (this.#pendingByConversation.get(key) === current) this.#pendingByConversation.delete(key);
    });
  }

  /** 只有本次成功认领的线程才会被补偿；既有及 archived 绑定永远不回收。 */
  async compensate(ownerPersonaId: string, conversationId: string, lease: HanliConversationThreadLease): Promise<void> {
    if (!lease.createdByRequest) return;
    const current = await this.memory.readPersonaConversationCodexThread(ownerPersonaId, conversationId);
    if (!current || current.threadId !== lease.threadId) return;
    // 先精确解除本地归属：解绑失败时绝不能删除仍被当前会话指向的远端线程。
    const unlinked = await this.memory.unlinkPersonaConversationCodexThread({ ownerPersonaId, conversationId, threadId: lease.threadId });
    // 并发切换或归档已改变绑定时，本次请求不再拥有清理权。
    if (!unlinked) return;
    // 删除失败会向上保留原始错误；绑定已解除，后续重试可以安全认领新线程。
    await this.chat.deleteDetachedConversationSession(lease.threadId);
  }

  async #ensure(ownerPersonaId: string, conversationId: string): Promise<HanliConversationThreadLease> {
    const bound = await this.memory.readPersonaConversationCodexThread(ownerPersonaId, conversationId);
    if (bound) return this.#activateBound(bound);

    const created = await this.chat.startDetachedConversationSession();
    const claimed = await this.memory.claimPersonaConversationCodexThread({
      ownerPersonaId, conversationId, threadId: created.threadId,
      workspaceSignature: created.workspaceSignature, occurredAt: new Date().toISOString(),
    });
    if (claimed) {
      this.chat.activateConversationSession(created);
      return { ...created, createdByRequest: true };
    }

    try {
      await this.chat.deleteDetachedConversationSession(created.threadId);
    } catch (error) {
      throw new Error(`会话线程认领未获胜，且本次创建的线程未能回收：${error instanceof Error ? error.message : String(error)}`);
    }
    const winner = await this.memory.readPersonaConversationCodexThread(ownerPersonaId, conversationId);
    if (!winner) throw new Error("会话在认领期间已切换或归档，未向旧会话发送消息。");
    return this.#activateBound(winner);
  }

  async #activateBound(bound: { threadId: string; workspaceSignature: string }): Promise<HanliConversationThreadLease> {
    const recovery = await this.chat.recoverConversationSession(bound);
    if (!recovery || recovery.status !== "verified" || !recovery.successorThreadId) {
      throw new Error(recovery?.summary || "无法恢复当前会话已认领的 Codex 线程。");
    }
    const session = { threadId: recovery.successorThreadId, workspaceSignature: bound.workspaceSignature };
    this.chat.activateConversationSession(session);
    return { ...session, createdByRequest: false };
  }
}
