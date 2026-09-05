import type { BrowserWindow } from "electron";
import type {
  DecideHanliProposalInDto,
  DecideHanliResultInDto,
  HanliComputerAcceptanceInDto,
  HanliAcceptanceRunOutDto,
} from "../../../../contracts/services/personas/hanli/index.js";
import type { PersonaConversationOutDto, SendPersonaConversationMessageInDto } from "../../../../contracts/services/personas/conversation/index.js";
import type { EvolutionMutationInDto, EvolutionStateOutDto } from "../../../../contracts/services/evolution/index.js";
import type { AttachmentFacade } from "../../support/platform/attachments/index.js";
import { HanliApplicationService, type HanliApplicationServiceOptions } from "./internal/application/hanli-application.service.js";
import { HanliComputerAcceptance } from "./internal/acceptance/hanli-computer-acceptance.js";
import { HanliSemanticExtractionRunner } from "./internal/semantic/hanli-semantic-extraction.runner.js";

/** 韩立人物端口只包含自身自由讨论、审批和验收，不包含南宫对话或令狐恢复。 */
export interface HanliApplicationPort {
  /** 读取韩立当前业务会话。 */
  conversation(): PersonaConversationOutDto;
  /** 向韩立当前业务会话发送一条用户消息。 */
  sendConversationMessage(request: SendPersonaConversationMessageInDto): Promise<PersonaConversationOutDto>;
  /** 归档当前业务会话并创建新会话。 */
  newConversation(): Promise<PersonaConversationOutDto>;
  /** 登记等待韩立审批的提案。 */
  requestProposalReview(proposalId: string): EvolutionStateOutDto;
  /** 保存用户作出的人工审批决定。 */
  decideProposal(proposalId: string, request: DecideHanliProposalInDto): EvolutionStateOutDto;
  /** 请求韩立自动审阅一次性提案。 */
  reviewAndDecideProposal(proposalId: string): Promise<EvolutionStateOutDto>;
  /** 根据已经沉淀的人工偏好尝试自动审批。 */
  autoApprove(proposalId: string, request?: EvolutionMutationInDto): EvolutionStateOutDto;
  /** 保存真实应用验收过程产生的证据。 */
  recordAcceptanceRun(run: HanliAcceptanceRunOutDto): EvolutionStateOutDto;
  /** 根据真实应用验收结果形成自动验收决定。 */
  completeAutomaticAcceptance(run: HanliAcceptanceRunOutDto, idempotencyKey: string): EvolutionStateOutDto;
  /** 保存用户作出的最终结果判断。 */
  decideResult(proposalId: string, request: DecideHanliResultInDto): EvolutionStateOutDto;
}

/** Workflow 可调用的韩立最小端口；不包含人工 IPC 或真实窗口执行能力。 */
export interface HanliWorkflowPort {
  /** Workflow 登记待审批提案的唯一入口。 */
  requestProposalReview(proposalId: string): EvolutionStateOutDto;
  /** Workflow 请求韩立完成一次审批判断的入口。 */
  reviewAndDecideProposal(proposalId: string): Promise<EvolutionStateOutDto>;
  /** Workflow 根据历史偏好请求自动审批的入口。 */
  autoApprove(proposalId: string, request?: EvolutionMutationInDto): EvolutionStateOutDto;
  /** Workflow 提交真实验收结果的入口。 */
  completeAutomaticAcceptance(run: HanliAcceptanceRunOutDto, idempotencyKey: string): EvolutionStateOutDto;
}

/** 韩立 Runtime 的装配参数；共同状态仍由 Evolution 管理，人物应用服务在模块内创建。 */
export type CreateHanliRuntimeOptions = HanliApplicationServiceOptions & { screenshots: AttachmentFacade };

/** 韩立人物运行对象，提供稳定身份、公开门面和独立生命周期。 */
export interface HanliRuntime {
  /** 韩立在任务协作群中的稳定人物标识。 */
  readonly memberId: "han-li";
  /** 对外公开的韩立业务门面。 */
  readonly facade: HanliFacade;
  /** 启动韩立后台语义提取生命周期。 */
  start(): void;
  /** 停止韩立后台语义提取生命周期。 */
  stop(): void;
  /** 请求立即刷新韩立的派生语义记忆。 */
  refreshSemanticMemory(): void;
}

