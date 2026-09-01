import type { CollaborationMemoryPort } from "../../../../../contracts/capabilities/event-center/index.js";
import type { CollaborationTimelineBusinessEvent } from "../../../../../contracts/collaboration/workflow/index.js";
import type { EvolutionState } from "../../../../../contracts/collaboration/evolution/index.js";
import type { EvolutionStatePort } from "../../../evolution/index.js";

/** 韩立人物应用服务的装配参数；共同事实和外部对话均通过最小端口注入。 */
export interface HanliApplicationServiceOptions {
  store: EvolutionStatePort;
  memory?: CollaborationMemoryPort | null;
  askHanli?: (prompt: string, state: EvolutionState) => Promise<string>;
  askNangong?: (question: string, context: string, state: EvolutionState) => Promise<string>;
  planAcceptance?: (prompt: string, workspaceState: EvolutionState["topics"][number]["workspaceState"], locale: EvolutionState["topics"][number]["locale"]) => Promise<string>;
  recordEvent(type: string, details: Record<string, unknown>, taskId?: string): void;
  recordTimelineEvent?: (event: CollaborationTimelineBusinessEvent) => void;
  beginMutation?: (topicId: string, action: string, request: import("../../../../../contracts/collaboration/evolution/index.js").EvolutionMutationRequest, currentStateVersion: string) => "started" | "completed";
  completeMutation?: (idempotencyKey: string, resultStateVersion: string) => void;
  failMutation?: (idempotencyKey: string, error: unknown) => void;
}
