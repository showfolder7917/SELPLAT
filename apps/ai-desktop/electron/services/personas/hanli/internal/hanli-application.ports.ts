import type { CollaborationMemoryPort } from "../../../../../contracts/services/support/capabilities/event-center/index.js";
import type { CollaborationTimelineBusinessEventOutDto } from "../../../../../contracts/services/workflow/index.js";
import type { EvolutionStateOutDto } from "../../../../../contracts/services/evolution/index.js";
import type { EvolutionStatePort } from "../../../evolution/index.js";
import type { PromptLibraryPort } from "../../../support/capabilities/prompts/index.js";
import type { SendPersonaConversationMessageInDto } from "../../../../../contracts/services/personas/conversation/index.js";
import type { SendMessageOutDto } from "../../../../../contracts/services/support/capabilities/conversation/index.js";

/** 韩立人物应用服务的装配参数；共同事实和外部对话均通过最小端口注入。 */
export interface HanliApplicationServiceOptions {
  store: EvolutionStatePort;
  prompts: PromptLibraryPort;
  memory?: CollaborationMemoryPort | null;
  askHanli?: (prompt: string, state: EvolutionStateOutDto) => Promise<string>;
  analyzeCorpus?: (prompt: string) => Promise<string>;
  conversation?: {
    send(request: SendPersonaConversationMessageInDto, prompt: string): Promise<SendMessageOutDto>;
    newChat(): Promise<void>;
    activeConversationId(): string | null;
  };
  refreshSemanticMemory?: () => void;
  startInternalDeliberation?: (request: SendPersonaConversationMessageInDto) => Promise<{ continuous: boolean }>;
  readStableUserId?: () => string;
  readProjectScope?: () => string;
  planAcceptance?: (prompt: string, workspaceState: EvolutionStateOutDto["topics"][number]["workspaceState"], locale: EvolutionStateOutDto["topics"][number]["locale"]) => Promise<string>;
  recordEvent(type: string, details: Record<string, unknown>, taskId?: string): void;
  recordTimelineEvent?: (event: CollaborationTimelineBusinessEventOutDto) => void;
  beginMutation?: (topicId: string, action: string, request: import("../../../../../contracts/services/evolution/index.js").EvolutionMutationInDto, currentStateVersion: string) => "started" | "completed";
  completeMutation?: (idempotencyKey: string, resultStateVersion: string) => void;
  failMutation?: (idempotencyKey: string, error: unknown) => void;
}
