/**
 * Evolution 当前共享状态快照输出协议。
 * 生产者：中立 Evolution 状态服务；消费者：人物应用服务、Workflow、事件中心与 Renderer。
 * 数据方向：Evolution -> 所有只读状态消费者。
 * 本文件只聚合权威共享事实，不定义人物命令、审批输入或持久化实现。
 */
import type { Locale } from "../../../foundation/base.js";
import type { WorkspaceState } from "../../../platform/workspace/workspace.js";
import type { HanliEvolutionDeliberationOutDto } from "../../hanli/index.js";
import type { NangongConversationOutDto } from "../../nangong/index.js";
import type { EvolutionArchiveRecord } from "./evolution-archive-record.out.dto.js";
import type { EvolutionAutomationRuntime, EvolutionAutomationSettings } from "./evolution-automation.out.dto.js";
import type { EvolutionOneShotConfirmation, EvolutionOneShotRun } from "./evolution-one-shot-run.out.dto.js";
import type { EvolutionProposal } from "./evolution-proposal.out.dto.js";
import type { EvolutionTopic } from "./evolution-topic.out.dto.js";

export interface EvolutionStateOutDto {
  version: 8;
  automaticEvolutionEnabled: boolean;
  automaticNangongApprovalEnabled: boolean;
  automaticLinghuApprovalEnabled: boolean;
  automaticExecutionEnabled: boolean;
  automationSettings: EvolutionAutomationSettings;
  automationRuntime: EvolutionAutomationRuntime;
  /** 南宫婉已经在可见正文中明确邀请启动本轮流程；应用重启后仍可继续等待用户确认。 */
  oneShotConfirmation?: EvolutionOneShotConfirmation | null;
  /** 当前对话经用户一次确认后启动的单轮托管；不改变四个长期自动开关。 */
  oneShotRun?: EvolutionOneShotRun | null;
  automationContext: { workspaceState: WorkspaceState | null; locale: Locale };
  preferenceSnapshotVersion: number;
  activeTopicId: string | null;
  topics: EvolutionTopic[];
  proposals: EvolutionProposal[];
  deliberations: HanliEvolutionDeliberationOutDto[];
  archiveRecords: EvolutionArchiveRecord[];
  conversation: NangongConversationOutDto;
  updatedAt: string;
}
