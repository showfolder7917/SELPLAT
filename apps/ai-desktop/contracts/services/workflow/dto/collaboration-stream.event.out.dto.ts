/**
 * Workflow 人物执行流主动推送事件协议。
 * 生产者：主进程 Workflow；消费者：preload 与 Renderer 协作任务页。
 * 数据方向：main -> preload -> Renderer。
 * 本文件不保存 Codex 会话，也不改变任务状态。
 */
// CodexStreamEventOutDto 是 Codex 执行期间产生的标准流式输出分片。
import type { CodexStreamEventOutDto } from "../../support/platform/codex/index.js";

/** 一个协作人物在执行任务期间产生的流式输出分片。 */
export interface CollaborationStreamEventOutDto {
  /** 接收该流式输出的协作任务标识。 */
  taskId: string;
  /** 产生该流式输出的人物标识。 */
  memberId: string;
  /** 主进程在分片入库时确定的不可变时间线节点；为空表示该分片不属于专题时间线。 */
  timelineNodeId?: string | null;
  /** 原始 Codex 流式输出事件。 */
  event: CodexStreamEventOutDto;
}
