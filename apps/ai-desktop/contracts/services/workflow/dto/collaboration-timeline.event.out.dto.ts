/**
 * Workflow 时间线提交后主动通知协议。
 *
 * 生产者：事件中心时间线事务。
 * 消费者：preload 与 Renderer。
 * 数据方向：main -> preload -> Renderer。
 * 本文件只通知受影响群组及版本，不携带完整时间线。
 */

/** 一批专题时间线事实成功提交后发出的轻量变化通知。 */
export interface CollaborationTimelineChangedEventOutDto {
  /** 本批时间线事务成功提交的时间。 */
  committedAt: string;
  /** 本次事务实际影响的专题卡标识。 */
  groupIds: string[];
  /** 每个受影响专题卡提交后的最新版本。 */
  groupVersions: Record<string, number>;
}
