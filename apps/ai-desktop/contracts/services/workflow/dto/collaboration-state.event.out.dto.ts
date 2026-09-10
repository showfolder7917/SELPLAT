/**
 * Workflow 协作状态主动推送事件协议。
 * 生产者：主进程 Workflow；消费者：preload 与 Renderer。
 * 数据方向：main -> preload -> Renderer。
 * 本文件不接收命令，也不允许消费者回写状态快照。
 */
// CollaborationStateOutDto 是这次变化之后的完整协作状态快照。
import type { CollaborationStateOutDto } from "./collaboration-state.out.dto.js";

/** 主进程在协作状态提交后推送给 Renderer 的变化通知。 */
export interface CollaborationStateEventOutDto {
  /** 状态变化后可直接替换 Renderer 缓存的完整快照。 */
  state: CollaborationStateOutDto;
  /** 触发这次状态变化的可读业务原因。 */
  reason: string;
  /** 本次变化直接影响的任务标识。 */
  taskIds: string[];
}
