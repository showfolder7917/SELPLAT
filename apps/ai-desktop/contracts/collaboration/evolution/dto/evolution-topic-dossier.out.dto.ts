/**
 * Evolution 专题完整案卷输出协议。
 * 生产者：Evolution 查询服务；消费者：Renderer 专题详情与验收流程。
 * 数据方向：Evolution -> 查询消费者。
 * 本文件只聚合权威共享事实，不复制人物或数据库实现。
 */
import type { HanliEvolutionDeliberationOutDto } from "../../hanli/index.js";
import type { EvolutionArchiveRecord } from "./evolution-archive-record.out.dto.js";
import type { EvolutionProposal } from "./evolution-proposal.out.dto.js";
import type { EvolutionTopic } from "./evolution-topic.out.dto.js";

export interface EvolutionTopicDossier {
  topic: EvolutionTopic;
  deliberation: HanliEvolutionDeliberationOutDto | null;
  proposals: EvolutionProposal[];
  archiveRecords: EvolutionArchiveRecord[];
  executionRecords: EvolutionArchiveRecord[];
}
