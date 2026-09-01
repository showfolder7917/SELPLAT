/** 对话队列和当前任务的只读状态快照。 */
import type { SendMessageInDto } from "./send-message.in.dto.js";

export interface ConversationQueueItemOutDto {
  id: string;
  request: SendMessageInDto;
  displayText: string;
  createdAt: string;
  automatic: boolean;
}

export interface ConversationDispatchStateOutDto {
  activeTask: {
    id: string;
    request: SendMessageInDto;
    startedAt: string;
    status: "running" | "recoverable";
  } | null;
  queue: ConversationQueueItemOutDto[];
}

export interface CodexSessionInfoOutDto {
  threadId: string | null;
}
