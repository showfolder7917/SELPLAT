/**
 * Evolution 状态主动推送事件协议。
 * 生产者：主进程 Evolution 状态服务；消费者：preload 与 Renderer。
 * 数据方向：main -> preload -> Renderer。
 * 本文件不接收命令，也不允许消费者回写事件快照。
 */
import type { EvolutionStateOutDto } from "./evolution-state.out.dto.js";

export interface EvolutionStateEventOutDto {
  state: EvolutionStateOutDto;
  reason: string;
  topicId: string | null;
  proposalId: string | null;
}
