/**
 * Workflow 协作状态主动推送事件协议。
 * 生产者：主进程 Workflow；消费者：preload 与 Renderer。
 * 数据方向：main -> preload -> Renderer。
 * 本文件不接收命令，也不允许消费者回写状态快照。
 */
import type { CollaborationStateOutDto } from "./collaboration-state.out.dto.js";

export interface CollaborationStateEventOutDto {
  state: CollaborationStateOutDto;
  reason: string;
  taskIds: string[];
}
