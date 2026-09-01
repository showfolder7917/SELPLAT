/**
 * Workflow 时间线提交后主动通知协议。
 * 生产者：事件中心时间线事务；消费者：preload 与 Renderer。
 * 数据方向：main -> preload -> Renderer。
 * 本文件只通知受影响群组版本，不携带完整时间线。
 */
export interface CollaborationTimelineChangedEventOutDto {
  committedAt: string;
  groupIds: string[];
  groupVersions: Record<string, number>;
}
