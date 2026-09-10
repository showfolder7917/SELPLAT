/**
 * Workflow 任务协作群时间线输出协议。
 *
 * 生产者：事件中心时间线投影。
 * 消费者：Renderer 协作群页面。
 * 数据方向：事件中心 -> Renderer。
 * 本文件只公开稳定的人可读投影，不推断人物或修改任务事实。
 */

// CollaborationTimelineContentRoleValue 说明节点正文承担的业务角色。
import type { CollaborationTimelineContentRoleValue } from "../value/collaboration-timeline.value.js";
// CollaborationTimelineDetailRoleValue 说明节点详情承担的业务角色。
import type { CollaborationTimelineDetailRoleValue } from "../value/collaboration-timeline.value.js";
// CollaborationParticipantSnapshotOutDto 固定事件发生时的人物身份。
import type { CollaborationParticipantSnapshotOutDto } from "./collaboration-member.out.dto.js";

/** 专题任务卡中按发生顺序显示的一个业务节点。 */
export interface CollaborationTimelineNodeOutDto {
  /** 时间线节点的稳定唯一标识。 */
  nodeId: string;
  /** 节点所属任务；提案级节点为 null。 */
  taskId: string | null;
  /** 产生该节点的原始业务事件名称。 */
  eventType: string;
  /** 节点在界面上所属的业务阶段。 */
  kind: "approval-application" | "approval-decision" | "distribution" | "analysis" | "execution" | "verification" | "repair" | "result";
  /** 执行该动作的人物快照。 */
  actor: CollaborationParticipantSnapshotOutDto;
  /** 该动作通知或交接给的人物。 */
  recipients: CollaborationParticipantSnapshotOutDto[];
  /** 节点当前的展示状态。 */
  status: "completed" | "current" | "waiting" | "failed";
  /** 人物在这个节点执行的具体动作。 */
  action: string;
  /** 面向任务卡显示的一行结果摘要。 */
  summary: string;
  /** 正文在业务上属于分析、执行还是其他内容。 */
  contentRole: CollaborationTimelineContentRoleValue;
  /** 用户无需展开即可阅读的主要内容。 */
  content: string;
  /** 详情文本在业务上的用途。 */
  detailRole: CollaborationTimelineDetailRoleValue;
  /** 展开节点后显示的补充说明。 */
  detail: string;
  /** 该业务动作开始的时间。 */
  startedAt: string;
  /** 该业务动作结束的时间；仍在进行时为 null。 */
  completedAt: string | null;
  /** 从开始到当前或结束的毫秒数。 */
  durationMs: number;
  /** true 表示页面首次看到该节点时应自动展开。 */
  automaticOpen: boolean;
  /** 节点关联的人工审批提案；没有人工审批时为 null。 */
  manualApprovalProposalId: string | null;
}

/** 一个专题对应的一张可折叠任务卡。 */
export interface CollaborationTimelineGroupOutDto {
  /** 专题卡的稳定唯一标识。 */
  groupId: string;
  /** 专题标识；不属于演化专题时为 null。 */
  topicId: string | null;
  /** 演化提案标识；普通协作任务为 null。 */
  proposalId: string | null;
  /** 专题卡标题。 */
  title: string;
  /** 专题整体的当前展示状态。 */
  status: "waiting-approval" | "running" | "verifying" | "blocked" | "completed" | "cancelled";
  /** 专题当前进展的一行摘要。 */
  summary: string;
  /** 按业务发生顺序排列的时间线节点。 */
  nodes: CollaborationTimelineNodeOutDto[];
  /** 当前正在执行的节点数量。 */
  executingCount: number;
  /** 当前正在验证的节点数量。 */
  verifyingCount: number;
  /** 当前等待外部动作的节点数量。 */
  waitingCount: number;
  /** 已经完成的节点数量。 */
  completedCount: number;
  /** 专题第一个业务动作开始的时间。 */
  startedAt: string;
  /** 专题最后一次发生变化的时间。 */
  updatedAt: string;
  /** 专题从开始到当前或结束的毫秒数。 */
  durationMs: number;
  /** 没有失败时预计执行的下一步。 */
  nextStep: string;
  /** 当前失败需要执行的下一步；没有失败时为 null。 */
  failureNextStep: string | null;
  /** 下一步应由谁负责；系统动作或已结束时为 null。 */
  nextOwner: CollaborationParticipantSnapshotOutDto | null;
}

/** 主进程一次返回的完整、稳定、有序专题时间线投影。 */
export interface CollaborationTimelineSnapshotOutDto {
  /** 时间线投影格式版本。 */
  version: 1;
  /** 按业务规则排序后的专题任务卡。 */
  groups: CollaborationTimelineGroupOutDto[];
  /** 整份时间线投影最后更新时间。 */
  updatedAt: string;
}
