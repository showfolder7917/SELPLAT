import type { CollaborationMemoryPort } from "../../../../../contracts/services/support/capabilities/event-center/index.js";
import type { CollaborationTimelineBusinessEventOutDto } from "../../../../../contracts/services/workflow/index.js";
import type { EvolutionStateOutDto } from "../../../../../contracts/services/evolution/index.js";
import type { EvolutionStatePort } from "../../../evolution/index.js";
import type { PromptLibraryPort } from "../../../support/capabilities/prompts/index.js";
import type { SendPersonaConversationMessageInDto } from "../../../../../contracts/services/personas/conversation/index.js";
import type { SendMessageOutDto } from "../../../../../contracts/services/support/capabilities/conversation/index.js";
import type { NangongInquiryResultOutDto } from "../../../../../contracts/services/personas/nangong/index.js";

/** 模型只能声明理解结果和调查范围；客户原问题由程序另行固定，不能由模型生成或覆盖。 */
export interface HanliInquiryUnderstanding {
  status: "ready" | "clarification-required";
  understoodGoal: string;
  verificationTarget: string;
  expectedAnswer: string;
  ambiguities: string[];
  investigationQuestion?: string;
}

/** 交给南宫婉的只读调查合同同时携带权威原问题和韩立补充范围。 */
export interface HanliInvestigationRequest {
  customerQuestion: string;
  understoodGoal: string;
  verificationTarget: string;
  expectedAnswer: string;
  investigationQuestion: string;
}

/** 韩立人物应用服务的装配参数；共同事实和外部对话均通过最小端口注入。 */
export interface HanliApplicationServiceOptions {
  store: EvolutionStatePort;
  prompts: PromptLibraryPort;
  memory?: CollaborationMemoryPort | null;
  askHanli?: (prompt: string, state: EvolutionStateOutDto) => Promise<string>;
  analyzeCorpus?: (prompt: string) => Promise<string>;
  investigateWithNangong?: (inquiry: HanliInvestigationRequest, request: SendPersonaConversationMessageInDto) => Promise<NangongInquiryResultOutDto>;
  onPersonaConversationChanged?: (conversation: import("../../../../../contracts/services/personas/conversation/index.js").PersonaConversationOutDto) => void;
  conversation?: {
    send(request: SendPersonaConversationMessageInDto, prompt: string): Promise<SendMessageOutDto>;
    newChat(): Promise<void>;
    activeConversationId(): string | null;
  };
  refreshSemanticMemory?: () => void;
  startInternalDeliberation?: (request: SendPersonaConversationMessageInDto) => Promise<{ continuous: boolean }>;
  replyInternalDeliberationConfirmation?: (reply: string) => Promise<{ customerReply: string }>;
  readStableUserId?: () => string;
  readProjectScope?: () => string;
  computerAcceptance?: (goal: import("../../../../../contracts/services/personas/hanli/index.js").HanliComputerAcceptanceInDto, tools: import("../../../support/platform/codex/index.js").CodexDynamicToolsPort) => Promise<void>;
  recordEvent(type: string, details: Record<string, unknown>, taskId?: string): void;
  recordTimelineEvent?: (event: CollaborationTimelineBusinessEventOutDto) => void;
  beginMutation?: (topicId: string, action: string, request: import("../../../../../contracts/services/evolution/index.js").EvolutionMutationInDto, currentStateVersion: string) => "started" | "completed";
  completeMutation?: (idempotencyKey: string, resultStateVersion: string) => void;
  failMutation?: (idempotencyKey: string, error: unknown) => void;
}
