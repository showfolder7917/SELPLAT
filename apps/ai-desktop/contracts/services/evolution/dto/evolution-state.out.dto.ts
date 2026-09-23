/**
 * Evolution 当前共享状态快照输出协议。
 * 生产者：中立 Evolution 状态服务；消费者：人物应用服务、Workflow、事件中心与 Renderer。
 * 数据方向：Evolution -> 所有只读状态消费者。
 * 本文件只聚合权威共享事实，不定义人物命令、审批输入或持久化实现。
 */
import type { LocaleValue } from "../../../foundation/index.js";
import type { WorkspaceStateOutDto } from "../../support/platform/workspace/index.js";
import type { HanliEvolutionDeliberationOutDto } from "../../personas/hanli/index.js";
import type { PersonaConversationOutDto } from "../../personas/conversation/index.js";
import type { EvolutionArchiveRecordOutDto } from "./evolution-archive-record.out.dto.js";
import type { EvolutionAutomationRuntimeOutDto, EvolutionAutomationSettingsOutDto } from "./evolution-automation.out.dto.js";
import type { CurrentTopicStageOutDto } from "./current-topic-stage.out.dto.js";
import type { EvolutionOneShotConfirmationOutDto, EvolutionOneShotRunOutDto } from "./evolution-one-shot-run.out.dto.js";
import type { EvolutionProposalOutDto } from "./evolution-proposal.out.dto.js";
import type { EvolutionTopicOutDto } from "./evolution-topic.out.dto.js";

/** 当前专题唯一的技术卡点恢复事实；Workflow 异常只保存审计副本，不能再作为页面计数来源。 */
export interface EvolutionTechnicalRecoveryOutDto {
  issueId: string;
  /** 当前故障的稳定指纹；旧审计记录缺失时不得签发任务级用户操作。 */
  faultFingerprint?: string | null;
  topicId: string;
  proposalId: string;
  acceptanceConditionIds: string[];
  failureCategory: string;
  evidenceReferences: string[];
  occurrences: Array<{ runId: string | null; taskId: string | null; occurrenceId: string | null; reason: string; occurredAt: string }>;
  attemptCount: number;
  handler: "linghu-ancestor" | "monitor" | "system";
  handoffStatus: "pending" | "handed-off" | "failed" | "basis-unverified" | "monitoring";
  failureReason: string | null;
  nextAction: string;
  active: boolean;
  updatedAt: string;
}

export interface EvolutionStateOutDto {
  version: 10;
  automationSettings: EvolutionAutomationSettingsOutDto;
  automationRuntime: EvolutionAutomationRuntimeOutDto;
  /** 南宫婉已经在可见正文中明确邀请启动本轮流程；应用重启后仍可继续等待用户确认。 */
  oneShotConfirmation?: EvolutionOneShotConfirmationOutDto | null;
  /** 当前对话经用户确认后启动的单专题运行；完成后由运行状态决定是否继续发现下一问题。 */
  oneShotRun?: EvolutionOneShotRunOutDto | null;
  /** 技术卡点的唯一恢复状态；历史档案不会重新激活该字段。 */
  technicalRecovery?: EvolutionTechnicalRecoveryOutDto | null;
  automationContext: { workspaceState: WorkspaceStateOutDto | null; locale: LocaleValue };
  preferenceSnapshotVersion: number;
  activeTopicId: string | null;
  topics: EvolutionTopicOutDto[];
  proposals: EvolutionProposalOutDto[];
  deliberations: HanliEvolutionDeliberationOutDto[];
  /** 追加式专题档案；完成提案只能通过其 finalConclusionRecordId 引用其中的结果决定记录。 */
  archiveRecords: EvolutionArchiveRecordOutDto[];
  /** 由 Evolution/Workflow 运行时生成的当前专题唯一阶段；页面不得再自行合成任务与验收状态。 */
  currentTopicStage?: CurrentTopicStageOutDto;
  /** 南宫婉当前会话的运行时投影；持久化正文只存在于统一人物会话表。 */
  conversation: PersonaConversationOutDto;
  updatedAt: string;
}
