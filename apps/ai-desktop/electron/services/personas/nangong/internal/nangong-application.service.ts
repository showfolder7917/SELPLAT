import type {
  ConvertNangongConversationToTopicRequest,
  CreateEvolutionProposalRequest,
  GenerateNangongTopicDraftRequest,
  ReviseEvolutionProposalRequest,
  SendNangongConversationMessageRequest,
  UpdateEvolutionTopicRequest,
} from "../../../../../contracts/collaboration/evolution/index.js";
import type { NangongApplicationPort } from "../nangong.facade.js";
import type { NangongApplicationServiceOptions } from "./nangong-application.ports.js";
import { NangongConversationService } from "./nangong-conversation.service.js";
import { NangongEvolutionAuthoringService } from "./nangong-evolution-authoring.service.js";

export type { NangongApplicationServiceOptions } from "./nangong-application.ports.js";

/** 南宫人物应用入口只组合会话与 Evolution 作者能力，不承载具体业务算法。 */
export class NangongApplicationService implements NangongApplicationPort {
  readonly #conversation: NangongConversationService;
  readonly #authoring: NangongEvolutionAuthoringService;

  /** 装配南宫两个独立业务能力；构造过程不写状态，也不启动 Workflow。 */
  constructor(options: NangongApplicationServiceOptions) {
    this.#conversation = new NangongConversationService(options);
    this.#authoring = new NangongEvolutionAuthoringService(options);
  }

  sendConversationMessage(request: SendNangongConversationMessageRequest) { return this.#conversation.sendConversationMessage(request); }
  newConversation() { return this.#conversation.newConversation(); }
  generateTopicDraft(request: GenerateNangongTopicDraftRequest) { return this.#conversation.generateTopicDraft(request); }
  convertConversationToTopic(request: ConvertNangongConversationToTopicRequest) { return this.#authoring.convertConversationToTopic(request); }
  createProposal(topicId: string, request: CreateEvolutionProposalRequest) { return this.#authoring.createProposal(topicId, request); }
  updateTopic(topicId: string, request: UpdateEvolutionTopicRequest) { return this.#authoring.updateTopic(topicId, request); }
  reviseProposal(proposalId: string, request: ReviseEvolutionProposalRequest) { return this.#authoring.reviseProposal(proposalId, request); }
  investigateAndReviseReturnedProposal(proposalId: string) { return this.#authoring.investigateAndReviseReturnedProposal(proposalId); }
}
