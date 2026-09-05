import type {
  ConvertNangongConversationToTopicInDto,
  CreateNangongProposalInDto,
  GenerateNangongTopicDraftInDto,
  NangongTopicDraftOutDto,
  ReviseNangongProposalInDto,
  UpdateNangongTopicInDto,
} from "../../../../contracts/services/personas/nangong/index.js";
import type { SendPersonaConversationMessageInDto } from "../../../../contracts/services/personas/conversation/index.js";
import type { EvolutionStateOutDto } from "../../../../contracts/services/evolution/index.js";
import type { EvolutionMutationInDto } from "../../../../contracts/services/evolution/index.js";
import { NangongApplicationService, type NangongApplicationServiceOptions } from "./internal/nangong-application.service.js";
export { nangongInquiryResult, nangongInquiryWithCorrection } from "./internal/nangong-inquiry-result.js";

/**
 * 南宫人物所需的最小应用端口。
 *
 * 端口只列出南宫真正拥有的对话、调查、专题和提案作者能力。
 * 它不会暴露韩立审批、令狐测试或 Workflow 自动轮转方法。
 */
export interface NangongApplicationPort {
  sendConversationMessage(request: SendPersonaConversationMessageInDto): Promise<EvolutionStateOutDto>;
  newConversation(): Promise<EvolutionStateOutDto>;
  generateTopicDraft(request: GenerateNangongTopicDraftInDto): Promise<NangongTopicDraftOutDto>;
  convertConversationToTopic(request: ConvertNangongConversationToTopicInDto): EvolutionStateOutDto;
  createProposal(topicId: string, request: CreateNangongProposalInDto): EvolutionStateOutDto;
  updateTopic(topicId: string, request: UpdateNangongTopicInDto): EvolutionStateOutDto;
  reviseProposal(proposalId: string, request: ReviseNangongProposalInDto): EvolutionStateOutDto;
  investigateAndReviseReturnedProposal(proposalId: string): Promise<EvolutionStateOutDto>;
  distributeProposal(proposalId: string, request?: EvolutionMutationInDto): Promise<EvolutionStateOutDto>;
}

/** 南宫 Runtime 的装配参数；共享状态和跨人物动作都以最小端口注入。 */
export type CreateNangongRuntimeOptions = NangongApplicationServiceOptions;

/** 南宫人物运行对象；生命周期只控制人物入口，不拥有共同 Evolution 状态。 */
export interface NangongRuntime {
  readonly memberId: "nangong-wan";
  readonly facade: NangongFacade;
  start(): void;
  stop(): void;
}

/**
 * 南宫婉唯一公开业务入口。
 *
 * 新手阅读提示：每个方法只把属于南宫的请求交给应用端口；共同状态由 Evolution 保存，
 * 跨人物下一步由 Workflow 决定，因此这里看不到韩立或令狐的内部类。
 */
export class NangongFacade {
  readonly #application: NangongApplicationPort;

  /** 传入已装配应用端口；构造过程不读写文件，也不启动自动流程。 */
  constructor(application: NangongApplicationPort) { this.#application = application; }
  /** 发送南宫对话；返回包含本轮人物消息的最新状态，失败时保留原发送失败语义。 */
  sendConversationMessage(request: SendPersonaConversationMessageInDto) { return this.#application.sendConversationMessage(request); }
  /** 建立新的南宫会话；不会删除专题、提案或韩立审批记录。 */
  newConversation() { return this.#application.newConversation(); }
  /** 根据当前南宫对话生成可编辑草稿；生成结果尚未成为正式专题。 */
  generateTopicDraft(request: GenerateNangongTopicDraftInDto) { return this.#application.generateTopicDraft(request); }
  /** 把用户确认过的南宫对话转换成 Evolution 专题事实。 */
  convertConversationToTopic(request: ConvertNangongConversationToTopicInDto) { return this.#application.convertConversationToTopic(request); }
  /** 为指定专题创建南宫提案；审批仍由韩立入口处理。 */
  createProposal(topicId: string, request: CreateNangongProposalInDto) { return this.#application.createProposal(topicId, request); }
  /** 修正专题描述；共同专题的新版本仍由 Evolution 原子保存。 */
  updateTopic(topicId: string, request: UpdateNangongTopicInDto) { return this.#application.updateTopic(topicId, request); }
  /** 根据明确反馈提交新提案版本，不覆盖旧版本和审批历史。 */
  reviseProposal(proposalId: string, request: ReviseNangongProposalInDto) { return this.#application.reviseProposal(proposalId, request); }
  /** 调查退回原因；只有产生新的可核验事实时才提交返修版本。 */
  investigateAndReviseReturnedProposal(proposalId: string) { return this.#application.investigateAndReviseReturnedProposal(proposalId); }
  /** 将审批通过的提案拆分为独立任务，并指定或排队等待通用执行人。 */
  distributeProposal(proposalId: string, request?: EvolutionMutationInDto) { return this.#application.distributeProposal(proposalId, request); }
}

/** 创建南宫独立 Runtime；人物应用服务在模块内部装配，外部只能取得 Facade。 */
export function createNangongRuntime(options: CreateNangongRuntimeOptions): NangongRuntime {
  const facade = new NangongFacade(new NangongApplicationService(options));
  return { memberId: "nangong-wan", facade, start: () => undefined, stop: () => undefined };
}
