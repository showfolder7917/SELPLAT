import type { BrowserWindow } from "electron";
import type {
  DecideHanliProposalInDto,
  DecideHanliResultInDto,
  HanliAcceptancePlanOutDto,
  HanliAcceptanceRunOutDto,
  HanliConversationOutDto,
  SendHanliConversationMessageInDto,
} from "../../../../contracts/services/personas/hanli/index.js";
import type { EvolutionMutationInDto, EvolutionStateOutDto } from "../../../../contracts/services/evolution/index.js";
import type { AttachmentFacade } from "../../support/platform/attachments/index.js";
import { HanliApplicationService, type HanliApplicationServiceOptions } from "./internal/hanli-application.service.js";
import { HanliRealAppAcceptanceRunner } from "./internal/hanli-real-app-acceptance.runner.js";
import { HanliSemanticExtractionRunner } from "./internal/hanli-semantic-extraction.runner.js";

/** 韩立人物端口只包含自身自由讨论、审批和验收，不包含南宫对话或令狐恢复。 */
export interface HanliApplicationPort {
  conversation(): HanliConversationOutDto;
  sendConversationMessage(request: SendHanliConversationMessageInDto): Promise<HanliConversationOutDto>;
  newConversation(): Promise<HanliConversationOutDto>;
  requestProposalReview(proposalId: string): EvolutionStateOutDto;
  decideProposal(proposalId: string, request: DecideHanliProposalInDto): EvolutionStateOutDto;
  reviewAndDecideProposal(proposalId: string): Promise<EvolutionStateOutDto>;
  autoApprove(proposalId: string, request?: EvolutionMutationInDto): EvolutionStateOutDto;
  generateAcceptancePlan(proposalId: string): Promise<HanliAcceptancePlanOutDto>;
  acceptancePlan(planId: string): HanliAcceptancePlanOutDto;
  recordAcceptanceRun(run: HanliAcceptanceRunOutDto): EvolutionStateOutDto;
  completeAutomaticAcceptance(run: HanliAcceptanceRunOutDto, idempotencyKey: string): EvolutionStateOutDto;
  decideResult(proposalId: string, request: DecideHanliResultInDto): EvolutionStateOutDto;
}

/** Workflow 可调用的韩立最小端口；不包含人工 IPC 或真实窗口执行能力。 */
export interface HanliWorkflowPort {
  requestProposalReview(proposalId: string): EvolutionStateOutDto;
  reviewAndDecideProposal(proposalId: string): Promise<EvolutionStateOutDto>;
  autoApprove(proposalId: string, request?: EvolutionMutationInDto): EvolutionStateOutDto;
  generateAcceptancePlan(proposalId: string): Promise<HanliAcceptancePlanOutDto>;
  completeAutomaticAcceptance(run: HanliAcceptanceRunOutDto, idempotencyKey: string): EvolutionStateOutDto;
}

/** 韩立 Runtime 的装配参数；共同状态仍由 Evolution 管理，人物应用服务在模块内创建。 */
export type CreateHanliRuntimeOptions = HanliApplicationServiceOptions & { screenshots: AttachmentFacade };

/** 韩立人物运行对象，提供稳定身份、公开门面和独立生命周期。 */
export interface HanliRuntime {
  readonly memberId: "han-li";
  readonly facade: HanliFacade;
  start(): void;
  stop(): void;
  refreshSemanticMemory(): void;
}

