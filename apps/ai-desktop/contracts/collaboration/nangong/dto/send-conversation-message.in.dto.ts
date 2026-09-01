/**
 * 南宫婉对话发送输入协议。
 * 生产者：Renderer 南宫婉页面；消费者：南宫婉对话应用服务。
 * 数据方向：Renderer -> preload -> IPC -> 南宫婉。
 * 本文件不确认专题、不修改审批结果，也不承载共享状态。
 */
import type { Locale } from "../../../foundation/base.js";
import type { WorkspaceState } from "../../../platform/workspace/workspace.js";

export interface SendNangongConversationMessageInDto {
  /** Renderer 在点击发送时生成，运行态确认和失败必须原位更新同一消息。 */
  clientMessageId?: string;
  message: string;
  attachmentIds?: string[];
  /** 从专题执行群发言时只保存稳定专题关联；普通南宫婉对话保持为空。 */
  topicId?: string;
  workspaceState: WorkspaceState;
  locale: Locale;
}
