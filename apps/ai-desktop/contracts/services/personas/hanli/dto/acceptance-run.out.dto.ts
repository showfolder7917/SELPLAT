/**
 * 韩立真实应用验收运行输出协议。
 * 生产者：韩立交互式验收；消费者：韩立应用服务与验收事实投影。
 * 数据方向：真实输入、截图及模型逐项判断 -> 韩立/Renderer。
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
  version: 2;
  runId: string;
  topicId: string;
  proposalId: string;
  criteria: string[];
  status: "passed" | "failed" | "blocked";
  windowTitle: string;
  initialBounds: { x: number; y: number; width: number; height: number };
  finalBounds: { x: number; y: number; width: number; height: number };
  stepResults: HanliAcceptanceStepResultOutDto[];
  evidenceAttachmentIds: string[];
  startedAt: string;
  completedAt: string;
}