/** 韩立唯一公开业务入口；调用方无法通过它修改南宫私有会话。 */
export class HanliFacade {
  readonly #application: HanliApplicationPort;
  readonly #acceptanceRunner: HanliRealAppAcceptanceRunner;
  /** 传入韩立能力端口；构造时不执行审批，也不自动判定结果。 */
  constructor(application: HanliApplicationPort, acceptanceRunner: HanliRealAppAcceptanceRunner) {
    this.#application = application;
    this.#acceptanceRunner = acceptanceRunner;
  }
  /** 读取韩立固定人物线程中的自由对话。 */
  conversation() { return this.#application.conversation(); }
  /** 与韩立自由讨论；人物使用语义记忆精准追问，但不执行工程写入。 */
  sendConversationMessage(request: SendHanliConversationMessageInDto) { return this.#application.sendConversationMessage(request); }
  /** 删除当前韩立线程并返回空白人物会话。 */
  newConversation() { return this.#application.newConversation(); }
  /** 接收南宫或令狐提交的提案并登记审批申请，不提前生成审批结论。 */
  requestProposalReview(proposalId: string) { return this.#application.requestProposalReview(proposalId); }
  /** 记录人工方向审批；返回 Evolution 保存后的最新共同状态。 */
  decideProposal(proposalId: string, request: DecideHanliProposalInDto) { return this.#application.decideProposal(proposalId, request); }
  /** 一次性流程请求韩立审查并保存正式决定；调用方不能替韩立拼装结论。 */
  reviewAndDecideProposal(proposalId: string) { return this.#application.reviewAndDecideProposal(proposalId); }
  /** 根据已登记偏好执行受控自动审批；缺少事实时退回补充。 */
  autoApprove(proposalId: string, request?: EvolutionMutationInDto) { return this.#application.autoApprove(proposalId, request); }
  /** 根据当前专题和提案生成真实应用验收计划，但不会伪造执行结果。 */
  generateAcceptancePlan(proposalId: string) { return this.#application.generateAcceptancePlan(proposalId); }
  /** 读取已保存验收计划；不存在时抛出可理解错误。 */
  acceptancePlan(planId: string) { return this.#application.acceptancePlan(planId); }
  /** 保存真实应用验收运行证据；计划与提案不一致时阻断写入。 */
  recordAcceptanceRun(run: HanliAcceptanceRunOutDto) { return this.#application.recordAcceptanceRun(run); }
  /** 一次性流程提交真实运行证据；韩立据此保存自动验收判断。 */
  completeAutomaticAcceptance(run: HanliAcceptanceRunOutDto, idempotencyKey: string) { return this.#application.completeAutomaticAcceptance(run, idempotencyKey); }
  /** 在真实 Electron 窗口执行白名单验收操作；危险写按钮会被 Runner 阻断。 */
  executeAcceptancePlan(plan: HanliAcceptancePlanOutDto, targetWindow: BrowserWindow) { return this.#acceptanceRunner.execute(plan, targetWindow); }
  /** 审批最终执行结果；旧提案与既有验收证据不会被覆盖。 */
  decideResult(proposalId: string, request: DecideHanliResultInDto) { return this.#application.decideResult(proposalId, request); }
}

/** 创建韩立独立 Runtime；人物开关和 Workflow 自动化开关保持分离。 */
export function createHanliRuntime(options: CreateHanliRuntimeOptions): HanliRuntime {
  // Runner 在韩立 Runtime 内创建，IPC 只看到受控 Facade 方法，不能取得 Runner 对象。
  const facade = new HanliFacade(new HanliApplicationService(options), new HanliRealAppAcceptanceRunner(options.screenshots));
  const semanticExtraction = new HanliSemanticExtractionRunner({
    memory: options.memory || null,
    prompts: options.prompts,
    analyze: options.analyzeCorpus || (async () => { throw new Error("韩立训练语料分析器尚未接入。"); }),
    readStableUserId: options.readStableUserId || (() => { throw new Error("当前稳定用户尚未解析。"); }),
    readProjectScope: options.readProjectScope || (() => "global"),
    recordEvent: options.recordEvent,
  });
  return {
    memberId: "han-li", facade,
    start: () => semanticExtraction.start(),
    stop: () => semanticExtraction.stop(),
    refreshSemanticMemory: () => semanticExtraction.trigger("corpus-ingested"),
  };
}
