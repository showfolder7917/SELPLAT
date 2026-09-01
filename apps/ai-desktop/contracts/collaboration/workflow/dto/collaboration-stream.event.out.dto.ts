/**
 * Workflow 人物执行流主动推送事件协议。
 * 生产者：主进程 Workflow；消费者：preload 与 Renderer 协作任务页。
 * 数据方向：main -> preload -> Renderer。
 * 本文件不保存 Codex 会话，也不改变任务状态。
 */
import type { CodexStreamEvent } from "../../../platform/codex/index.js";

export interface CollaborationStreamEventOutDto {
  taskId: string;
  memberId: string;
  /** 主进程在分片入库时确定的不可变时间线节点；为空表示该分片不属于专题时间线。 */
  timelineNodeId?: string | null;
  event: CodexStreamEvent;
}
