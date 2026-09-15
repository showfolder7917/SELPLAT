/**
 * 韩立真实应用验收运行输出协议。
 * 生产者：韩立交互式验收；消费者：韩立应用服务与验收事实投影。
 * 数据方向：真实输入、截图及模型逐项判断 -> 韩立/Renderer。
 * 本文件只保存事实证据，失败不会直接改变审批结果。
 */
import type { HanliAcceptanceBlockerKindValue, HanliAcceptanceDispositionValue, HanliAcceptanceEvidenceModeValue, HanliAcceptanceModeValue, HanliAcceptanceOperationValue } from "../value/acceptance.value.js";

export interface HanliAcceptanceStepResultOutDto {
  checkId: string;
  /** 该原始条件的权威证据来源；mixed 运行据此分别执行门禁。 */
  evidenceMode: HanliAcceptanceEvidenceModeValue;
  operationIndex: number;
  operation: HanliAcceptanceOperationValue;
  status: "passed" | "failed" | "blocked";
  /** 仅 blocked 使用；让后续分流依据受控事实，而不解析实际结果中的自由文本。 */
  blockerKind?: HanliAcceptanceBlockerKindValue;
  actual: string;
  /** 同一验收条件下对位置、遮挡、拥挤、尺寸和整体协调性的独立判断。 */
  layoutStatus: "passed" | "failed" | "blocked" | "not-applicable";
  /** 韩立从真实截图观察到的布局结果；不能用功能操作成功代替。 */
  layoutActual: string;
  /** 布局判断引用的最新真实截图。 */
  layoutScreenshotAttachmentId: string | null;
  screenshotAttachmentId: string | null;
  /** 非页面代码符合性审查引用的文件、差异或测试事实；页面验收通常为空。 */
  evidenceReferences?: string[];
  occurredAt: string;
}

export interface HanliAcceptanceRunOutDto {
  version: 3;
  mode: HanliAcceptanceModeValue;
  runId: string;
  topicId: string;
  proposalId: string;
  /** 本轮运行只可消费已持久化的提案验收计划。 */
  planId?: string;
  /** 本轮运行对应计划中的当前验收轮次。 */
  acceptanceRoundId?: string;
  criteria: string[];
  /** mixed 预审记录登记待由正式窗口验证的原始条件编号。 */
  pageCriterionIds?: string[];
  status: "passed" | "failed" | "blocked";
  /** 运行时分类后写入的最终分流事实；旧归档记录按未分类读取。 */
  acceptanceDisposition?: HanliAcceptanceDispositionValue;
  windowTitle: string;
  initialBounds: { x: number; y: number; width: number; height: number };
  finalBounds: { x: number; y: number; width: number; height: number };
  /**
   * 受控输入形成的真实操作轨迹；与逐条件结论分离，避免动作记录干扰原条件编号校验。
   * 旧归档记录可能没有该字段，消费者必须按空轨迹兼容读取。
   */
  interactionSteps?: HanliAcceptanceStepResultOutDto[];
  /** 每条原验收条件唯一的最终判断，不承载点击、滚动等操作轨迹。 */
  stepResults: HanliAcceptanceStepResultOutDto[];
  evidenceAttachmentIds: string[];
  startedAt: string;
  completedAt: string;
}
