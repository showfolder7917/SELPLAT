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
}
