/** 排队发送请求；对话调度器消费该 DTO，不在协议层决定排队策略。 */
import type { SendMessageInDto } from "./send-message.in.dto.js";

export interface EnqueueMessageInDto {
  request: SendMessageInDto;
  displayText?: string;
  automatic?: boolean;
}
