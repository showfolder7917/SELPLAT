/**
 * 韩立专题研讨输出协议。
 * 生产者：韩立研讨服务；消费者：Evolution 状态聚合、南宫婉和 Renderer。
 * 数据方向：韩立 -> Evolution/协作消费者。
 * 本文件不创建专题，也不保存共享状态。
 */
import type { EvolutionSourceMessageSnapshotOutDto } from "../../../evolution/dto/evolution-topic.out.dto.js";
import type { HanliDeliberationStatusValue } from "../value/deliberation.value.js";

/** 每轮同时保存韩立原问题、南宫婉原回答和韩立判断，禁止只保留最终摘要。 */
export interface HanliDeliberationRoundOutDto {
  roundId: string;
  roundNumber: number;
  question: string;
  questionReason: string;
  answer: string | null;
  assessment: string | null;
  decision: "continue" | "establish-topic" | "blocked" | null;
  createdAt: string;
  answeredAt: string | null;
  assessedAt: string | null;
  /** A persisted visible offer and Hanli's actual reply gate topic creation. */
  confirmation?: { offer: string; offeredAt: string; reply: string | null; repliedAt: string | null };
}

export interface HanliTopicCandidateOutDto {
  title: string;
  goal: string;
  scope: string[];
  exclusions: string[];
  evidence: string[];
  acceptanceCriteria: string[];
  establishmentReason: string;
}

export interface HanliEvolutionDeliberationOutDto {
  deliberationId: string;
  topicId: string | null;
  status: HanliDeliberationStatusValue;
  sourceSnapshots: EvolutionSourceMessageSnapshotOutDto[];
  rounds: HanliDeliberationRoundOutDto[];
  candidate: HanliTopicCandidateOutDto | null;
  createdAt: string;
  updatedAt: string;
}
