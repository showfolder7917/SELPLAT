import type { LocaleValue } from "../../../../foundation/index.js";
import type { WorkspaceStateOutDto } from "../../../support/platform/workspace/index.js";

/** 可选业务对象引用；公共会话层只转交稳定类型和 ID，不理解人物私有业务。 */
export interface PersonaConversationSubjectInDto {
  type: string;
  id: string;
}

/** Renderer 向任意已注册人物发送消息时使用的统一输入。 */
export interface SendPersonaConversationMessageInDto {
  clientMessageId?: string;
  message: string;
  attachmentIds?: string[];
  subject?: PersonaConversationSubjectInDto;
  workspaceState: WorkspaceStateOutDto;
  locale: LocaleValue;
}
