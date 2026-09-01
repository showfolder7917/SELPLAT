/**
 * 韩立真实应用验收运行输出协议。
 * 生产者：韩立验收 Runner；消费者：韩立验收应用服务与 Renderer 审批页。
 * 数据方向：验收 Runner -> 韩立/Renderer。
 * 本文件只保存事实证据，失败不会直接改变审批结果。
 */
import type { HanliAcceptanceOperationValue } from "../value/acceptance.value.js";

export interface HanliAcceptanceStepResultOutDto {
  checkId: string;
  operationIndex: number;
  operation: HanliAcceptanceOperationValue;
  status: "passed" | "failed" | "blocked";
  actual: string;
  screenshotAttachmentId: string | null;
  occurredAt: string;
}

export interface HanliAcceptanceRunOutDto {
  version: 1;
  runId: string;
  planId: string;
  topicId: string;
  proposalId: string;
  status: "passed" | "failed" | "blocked";
  windowTitle: string;
  initialBounds: { x: number; y: number; width: number; height: number };
  finalBounds: { x: number; y: number; width: number; height: number };
  stepResults: HanliAcceptanceStepResultOutDto[];
  evidenceAttachmentIds: string[];
  startedAt: string;
  completedAt: string;
}
