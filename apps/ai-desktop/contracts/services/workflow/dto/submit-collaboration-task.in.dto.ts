/**
 * Workflow 提交协作任务输入协议。
 * 生产者：Renderer、南宫婉或令狐；消费者：Workflow 协作应用服务。
 * 数据方向：协作发起方 -> Workflow。
 * 本文件只携带冻结任务输入，不分配执行人、不创建工作树。
 */
import type { LocaleValue } from "../../../foundation/index.js";
import type { WorkspaceStateOutDto } from "../../support/platform/workspace/index.js";
import type { CollaborationAutomationSourceValue, CollaborationMergeStrategyValue } from "../value/collaboration-task.value.js";

export interface SubmitCollaborationTaskInDto {
  title: string;
  problemStatement: string;
  confirmedIntent: string;
  constraints?: string[];
  acceptanceCriteria?: string[];
  sourceMessageIds?: number[];
  attachmentIds?: string[];
  workspaceState: WorkspaceStateOutDto;
  locale: LocaleValue;
  mergeStrategy?: CollaborationMergeStrategyValue;
  atomicGroupId?: string;
  dependencyTaskIds?: string[];
  initiatorMemberId?: string;
  preferredExecutorMemberId?: string;
  automationSource?: CollaborationAutomationSourceValue;
  evolutionProposalId?: string;
  evolutionRoundId?: string;
  selfUpgradeTargetMemberId?: string;
  selfUpgradeCapabilityScope?: string;
  sourceEvolutionApprovalId?: string;
}
