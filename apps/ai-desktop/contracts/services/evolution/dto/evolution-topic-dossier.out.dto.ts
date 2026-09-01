/**
 * Evolution 专题完整案卷输出协议。
 * 生产者：Evolution 查询服务；消费者：Renderer 专题详情与验收流程。
 * 数据方向：Evolution -> 查询消费者。
 * 本文件只聚合权威共享事实，不复制人物或数据库实现。
 */
import type { HanliEvolutionDeliberationOutDto } from "../../personas/hanli/index.js";
import type { EvolutionArchiveRecordOutDto } from "./evolution-archive-record.out.dto.js";
import type { EvolutionProposalOutDto } from "./evolution-proposal.out.dto.js";
import type { EvolutionTopicOutDto } from "./evolution-topic.out.dto.js";

export interface EvolutionTopicDossierOutDto {
  topic: EvolutionTopicOutDto;
  deliberation: HanliEvolutionDeliberationOutDto | null;
  proposals: EvolutionProposalOutDto[];
  archiveRecords: EvolutionArchiveRecordOutDto[];
  executionRecords: EvolutionArchiveRecordOutDto[];
}
