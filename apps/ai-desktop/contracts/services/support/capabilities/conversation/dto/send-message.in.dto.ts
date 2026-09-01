/** 对话能力接收的消息请求；由 Renderer 生产并经 DesktopApi 进入主进程。 */
import type { LocaleValue, ManagedExecutionModeValue, SandboxModeValue } from "../../../../../foundation/index.js";

export interface SendMessageInDto {
  message: string;
  locale: LocaleValue;
  sandboxMode: SandboxModeValue;
  attachmentIds: string[];
  executionMode: ManagedExecutionModeValue;
  queueItemId?: string;
}
