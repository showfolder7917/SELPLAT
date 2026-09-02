import type { LocaleValue } from "../../../../foundation/index.js";
import type { WorkspaceStateOutDto } from "../../../support/platform/workspace/index.js";

/** 韩立自由对话输入；人物只读讨论，不把发送动作解释为工程写入授权。 */
export interface SendHanliConversationMessageInDto {
  clientMessageId?: string;
  message: string;
  attachmentIds?: string[];
  workspaceState: WorkspaceStateOutDto;
  locale: LocaleValue;
}
