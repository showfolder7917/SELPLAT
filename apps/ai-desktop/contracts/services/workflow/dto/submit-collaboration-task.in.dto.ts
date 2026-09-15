/**
 * Workflow 提交协作任务输入协议。
 * 生产者：Renderer、南宫婉或令狐；消费者：Workflow 协作应用服务。
 * 数据方向：协作发起方 -> Workflow。
 * 本文件只携带冻结任务输入，不分配执行人、不创建工作树。
 */
// LocaleValue 说明任务内容和结果应使用的语言和区域设置。
import type { LocaleValue } from "../../../foundation/index.js";
// WorkspaceStateOutDto 限定本任务已经获准操作的工作区。
import type { WorkspaceStateOutDto } from "../../support/platform/workspace/index.js";
// CollaborationAutomationSourceValue 说明任务是否来自已登记自动保障流程。
import type { CollaborationAutomationSourceValue } from "../value/collaboration-task.value.js";
// CollaborationMergeStrategyValue 决定任务结果完成后如何进入版本集成。
import type { CollaborationMergeStrategyValue } from "../value/collaboration-task.value.js";

/** 发起方提交给 Workflow 并在创建时冻结的任务输入。 */
export interface SubmitCollaborationTaskInDto {
  /** 显示在任务卡和审计记录中的任务标题。 */
  title: string;
  /** 发起方观察到的原始问题。 */
  problemStatement: string;
  /** 经过确认后允许执行的真实意图。 */
  confirmedIntent: string;
  /** 执行过程中必须遵守的限制条件。 */
  constraints?: string[];
  /** 判断任务完成的验收条件。 */
  acceptanceCriteria?: string[];
  /** 产生本任务的会话消息编号。 */
  sourceMessageIds?: number[];
  /** 本任务需要读取的附件标识。 */
  attachmentIds?: string[];
  /** 已经由用户确认的工作区范围。 */
  workspaceState: WorkspaceStateOutDto;
  /** 任务内容和结果使用的语言。 */
  locale: LocaleValue;
  /** 任务完成后采用的版本合并策略。 */
  mergeStrategy?: CollaborationMergeStrategyValue;
  /** 必须作为整体集成的任务组标识。 */
  atomicGroupId?: string;
  /** 当前任务开始集成前必须完成的任务标识。 */
  dependencyTaskIds?: string[];
  /** 发起这项任务的人物标识。 */
  initiatorMemberId?: string;
  /** 发起方希望优先分配的执行者。 */
  preferredExecutorMemberId?: string;
  /** 发起任务的已登记自动化来源。 */
  automationSource?: CollaborationAutomationSourceValue;
  /** 产生本任务的人物演化提案。 */
  evolutionProposalId?: string;
  /** 产生本任务的人物演化轮次。 */
  evolutionRoundId?: string;
  /** 本任务明确替代的失败任务标识；仅恢复链使用，普通分发任务不填写。 */
  replacementForTaskId?: string;
  /** 自升级任务要修改能力的目标成员。 */
  selfUpgradeTargetMemberId?: string;
  /** 自升级任务获准修改的能力范围。 */
  selfUpgradeCapabilityScope?: string;
  /** 允许创建本任务的演化审批记录。 */
  sourceEvolutionApprovalId?: string;
  /** 本任务显式命中的当前用户规则逻辑 ID；Workflow 会在提交时冻结解析结果。 */
  taskRuleIds?: string[];
}
