import type { CollaborationMemoryPort } from "../../../../../../contracts/services/support/capabilities/event-center/index.js";
import type { CollaborationTimelineBusinessEventOutDto } from "../../../../../../contracts/services/workflow/index.js";
import type { EvolutionMutationInDto, EvolutionStateOutDto } from "../../../../../../contracts/services/evolution/index.js";
import type { EvolutionStatePort } from "../../../../evolution/index.js";
import type { PromptLibraryPort } from "../../../../support/capabilities/prompts/index.js";
import type { SendPersonaConversationMessageInDto } from "../../../../../../contracts/services/personas/conversation/index.js";
import type { SendMessageOutDto } from "../../../../../../contracts/services/support/capabilities/conversation/index.js";
import type { NangongInquiryResultOutDto } from "../../../../../../contracts/services/personas/nangong/index.js";
import type { HanliComputerAcceptanceInDto } from "../../../../../../contracts/services/personas/hanli/index.js";
import type { CodexDynamicToolsPort } from "../../../../support/platform/codex/index.js";

/** 模型只能声明理解结果和调查范围；客户原问题由程序另行固定，不能由模型生成或覆盖。 */
export interface HanliInquiryUnderstanding {
  /** ready 允许派发南宫婉；clarification-required 必须先向用户澄清。 */
  status: "ready" | "clarification-required";
  /** 韩立对用户原始目标的当前理解，不能替换用户原话。 */
  understoodGoal: string;
  /** 南宫婉需要核实的真实对象或运行状态。 */
  verificationTarget: string;
  /** 调查完成后必须回答用户的核心结论。 */
  expectedAnswer: string;
  /** 会改变调查方向且必须由用户确认的歧义。 */
  ambiguities: string[];
  /** 理解充分后交给南宫婉的补充调查问题。 */
  investigationQuestion?: string;
}

/** 交给南宫婉的只读调查合同同时携带权威原问题和韩立补充范围。 */
export interface HanliInvestigationRequest {
  /** 用户最初提出且不可被模型覆盖的问题。 */
  customerQuestion: string;
  /** 韩立根据当前会话形成的目标理解。 */
  understoodGoal: string;
  /** 南宫婉必须核实的事实对象。 */
  verificationTarget: string;
  /** 南宫婉返回结果必须能够回答的结论。 */
  expectedAnswer: string;
  /** 韩立为补齐证据提出的具体调查问题。 */
  investigationQuestion: string;
}

/** 韩立人物应用服务的装配参数；共同事实和外部对话均通过最小端口注入。 */
export interface HanliApplicationServiceOptions {
  /** Evolution 权威状态端口，提供研讨、专题、提案和验收状态。 */
  store: EvolutionStatePort;
  /** 受版本管理的提示词渲染端口。 */
  prompts: PromptLibraryPort;
  /** 人物会话、调查事实和客户语义的统一数据库端口。 */
  memory?: CollaborationMemoryPort | null;
  /** 韩立内部判断模型端口，只用于提案判断等非普通会话场景。 */
  askHanli?: (prompt: string, state: EvolutionStateOutDto) => Promise<string>;
  /** 后台训练语料语义分析端口。 */
  analyzeCorpus?: (prompt: string) => Promise<string>;
  /** 韩立向南宫婉发起一次只读事实调查的受控端口。 */
  investigateWithNangong?: (inquiry: HanliInvestigationRequest, request: SendPersonaConversationMessageInDto) => Promise<NangongInquiryResultOutDto>;
  /** 人物会话持久状态变化后向全部窗口发布新快照。 */
  onPersonaConversationChanged?: (conversation: import("../../../../../../contracts/services/personas/conversation/index.js").PersonaConversationOutDto) => void;
  /** 韩立普通模型会话；始终使用只读工作区但允许返回观点和调查请求。 */
  conversation?: {
    /** 向当前韩立模型线程发送一轮完整提示。 */
    send(request: SendPersonaConversationMessageInDto, prompt: string): Promise<SendMessageOutDto>;
    /** 关闭旧模型上下文并建立新的空白线程。 */
    newChat(): Promise<void>;
    /** 返回当前 provider 线程标识，仅用于校验会话是否可续接。 */
    activeConversationId(): string | null;
  };
  /** 完整用户回合入库后异步唤醒韩立客户语义整理。 */
  refreshSemanticMemory?: () => void;
  /** 以当前观点创建一次性韩立—南宫婉内部研讨流程。 */
  startInternalDeliberation?: (request: SendPersonaConversationMessageInDto) => Promise<{ continuous: boolean }>;
  /** 把用户确认或纠正交回当前等待中的内部研讨轮次。 */
  replyInternalDeliberationConfirmation?: (reply: string) => Promise<{ customerReply: string }>;
  /** 返回 AGENTS.md 已确认的当前稳定用户标识。 */
  readStableUserId?: () => string;
  /** 返回当前登记工作区对应的客户语义隔离范围。 */
  readProjectScope?: () => string;
  /** 使用受控窗口工具执行韩立真实应用验收。 */
  computerAcceptance?: (
    goal: HanliComputerAcceptanceInDto,
    tools: CodexDynamicToolsPort,
  ) => Promise<void>;
  /** 把人物业务事件和异常写入统一事件中心。 */
  recordEvent(type: string, details: Record<string, unknown>, taskId?: string): void;
  /** 把审批等业务事实追加到任务协作群时间线。 */
  recordTimelineEvent?: (event: CollaborationTimelineBusinessEventOutDto) => void;
  /** 在状态修改前登记幂等 Mutation。 */
  beginMutation?: (
    topicId: string,
    action: string,
    request: EvolutionMutationInDto,
    currentStateVersion: string,
  ) => "started" | "completed";
  /** 状态修改成功后保存最新状态版本。 */
  completeMutation?: (idempotencyKey: string, resultStateVersion: string) => void;
  /** 状态修改失败后保存错误并允许受控恢复。 */
  failMutation?: (idempotencyKey: string, error: unknown) => void;
}
