/**
 * 页面型任务交给韩立真实窗口验收的最小目标。
 *
 * 生产者：演化运行时；消费者：韩立场景规划与验收器。
 * 数据方向：运行时 -> 场景准备 -> 验收器；禁止职责：不能由此 DTO 修改产品、任务或验收状态。
 */
export interface HanliComputerAcceptanceInDto {
  topicId: string;
  proposalId: string;
  title: string;
  criteria: string[];
  /** mixed 验收保留原提案编号，不能因筛选页面条件而重新编号。 */
  criterionIds?: string[];
  /** 仅这些冻结条件必须在任务协作群页面取证，不能由自由讨论页裁决。 */
  taskCollaborationCriterionIds?: string[];
}
