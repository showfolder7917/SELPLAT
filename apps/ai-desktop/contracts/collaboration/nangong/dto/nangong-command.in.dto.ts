/**
 * 南宫婉输入命令协议。
 * 页面或 IPC 把用户输入整理成这些对象后交给南宫婉；这里不保存数据库状态，
 * 也不包含韩立的审批决定或令狐的统一测试指令。
 */
export type {
  ConvertNangongConversationToTopicRequest,
  CreateEvolutionProposalRequest,
  GenerateNangongTopicDraftRequest,
  ReviseEvolutionProposalRequest,
  SendNangongConversationMessageRequest,
  UpdateEvolutionTopicRequest,
} from "../../evolution/dto/evolution-state.out.dto.js";
