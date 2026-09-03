import type { CollaborationMemoryPort } from "../../../../../contracts/services/support/capabilities/event-center/index.js";
import type { SendMessageOutDto } from "../../../../../contracts/services/support/capabilities/conversation/index.js";
import type { EvolutionMutationInDto, EvolutionStateOutDto } from "../../../../../contracts/services/evolution/index.js";
import type { SendPersonaConversationMessageInDto } from "../../../../../contracts/services/personas/conversation/index.js";
import type { EventCenterExceptionInDto } from "../../../../../contracts/services/support/capabilities/event-center/index.js";
import type { EvolutionMutationPort, EvolutionStatePort } from "../../../evolution/index.js";
import type { PromptLibraryPort } from "../../../support/capabilities/prompts/index.js";

/** 南宫向韩立申请提案审查的唯一跨人物端口；审批事实仍由韩立模块写入。 */
export interface NangongProposalReviewPort {
  requestReview(proposalId: string): EvolutionStateOutDto;
}

/** 南宫查询协同人物显示名的只读端口；不得借此修改成员运行状态。 */
export interface NangongMemberDirectoryPort {
  resolveEnabledDisplayName(memberId: string): string | null;
}

/** 一次性演化的跨人物编排端口；南宫只发出推进请求，流程顺序和恢复由 Workflow 决定。 */
export interface NangongOneShotWorkflowPort {
  hasLiveOwner(state: EvolutionStateOutDto): boolean;
  advance(): Promise<void>;
  blockFailure(kind: "business" | "technical", operation: string, error: unknown, reason: string, details?: Record<string, unknown>): EvolutionStateOutDto;
}

/** 南宫婉将已审批提案拆分并分发给通用执行人的人物能力。 */
export interface NangongTaskDistributionPort {
  dispatch(proposalId: string, request?: EvolutionMutationInDto): Promise<EvolutionStateOutDto>;
}

/** 南宫 Runtime 的完整装配参数；共享事实与跨模块动作均通过显式 Port 注入。 */
export interface NangongApplicationServiceOptions {
  store: EvolutionStatePort;
  prompts: PromptLibraryPort;
  mutations: EvolutionMutationPort;
  conversation: {
    send(request: SendPersonaConversationMessageInDto, context: string): Promise<SendMessageOutDto>;
    newChat(): Promise<void>;
  };
  memory?: CollaborationMemoryPort | null;
  refreshSemanticMemory?: () => void;
  investigateRevision?: (prompt: string, workspaceState: EvolutionStateOutDto["topics"][number]["workspaceState"], locale: EvolutionStateOutDto["topics"][number]["locale"]) => Promise<string>;
  recordEvent(type: string, details: Record<string, unknown>, taskId?: string): void;
  recordFailure?(input: EventCenterExceptionInDto): void;
  proposalReview: NangongProposalReviewPort;
  memberDirectory: NangongMemberDirectoryPort;
  oneShotWorkflow: NangongOneShotWorkflowPort;
  taskDistribution: NangongTaskDistributionPort;
  newConversationRetryDelaysMs?: number[];
}
