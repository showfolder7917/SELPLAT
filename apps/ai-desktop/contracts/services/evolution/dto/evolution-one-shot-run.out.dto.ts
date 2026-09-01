import type { EvolutionOneShotPhaseValue } from "../value/evolution-one-shot-run.value.js";
/**
 * Evolution 一次性运行与等待确认事实输出协议。
 * 生产者：Workflow 一次性运行编排；消费者：Evolution 状态聚合和人物页面。
 * 数据方向：Workflow -> Evolution 状态 -> Renderer。
 * 本文件不解释用户输入，也不授予源码写入权限。
 */
import type { EvolutionArchiveActorValue } from "../value/evolution-archive-record.value.js";


/** 可见邀请形成的待确认事实；不使用模型隐藏字段推断用户是否能够回复 1。 */
export interface EvolutionOneShotConfirmationOutDto {
  conversationId: string;
  invitationMessageId: string;
  status: "awaiting-user-confirmation";
  createdAt: string;
}

/** 一次性运行状态随专题状态共同持久化，并通过既有状态事件实时投影到人物界面。 */
export interface EvolutionOneShotRunOutDto {
  runId: string;
  topicId: string | null;
  proposalId: string | null;
  status: "running" | "completed" | "blocked";
  phase: EvolutionOneShotPhaseValue;
  actor: EvolutionArchiveActorValue;
  actorName: string;
  action: string;
  blockingReason: string | null;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
}
