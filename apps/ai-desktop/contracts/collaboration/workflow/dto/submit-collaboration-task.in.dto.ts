/**
 * Workflow 提交协作任务输入协议。
 * 生产者：Renderer、南宫婉或令狐；消费者：Workflow 协作应用服务。
 * 数据方向：协作发起方 -> Workflow。
 * 本文件只携带冻结任务输入，不分配执行人、不创建工作树。
 */
import type { Locale } from "../../../foundation/base.js";
import type { WorkspaceState } from "../../../platform/workspace/index.js";
import type { CollaborationAutomationSource, CollaborationMergeStrategy } from "./collaboration-task.out.dto.js";

export interface SubmitCollaborationTaskInDto {
  title: string;
  problemStatement: string;
  confirmedIntent: string;
  constraints?: string[];
  acceptanceCriteria?: string[];
  sourceMessageIds?: number[];
  attachmentIds?: string[];
  workspaceState: WorkspaceState;
  locale: Locale;
  mergeStrategy?: CollaborationMergeStrategy;
  atomicGroupId?: string;
  dependencyTaskIds?: string[];
  initiatorMemberId?: string;
  preferredExecutorMemberId?: string;
  automationSource?: CollaborationAutomationSource;
  evolutionProposalId?: string;
  evolutionRoundId?: string;
  selfUpgradeTargetMemberId?: string;
  selfUpgradeCapabilityScope?: string;
  sourceEvolutionApprovalId?: string;
}
