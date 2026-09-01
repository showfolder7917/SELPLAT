/**
 * Codex 流式事件协议，将外部运行事件转换为 Renderer 可消费的稳定状态。
 *
 * 生产者：主进程 stream-event-mapper 和受管任务执行器。
 * 消费者：Renderer 对话流、计划列表和进度提示。
 * 数据方向：main -> preload -> renderer。
 * 本文件不携带未经裁剪的底层 SDK 事件或敏感命令上下文。
 */
import type { ManagedExecutionModeValue } from "../../../../../foundation/index.js";
import type { CodexStreamActivityOutDto, CodexStreamPlanStepOutDto } from "./codex-stream.out.dto.js";

export interface ManagedExecutionUpdateEventOutDto {
  mode: ManagedExecutionModeValue;
  stage: "conversation" | "requirement-analysis" | "task-execution" | "code-validation" | "interaction-validation" | "build-validation" | "runtime-restart" | "completed";
  status: "started" | "continuing" | "completed" | "blocked";
  round: number;
  maximumRounds: number;
  message: string;
}

export interface CodexStreamEventOutDto {
  type: "turn-started" | "message-delta" | "message-completed" | "reasoning-summary-delta" | "activity" | "plan-updated" | "diff-updated" | "turn-completed" | "managed-execution" | "error";
  turnId: string;
  segmentId?: string;
  itemId?: string;
  delta?: string;
  text?: string;
  activity?: CodexStreamActivityOutDto;
  plan?: CodexStreamPlanStepOutDto[];
  changedFiles?: string[];
  status?: string;
  error?: string;
  managedExecution?: ManagedExecutionUpdateEventOutDto;
}
