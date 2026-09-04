import type { PersonaEvolutionRuntimeOptions } from "./persona-evolution.runtime.js";
import type { EvolutionProposalOutDto } from "../../../../contracts/services/evolution/index.js";

/** 只投递真实验收阶段的交接事实；不执行验收、不读取页面状态、不作通过判断。 */
export class AcceptanceHandoffService {
  constructor(private readonly options: PersonaEvolutionRuntimeOptions) {}

  publish(proposal: EvolutionProposalOutDto, phase: "received" | "started" | "passed" | "failed", content: string): void {
    const topic = this.options.store.state().topics.find((item) => item.topicId === proposal.topicId);
    if (!topic) throw new Error("验收交接缺少专题");
    const now = new Date().toISOString();
    const received = phase === "received";
    const current = phase === "started";
    const completed = phase === "passed";
    const actor = received ? { memberId: "nangong-wan", displayName: "南宫婉" } : { memberId: "han-li", displayName: "韩立" };
    const recipient = received ? { memberId: "han-li", displayName: "韩立" } : { memberId: "nangong-wan", displayName: "南宫婉" };
    const id = `acceptance:${proposal.proposalId}:${phase}`;
    this.options.recordTimelineEvent?.({ eventId: id, eventType: `acceptance.${phase}`,
      group: { groupId: `topic:${topic.topicId}`, topicId: topic.topicId, proposalId: proposal.proposalId, title: topic.title, status: completed ? "completed" : phase === "failed" ? "blocked" : "verifying", summary: content, startedAt: topic.createdAt, updatedAt: now },
      fact: { nodeId: `acceptance:${proposal.proposalId}:${received ? "received" : "run"}`, taskId: null, proposalId: proposal.proposalId, sourceFactKey: id, kind: "verification", actor, recipients: [recipient], status: current ? "current" : phase === "failed" ? "failed" : "completed", action: received ? "已接收令狐结果，提交韩立验收" : current ? "正在真实操作验收" : completed ? "验收通过，结果已返回" : "验收未通过或未验证", summary: content, contentRole: "analysis-output", content, detailRole: "result-evidence", detail: content, startedAt: now, completedAt: current ? null : now, automaticOpen: current, manualApprovalProposalId: null, occurredAt: now },
    });
    const memory = this.options.memory;
    const conversationId = this.options.readHanliConversationId?.();
    if (!memory || !conversationId) return;
    const messageId = `internal:${id}:${received ? "question" : "answer"}`;
    const conversation = memory.appendPersonaInternalMessage({ ownerPersonaId: "han-li", conversationId, messageId, speakerPersonaId: actor.memberId, content, replyToMessageId: received ? null : `internal:acceptance:${proposal.proposalId}:received:question`, createdAt: now });
    this.options.onPersonaConversationChanged?.(conversation);
    if (phase === "passed" || phase === "failed") {
      const result = memory.appendPersonaInternalMessage({ ownerPersonaId: "han-li", conversationId, messageId: `hanli-result:${proposal.proposalId}:${phase}`, speakerPersonaId: "han-li", content: `“${topic.title}”的验收结果：\n\n${content}`, createdAt: now });
      this.options.onPersonaConversationChanged?.(result);
    }
  }
}
