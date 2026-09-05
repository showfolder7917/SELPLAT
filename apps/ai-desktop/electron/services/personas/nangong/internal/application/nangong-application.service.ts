import type {
  ConvertNangongConversationToTopicInDto,
  CreateNangongProposalInDto,
  GenerateNangongTopicDraftInDto,
  ReviseNangongProposalInDto,
  UpdateNangongTopicInDto,
} from "../../../../../../contracts/services/personas/nangong/index.js";
import type { SendPersonaConversationMessageInDto } from "../../../../../../contracts/services/personas/conversation/index.js";
import type { NangongApplicationPort } from "../../nangong.facade.js";
import type { EvolutionMutationInDto } from "../../../../../../contracts/services/evolution/index.js";
import type { NangongApplicationServiceOptions } from "./nangong-application.ports.js";
import { NangongConversationService } from "../conversation/nangong-conversation.service.js";
import { NangongEvolutionAuthoringService } from "../evolution/nangong-evolution-authoring.service.js";

export type { NangongApplicationServiceOptions } from "./nangong-application.ports.js";

/** 南宫人物应用入口只组合会话与 Evolution 作者能力，不承载具体业务算法。 */
export class NangongApplicationService implements NangongApplicationPort {
  readonly #conversation: NangongConversationService;
  readonly #authoring: NangongEvolutionAuthoringService;
  readonly #taskDistribution: NangongApplicationServiceOptions["taskDistribution"];

  /** 装配南宫两个独立业务能力；构造过程不写状态，也不启动 Workflow。 */
  constructor(options: NangongApplicationServiceOptions) {
    this.#conversation = new NangongConversationService(options);
    this.#authoring = new NangongEvolutionAuthoringService(options);
    this.#taskDistribution = options.taskDistribution;
  }

  sendConversationMessage(request: SendPersonaConversationMessageInDto) { return this.#conversation.sendConversationMessage(request); }
  newConversation() { return this.#conversation.newConversation(); }
  generateTopicDraft(request: GenerateNangongTopicDraftInDto) { return this.#conversation.generateTopicDraft(request); }
  convertConversationToTopic(request: ConvertNangongConversationToTopicInDto) { return this.#authoring.convertConversationToTopic(request); }
  createProposal(topicId: string, request: CreateNangongProposalInDto) { return this.#authoring.createProposal(topicId, request); }
  updateTopic(topicId: string, request: UpdateNangongTopicInDto) { return this.#authoring.updateTopic(topicId, request); }
  reviseProposal(proposalId: string, request: ReviseNangongProposalInDto) { return this.#authoring.reviseProposal(proposalId, request); }
  investigateAndReviseReturnedProposal(proposalId: string) { return this.#authoring.investigateAndReviseReturnedProposal(proposalId); }
  distributeProposal(proposalId: string, request?: EvolutionMutationInDto) { return this.#taskDistribution.dispatch(proposalId, request); }
}
