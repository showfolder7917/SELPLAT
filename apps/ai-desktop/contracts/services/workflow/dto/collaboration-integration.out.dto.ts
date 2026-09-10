/**
 * Workflow 版本集成输出协议。
 *
 * 生产者：版本集成管线。
 * 消费者：Workflow、令狐恢复流程和 Renderer。
 * 数据方向：版本集成能力 -> Workflow 消费者。
 * 本文件只公开集成事实，不执行 Git 命令或修改任务状态。
 */

// CollaborationIntegrationFailureKindValue 把集成失败归入稳定、可处理的业务类别。
import type { CollaborationIntegrationFailureKindValue } from "../value/collaboration-task.value.js";

/** 一次任务集成失败时需要保留的定位和恢复信息。 */
export interface CollaborationIntegrationFailureOutDto {
  /** 集成失败的标准类别。 */
  kind: CollaborationIntegrationFailureKindValue;
  /** 失败发生在候选准备、验证还是发布阶段。 */
  phase?: "preparation" | "verification" | "release";
  /** 面向任务卡展示的简短问题说明。 */
  summary?: string;
  /** 该失败对当前任务或发布流程的影响。 */
  impact?: string;
  /** 经过确认后建议执行的恢复动作。 */
  recoveryAction?: string;
  /** 用于调查的完整技术说明。 */
  detail: string;
  /** 发生未提交修改的真实工作区；只用于定位，不代表写权限。 */
  workspaceRoot?: string | null;
  /** Git 已确认存在冲突的相对文件路径。 */
  conflictFiles: string[];
  /** 集成开始前的提交 SHA；无法取得时为 null。 */
  baseSha: string | null;
  /** 集成产生的结果 SHA；失败前没有结果时为 null。 */
  resultSha: string | null;
  /** 失败所属的集成批次代次；无法关联时为 null。 */
  generation: number | null;
  /** 失败实际发生的时间。 */
  occurredAt: string;
}

/** 一批必须一起完成版本集成和统一验证的任务。 */
export interface CollaborationIntegrationBatchOutDto {
  /** 集成批次的递增代次，也是该批次的稳定标识。 */
  generation: number;
  /** 被冻结到这个批次中的任务标识。 */
  taskIds: string[];
  /** 当前批次所处的集成阶段。 */
  state: "frozen" | "integrating" | "verified" | "completed" | "failed";
  /** 批次冻结创建的时间。 */
  createdAt: string;
  /** 批次结束的时间；仍在运行时为 null。 */
  completedAt: string | null;
  /** 完成集成后产生的提交 SHA；尚未产生时为 null。 */
  integrationSha: string | null;
  /** 面向人员说明的失败原因；未失败时为 null。 */
  failureReason: string | null;
  /** 标准失败类别；旧批次或成功批次可能没有该字段。 */
  failureKind?: CollaborationIntegrationFailureKindValue | null;
  /** Git 已确认存在冲突的文件；旧批次可能没有该字段。 */
  conflictFiles?: string[];
}
