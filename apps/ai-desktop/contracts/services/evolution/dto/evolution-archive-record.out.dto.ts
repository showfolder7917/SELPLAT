import type { EvolutionArchiveActorValue, EvolutionArchiveCategoryValue } from "../value/evolution-archive-record.value.js";
/**
 * Evolution 不可覆盖档案记录输出协议。
 * 生产者：Evolution 档案服务；消费者：专题案卷与 Renderer 档案页。
 * 数据方向：Evolution -> 查询消费者。
 * 本文件不修改历史记录，也不暴露底层数据库结构。
 */

export interface EvolutionArchiveRecordOutDto {
  recordId: string;
  deliberationId: string | null;
  topicId: string | null;
  proposalId: string | null;
  taskId: string | null;
  sequenceNumber: number;
  category: EvolutionArchiveCategoryValue;
  eventType: string;
  actor: EvolutionArchiveActorValue;
  title: string;
  payload: Record<string, unknown>;
  occurredAt: string;
}
