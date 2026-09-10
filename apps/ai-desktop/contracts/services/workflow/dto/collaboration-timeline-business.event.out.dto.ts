/**
 * Workflow 专题时间线不可变业务事件协议。
 *
 * 生产者：人物和 Workflow 业务流程。
 * 消费者：事件中心时间线事务。
 * 数据方向：业务流程 -> 事件中心。
 * 本文件不接收任务或提案当前快照，也不直接生成 Renderer 投影。
 */

// CollaborationTimelineBusinessEventTypeValue 是允许写入专题时间线的事件名称集合。
import type { CollaborationTimelineBusinessEventTypeValue } from "../value/collaboration-timeline-business-event.value.js";
// CollaborationTimelineGroupOutDto 提供专题卡状态字段的权威类型。
import type { CollaborationTimelineGroupOutDto } from "./collaboration-timeline.out.dto.js";
// CollaborationTimelineNodeOutDto 提供时间线事实公共字段的权威类型。
import type { CollaborationTimelineNodeOutDto } from "./collaboration-timeline.out.dto.js";

/** 业务流程提交给事件中心的一项专题时间线事实。 */
export interface CollaborationTimelineBusinessEventOutDto {
  /** 不可变业务事件的稳定唯一标识。 */
  eventId: string;
  /** 业务事件的标准名称。 */
  eventType: CollaborationTimelineBusinessEventTypeValue;
  /** 事件所属专题卡在发生时的最小快照。 */
  group: {
    /** 专题卡的稳定唯一标识。 */
    groupId: string;
    /** 专题标识；普通任务为 null。 */
    topicId: string | null;
    /** 演化提案标识；普通任务为 null。 */
    proposalId: string | null;
    /** 事件发生时的专题卡标题。 */
    title: string;
    /** 事件发生后的专题状态。 */
    status: CollaborationTimelineGroupOutDto["status"];
    /** 事件发生后的专题摘要。 */
    summary: string;
    /** 专题开始时间。 */
    startedAt: string;
    /** 专题在本事件发生后的更新时间。 */
    updatedAt: string;
  };
  /** 从业务动作形成的节点事实，投影层会计算持续时间和显示事件名。 */
  fact: Omit<CollaborationTimelineNodeOutDto, "durationMs" | "eventType"> & {
    /** 节点直接关联的提案；普通任务节点为 null。 */
    proposalId: string | null;
    /** 用来拒绝同一来源事实重复写入的稳定键。 */
    sourceFactKey: string;
    /** 该业务事实真实发生的时间。 */
    occurredAt: string;
  };
}
