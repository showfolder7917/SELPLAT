// 从事件中心读取人物会话与记忆端口，验收交接不依赖具体数据库实现。
import type { CollaborationMemoryPort } from "../../../../../contracts/services/support/capabilities/event-center/index.js";
// 从人物会话契约读取回显对象。
import type { PersonaConversationOutDto } from "../../../../../contracts/services/personas/conversation/index.js";
// 从 Workflow 契约读取类型化时间线事实。
import type { CollaborationTimelineBusinessEventOutDto } from "../../../../../contracts/services/workflow/index.js";
// 从 Evolution 模块读取最小状态端口，避免反向依赖整个 Runtime 配置。
import type { EvolutionStatePort } from "../../../evolution/index.js";
import type { EvolutionProposalOutDto } from "../../../../../contracts/services/evolution/index.js";

/** 验收交接服务需要的最小外部端口。 */
export interface AcceptanceHandoffOptions {
  /** Evolution 状态读取端口，用于定位提案所属专题。 */
  store: EvolutionStatePort;
  /** 类型化时间线发布端口；未配置时只保存人物会话事实。 */
  recordTimelineEvent?: (event: CollaborationTimelineBusinessEventOutDto) => void;
  /** 人物会话记忆端口；数据库不可用时允许为空。 */
  memory?: CollaborationMemoryPort | null;
  /** 读取当前韩立会话标识，验收消息必须回到同一用户会话。 */
  readHanliConversationId?: () => string | null;
  /** 人物会话变化通知端口，用于刷新已提交的界面消息。 */
  onPersonaConversationChanged?: (conversation: PersonaConversationOutDto) => void;
}

/** 只投递真实验收阶段的交接事实；不执行验收、不读取页面状态、不作通过判断。 */
export class AcceptanceHandoffService {
  /** 使用最小交接端口创建服务，不持有 PersonaEvolutionRuntime。 */
  constructor(private readonly options: AcceptanceHandoffOptions) {}

  publish(proposal: EvolutionProposalOutDto, phase: "received" | "started" | "passed" | "failed", content: string, attemptId = proposal.proposalId): void {
    const topic = this.options.store.state().topics.find((item) => item.topicId === proposal.topicId);
    if (!topic) throw new Error("验收交接缺少专题");
    const now = new Date().toISOString();
    const received = phase === "received";
    const current = phase === "started";
    const completed = phase === "passed";
    const failed = phase === "failed";
    const actor = received ? { memberId: "nangong-wan", displayName: "南宫婉" } : { memberId: "han-li", displayName: "韩立" };
    const recipient = received ? { memberId: "han-li", displayName: "韩立" } : { memberId: "nangong-wan", displayName: "南宫婉" };
    const id = `acceptance:${proposal.proposalId}:${attemptId}:${phase}`;
    this.options.recordTimelineEvent?.({ eventId: id, eventType: `acceptance.${phase}`,
      group: { groupId: `topic:${topic.topicId}`, topicId: topic.topicId, proposalId: proposal.proposalId, title: topic.title, status: completed ? "completed" : failed ? "blocked" : "verifying", summary: content, startedAt: topic.createdAt, updatedAt: now },
      fact: { nodeId: `acceptance:${proposal.proposalId}:${attemptId}:${received ? "received" : "run"}`, taskId: null, proposalId: proposal.proposalId, sourceFactKey: id, kind: "verification", actor, recipients: [recipient], status: current ? "current" : phase === "failed" ? "failed" : "completed", action: received ? "已接收令狐结果，提交韩立验收" : current ? "正在真实操作验收" : completed ? "验收通过，结果已返回" : "验收未通过或未验证", summary: content, contentRole: "analysis-output", content, detailRole: "result-evidence", detail: content, startedAt: now, completedAt: current ? null : now, automaticOpen: current, manualApprovalProposalId: null, occurredAt: now },
    });
    const memory = this.options.memory;
    if (!memory) return;
    for (const owner of ["han-li", "nangong-wan"]) {
      const conversationId = owner === "han-li" ? this.options.readHanliConversationId?.() : memory.readPersonaConversation(owner).conversationId;
      if (!conversationId) continue;
      // 数据库消息主键全局唯一，同一交接事件必须显式区分收件人物。
      const messageId = `internal:${id}:${owner}:${received ? "question" : "answer"}`;
      const conversation = memory.appendPersonaInternalMessage({ ownerPersonaId: owner, conversationId, messageId, speakerPersonaId: actor.memberId, content, replyToMessageId: received ? null : `internal:acceptance:${proposal.proposalId}:${attemptId}:received:${owner}:question`, createdAt: now });
      this.options.onPersonaConversationChanged?.(conversation);
      if (owner === "han-li" && (phase === "passed" || failed)) {
        const result = memory.appendPersonaInternalMessage({ ownerPersonaId: "han-li", conversationId, messageId: `hanli-result:${proposal.proposalId}:${attemptId}:${phase}`, speakerPersonaId: "han-li", content: `“${topic.title}”的验收结果：\n\n${content}`, createdAt: now });
        this.options.onPersonaConversationChanged?.(result);
      }
    }
  }
}
