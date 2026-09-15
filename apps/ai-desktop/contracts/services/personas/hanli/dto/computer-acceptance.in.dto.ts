/** 单份专题材料在当前电脑验收会话中允许执行的操作。 */
export type HanliAcceptanceMaterialActionValue = "preview" | "copy" | "system-open";

/** 绑定已冻结提案版本的工作区材料；未登记材料不能由验收会话访问。 */
export interface HanliAcceptanceMaterialAuthorizationInDto {
  workspaceId: string;
  relativePath: string;
  allowedActions: HanliAcceptanceMaterialActionValue[];
}

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
  /** 仅由已冻结验收计划传入的专题材料授权；省略时保持现有只读导航边界。 */
  materials?: HanliAcceptanceMaterialAuthorizationInDto[];
}
