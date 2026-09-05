import type { CollaborationTimelineBusinessEventOutDto, WorkflowExceptionRecordOutDto } from "../../../../contracts/services/workflow/index.js";
import type { CollaborationMemoryPort } from "../../../../contracts/services/support/capabilities/event-center/index.js";
import type { PersonaConversationOutDto } from "../../../../contracts/services/personas/conversation/index.js";
import type { CheckpointState } from "./checkpoint-state.js";

export interface CheckpointHandoffOptions {
  memory: CollaborationMemoryPort | null;
  publish(event: CollaborationTimelineBusinessEventOutDto): void;
  changed(conversation: PersonaConversationOutDto): void;
  name(memberId: string): string;
  topic(topicId: string | null): { title: string; createdAt: string; completed: boolean } | null;
}

/** 交接投影只记录已经发生的动作；双方会话使用同一事件标识，重放不重复追加。 */
export class CheckpointHandoffService {
  constructor(private readonly options: CheckpointHandoffOptions) {}

  publish(event: WorkflowExceptionRecordOutDto, checkpoint: CheckpointState, phase: string, content: string): void {
    const now = new Date().toISOString();
    const id = `checkpoint:${event.eventId}:${checkpoint.round}:${phase}`;
    const source = checkpoint.sourceMemberId;
    const actorId = phase === "reported" ? source : phase === "resolved" ? source : "linghu-ancestor";
    const participants = [...new Set([source, "nangong-wan", "linghu-ancestor"])];
    const actor = { memberId: actorId, displayName: this.options.name(actorId) };
    const recipients = participants.filter((id) => id !== actorId).map((memberId) => ({ memberId, displayName: this.options.name(memberId) }));
    const title = `第 ${checkpoint.round} 轮卡点处理`;
    const topic = this.options.topic(checkpoint.topicId);
    const action = ({ reported: "卡点已上报", received: "令狐已接收卡点", repairing: "调查修复任务已派发", testing: "修复已提交测试", returned: "修复结果已返回", resuming: "已交回原步骤继续验证", resolved: "原流程已验证卡点解除", waiting: "卡点待处理", exhausted: "修复轮次已用尽，等待新事实" } as Record<string, string>)[phase] || "卡点进展";
    const sourcePhase = checkpoint.sourcePhase || (typeof event.payload?.phase === "string" ? event.payload.phase : "未知节点");
    const recoveryPoint = checkpoint.recoveryPoint || (typeof event.payload?.recoveryPoint === "string" ? event.payload.recoveryPoint : "未确认");
    const proposalId = checkpoint.proposalId || (typeof event.payload?.proposalId === "string" ? event.payload.proposalId : null);
    const runId = checkpoint.runId || (typeof event.payload?.runId === "string" ? event.payload.runId : null);
    const readableContent = [
      `发生位置：${sourcePhase}`,
      `遇到的问题：${checkpoint.issue || event.message}`,
      `流程影响：${checkpoint.blockedImpact || "原流程尚不能继续。"}`,
      `修复目标：${checkpoint.repairGoal || "解除阻塞并回到原节点复验。"}`,
      checkpoint.investigation ? `调查结论：${checkpoint.investigation}` : "",
      checkpoint.repairResult ? `修复结果：${checkpoint.repairResult}` : "",
      checkpoint.testResult ? `测试结果：${checkpoint.testResult}` : "",
      `当前进展：${content}`,
    ].filter(Boolean).join("\n");
    const recoveryDetail = [
      `原始事件：${event.eventId}`,
      `原专题：${checkpoint.topicId || "未关联"}`,
      `原提案：${proposalId || "未关联"}`,
      `原运行：${runId || "未关联"}`,
      `恢复位置：${recoveryPoint}`,
      `修复任务：${checkpoint.repairTaskId || "尚未派发"}`,
    ].join("\n");
    this.options.publish({ eventId: id, eventType: "checkpoint.progress",
      group: { groupId: checkpoint.topicId ? `topic:${checkpoint.topicId}` : `checkpoint:${event.eventId}`, topicId: checkpoint.topicId, proposalId, title: topic?.title || title, status: topic?.completed ? "completed" : phase === "resolved" || phase === "resuming" ? "running" : "blocked", summary: content, startedAt: topic?.createdAt || event.occurredAt, updatedAt: now },
      fact: { nodeId: id, sourceFactKey: id, taskId: checkpoint.repairTaskId || checkpoint.taskId, proposalId, kind: "repair", actor, recipients, status: "completed", action: `${title} · ${action}`, summary: content, contentRole: phase === "resolved" || phase === "returned" ? "result-output" : "analysis-output", content: readableContent, detailRole: phase === "resolved" || phase === "returned" ? "result-evidence" : "recovery-conditions", detail: recoveryDetail, startedAt: now, completedAt: now, occurredAt: now, automaticOpen: false, manualApprovalProposalId: null },
    });
    if (!this.options.memory) return;
    for (const owner of participants.filter((id) => id === "han-li" || id === "nangong-wan")) {
      const conversationId = checkpoint.conversations[owner] || this.options.memory.readPersonaConversation(owner).conversationId;
      if (!conversationId) throw new Error(`缺少${owner}会话，卡点交接尚未完成`);
      checkpoint.conversations[owner] = conversationId;
      const conversation = this.options.memory.appendPersonaInternalMessage({ ownerPersonaId: owner, conversationId, messageId: `${id}:${owner}`, speakerPersonaId: actorId, content: `${actor.displayName} → ${recipients.map((item) => item.displayName).join("、")}\n${title} · ${action}\n\n${content}`, createdAt: now });
      this.options.changed(conversation);
    }
  }
}
