/**
 * Evolution 当前共享状态快照输出协议。
 * 生产者：中立 Evolution 状态服务；消费者：人物应用服务、Workflow、事件中心与 Renderer。
 * 数据方向：Evolution -> 所有只读状态消费者。
 * 本文件只聚合权威共享事实，不定义人物命令、审批输入或持久化实现。
 */
import type { LocaleValue } from "../../../foundation/index.js";
import type { WorkspaceStateOutDto } from "../../support/platform/workspace/index.js";
import type { HanliEvolutionDeliberationOutDto } from "../../personas/hanli/index.js";
import type { NangongConversationOutDto } from "../../personas/nangong/index.js";
import type { EvolutionArchiveRecordOutDto } from "./evolution-archive-record.out.dto.js";
import type { EvolutionAutomationRuntimeOutDto, EvolutionAutomationSettingsOutDto } from "./evolution-automation.out.dto.js";
import type { EvolutionOneShotConfirmationOutDto, EvolutionOneShotRunOutDto } from "./evolution-one-shot-run.out.dto.js";
import type { EvolutionProposalOutDto } from "./evolution-proposal.out.dto.js";
import type { EvolutionTopicOutDto } from "./evolution-topic.out.dto.js";

export interface EvolutionStateOutDto {
  version: 8;
  automaticEvolutionEnabled: boolean;
  automaticNangongApprovalEnabled: boolean;
  automaticLinghuApprovalEnabled: boolean;
  automaticExecutionEnabled: boolean;
  automationSettings: EvolutionAutomationSettingsOutDto;
  automationRuntime: EvolutionAutomationRuntimeOutDto;
  /** 南宫婉已经在可见正文中明确邀请启动本轮流程；应用重启后仍可继续等待用户确认。 */
  oneShotConfirmation?: EvolutionOneShotConfirmationOutDto | null;
  /** 当前对话经用户一次确认后启动的单轮托管；不改变四个长期自动开关。 */
  oneShotRun?: EvolutionOneShotRunOutDto | null;
  automationContext: { workspaceState: WorkspaceStateOutDto | null; locale: LocaleValue };
  preferenceSnapshotVersion: number;
  activeTopicId: string | null;
  topics: EvolutionTopicOutDto[];
  proposals: EvolutionProposalOutDto[];
  deliberations: HanliEvolutionDeliberationOutDto[];
  archiveRecords: EvolutionArchiveRecordOutDto[];
  conversation: NangongConversationOutDto;
  updatedAt: string;
}