/** 韩立唯一公开业务入口；调用方无法通过它修改南宫私有会话。 */
export class HanliFacade {
  /** 韩立应用层端口；门面只转发公开用例，不读取内部服务。 */
  readonly #application: HanliApplicationPort;
  /** 真实窗口验收控制器；只在明确验收用例中使用。 */
  readonly #computer: HanliComputerAcceptance;
  /** Runtime 装配参数；提供事件、记忆和外部能力端口。 */
  readonly #options: CreateHanliRuntimeOptions;
  /** 传入韩立能力端口；构造时不执行审批，也不自动判定结果。 */
  constructor(application: HanliApplicationPort, computer: HanliComputerAcceptance, options: CreateHanliRuntimeOptions) {
    this.#application = application;
    this.#computer = computer;
    this.#options = options;
  }
  /** 读取 ownerPersonaId=han-li 的当前业务会话；底层 Codex threadId 不对页面暴露。 */
  conversation(): PersonaConversationOutDto {
    return this.#application.conversation();
  }
  /** 与韩立自由讨论；人物使用语义记忆精准追问，但不执行工程写入。 */
  sendConversationMessage(request: SendPersonaConversationMessageInDto): Promise<PersonaConversationOutDto> {
    return this.#application.sendConversationMessage(request);
  }
  /** 重置韩立的模型线程并新建空白业务会话；旧业务会话只归档，不删除历史消息。 */
  newConversation(): Promise<PersonaConversationOutDto> {
    return this.#application.newConversation();
  }
  /** 接收南宫或令狐提交的提案并登记审批申请，不提前生成审批结论。 */
  requestProposalReview(proposalId: string): EvolutionStateOutDto {
    return this.#application.requestProposalReview(proposalId);
  }
  /** 记录人工方向审批；返回 Evolution 保存后的最新共同状态。 */
  decideProposal(proposalId: string, request: DecideHanliProposalInDto): EvolutionStateOutDto {
    return this.#application.decideProposal(proposalId, request);
  }
  /** 一次性流程请求韩立审查并保存正式决定；调用方不能替韩立拼装结论。 */
  reviewAndDecideProposal(proposalId: string): Promise<EvolutionStateOutDto> {
    return this.#application.reviewAndDecideProposal(proposalId);
  }
  /** 根据已登记偏好执行受控自动审批；缺少事实时退回补充。 */
  autoApprove(proposalId: string, request?: EvolutionMutationInDto): EvolutionStateOutDto {
    return this.#application.autoApprove(proposalId, request);
  }
  /** 保存真实应用验收运行证据；计划与提案不一致时阻断写入。 */
  recordAcceptanceRun(run: HanliAcceptanceRunOutDto): EvolutionStateOutDto {
    return this.#application.recordAcceptanceRun(run);
  }
  /** 一次性流程提交真实运行证据；韩立据此保存自动验收判断。 */
  completeAutomaticAcceptance(run: HanliAcceptanceRunOutDto, idempotencyKey: string): EvolutionStateOutDto {
    return this.#application.completeAutomaticAcceptance(run, idempotencyKey);
  }
  /** 每次工具调用返回真实截图，韩立自行选择下一步并形成结论。 */
  executeComputerAcceptance(goal: HanliComputerAcceptanceInDto, targetWindow: BrowserWindow) {
    if (!this.#options.computerAcceptance) {
      throw new Error("韩立Computer Use尚未接入");
    }
    const conversationId = this.#options.memory?.readPersonaConversation("han-li").conversationId;
    return this.#computer.run(goal, targetWindow, (tools) => this.#options.computerAcceptance!(goal, tools), (content) => {
      this.#options.recordEvent("hanli.acceptance.computer_progress", { proposalId: goal.proposalId, content });
      if (conversationId && this.#options.memory) {
        const next = this.#options.memory.appendPersonaInternalMessage({
          ownerPersonaId: "han-li",
          conversationId,
          messageId: "computer:" + crypto.randomUUID(),
          speakerPersonaId: "han-li",
          content,
          createdAt: new Date().toISOString(),
        });
        this.#options.onPersonaConversationChanged?.(next);
      }
    });
  }
  /** 审批最终执行结果；旧提案与既有验收证据不会被覆盖。 */
  decideResult(proposalId: string, request: DecideHanliResultInDto): EvolutionStateOutDto {
    return this.#application.decideResult(proposalId, request);
  }
}

/** 创建韩立独立 Runtime；人物开关和 Workflow 自动化开关保持分离。 */
export function createHanliRuntime(options: CreateHanliRuntimeOptions): HanliRuntime {
  // 单步交互控制器由韩立拥有；IPC只传入目标窗口，不编排动作。
  const facade = new HanliFacade(new HanliApplicationService(options), new HanliComputerAcceptance(options.screenshots), options);
  const semanticExtraction = new HanliSemanticExtractionRunner({
    memory: options.memory || null,
    prompts: options.prompts,
    analyze: options.analyzeCorpus || (async () => {
      throw new Error("韩立训练语料分析器尚未接入。");
    }),
    readStableUserId: options.readStableUserId || (() => {
      throw new Error("当前稳定用户尚未解析。");
    }),
    readProjectScope: options.readProjectScope || (() => "global"),
    recordEvent: options.recordEvent,
  });
  return {
    memberId: "han-li",
    facade,
    start: () => {
      semanticExtraction.start();
    },
    stop: () => {
      semanticExtraction.stop();
    },
    refreshSemanticMemory: () => {
      semanticExtraction.trigger("corpus-ingested");
    },
  };
}
