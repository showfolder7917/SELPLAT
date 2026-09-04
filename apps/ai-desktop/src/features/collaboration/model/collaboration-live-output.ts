import type { Message } from "../../conversation/model/chat-message";

/** 每个协同流式回合保留收到时的环节，避免状态推进后把旧报告错放到新环节。 */
export interface CollaborationLiveOutput {
  message: Message;
  turnId: string;
}
