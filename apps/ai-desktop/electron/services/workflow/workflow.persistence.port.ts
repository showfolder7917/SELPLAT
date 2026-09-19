import type { ApprovalGovernanceRecordOutDto, CollaborationStateOutDto, StalledTaskDetectionOutDto, WorkflowEventInDto, WorkflowExceptionRecordOutDto } from "../../../contracts/services/workflow/index.js";
import type { LinghuAutomationStateOutDto } from "../../../contracts/services/personas/linghu/index.js";
import type { EvolutionStateOutDto, EvolutionTopicDossierOutDto } from "../../../contracts/services/evolution/index.js";
import type { WorkflowCheckpointState } from "./domain/workflow-checkpoint.aggregate.js";

export interface CodexApprovalDecisionRecord {
  requestId: number;
  title: string;
  kind: string;
  decision: "accept" | "decline";
  command?: string;
  cwd?: string;
  trusted: boolean;
  correlationId?: string | null;
}

/** Workflow 所需的业务化持久化端口；调用方不能取得连接或执行任意 SQL。 */
export interface WorkflowPersistencePort {
  startRuntimeSession(processId?: number, now?: string): string[];
  heartbeatRuntimeSession(now?: string): void;
  stopRuntimeSession(now?: string): void;
  recordEvent(input: WorkflowEventInDto): string;
  beginEvolutionMutation(topicId: string, action: string, request: { expectedStateVersion: string; idempotencyKey: string }, currentStateVersion: string, now?: string): "started" | "completed";
  completeEvolutionMutation(idempotencyKey: string, resultStateVersion: string, now?: string): void;
  failEvolutionMutation(idempotencyKey: string, error: unknown, now?: string): void;
  recordAuditEvent(type: string, details: Record<string, unknown>, taskId?: string, occurredAt?: string): string;
  recordCodexApprovalDecision(input: CodexApprovalDecisionRecord): void;
  listApprovalGovernance(limit?: number): ApprovalGovernanceRecordOutDto[];
  listUnhandledExceptions(limit?: number): WorkflowExceptionRecordOutDto[];
  listWorkflowBlockages(limit?: number): WorkflowExceptionRecordOutDto[];
  areTechnicalRecoveryEventsResolved(eventIds: string[]): boolean;
  claimExceptions(eventIds: string[], ownerId: string, now?: string): string[];
  saveCheckpoint(eventId: string, checkpoint: WorkflowCheckpointState): void;
  touchException(eventId: string): void;
  resolveException(eventId: string, resolutionSummary: string, now?: string): void;
  resolveCorrelatedExceptions(correlationId: string, resolutionSummary: string, now?: string): void;
  syncCollaborationState(state: CollaborationStateOutDto): void;
  syncEvolutionState(state: EvolutionStateOutDto): void;
  getEvolutionTopicDossier(topicId: string, state: EvolutionStateOutDto): EvolutionTopicDossierOutDto;
  syncLinghuState(state: LinghuAutomationStateOutDto): void;
  detectStalledTasks(now?: string): StalledTaskDetectionOutDto[];
  clearTestData(): number;
}
