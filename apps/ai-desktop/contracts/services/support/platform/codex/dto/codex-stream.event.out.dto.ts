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

/** 由主进程受控测试执行器写入的一项可审计验证结论，不能由人物回复代替。 */
export interface ManagedExecutionVerificationEvidenceOutDto {
  /** 本项结论覆盖的固定验证场景或脚本标识。 */
  scenario: string;
  /** 受控执行的固定命令，韩立据此定位实际测试入口。 */
  command: string;
  /** 固定命令的实际结束状态。 */
  status: "passed" | "failed";
  /** 产生结论的受控执行器，避免把模型文本误作测试事实。 */
  source: "task-worktree-test-runner" | "fixed-unified-test-runner";
  /** 本项命令结束的真实时间。 */
  completedAt: string;
}

export interface ManagedExecutionUpdateEventOutDto {
  mode: ManagedExecutionModeValue;
  stage: "conversation" | "requirement-analysis" | "task-execution" | "code-validation" | "interaction-validation" | "build-validation" | "runtime-restart" | "completed";
  status: "started" | "continuing" | "completed" | "blocked";
  round: number;
  maximumRounds: number;
  message: string;
  /** 桌面验证失败后的自修轮次；不把普通执行轮次误认为修复次数。 */
  selfRepair?: boolean;
  /** 主进程受控测试产生的逐项结论；普通执行进度不填写。 */
  verificationEvidence?: ManagedExecutionVerificationEvidenceOutDto[];
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
