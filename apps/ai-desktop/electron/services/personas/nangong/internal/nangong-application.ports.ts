import type { CollaborationMemoryPort } from "../../../../../contracts/capabilities/event-center/index.js";
import type { SendMessageResponse } from "../../../../../contracts/capabilities/conversation/index.js";
import type { EvolutionState, SendNangongConversationMessageRequest } from "../../../../../contracts/collaboration/evolution/index.js";
import type { EventCenterExceptionInput } from "../../../../../contracts/governance/workflow.js";
import type { EvolutionMutationPort, EvolutionStatePort } from "../../../evolution/index.js";

/** 南宫向韩立申请提案审查的唯一跨人物端口；审批事实仍由韩立模块写入。 */
export interface NangongProposalReviewPort {
  requestReview(proposalId: string): EvolutionState;
}

/** 南宫查询协同人物显示名的只读端口；不得借此修改成员运行状态。 */
export interface NangongMemberDirectoryPort {
  resolveEnabledDisplayName(memberId: string): string | null;
}

/** 一次性演化的跨人物编排端口；南宫只发出推进请求，流程顺序和恢复由 Workflow 决定。 */
export interface NangongOneShotWorkflowPort {
  hasLiveOwner(state: EvolutionState): boolean;
  advance(): Promise<void>;
  blockFailure(kind: "business" | "technical", operation: string, error: unknown, reason: string, details?: Record<string, unknown>): EvolutionState;
}

/** 南宫 Runtime 的完整装配参数；共享事实与跨模块动作均通过显式 Port 注入。 */
export interface NangongApplicationServiceOptions {
  store: EvolutionStatePort;
  mutations: EvolutionMutationPort;
  conversation: {
    send(request: SendNangongConversationMessageRequest, context: string): Promise<SendMessageResponse>;
    newChat(): Promise<void>;
  };
  memory?: CollaborationMemoryPort | null;
  investigateRevision?: (prompt: string, workspaceState: EvolutionState["topics"][number]["workspaceState"], locale: EvolutionState["topics"][number]["locale"]) => Promise<string>;
  recordEvent(type: string, details: Record<string, unknown>, taskId?: string): void;
  recordFailure?(input: EventCenterExceptionInput): void;
  proposalReview: NangongProposalReviewPort;
  memberDirectory: NangongMemberDirectoryPort;
  oneShotWorkflow: NangongOneShotWorkflowPort;
  newConversationRetryDelaysMs?: number[];
}
