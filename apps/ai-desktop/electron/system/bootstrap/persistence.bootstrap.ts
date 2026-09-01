import type { AiMemoryDatabaseStatus } from "../../../contracts/platform/persistence/index.js";
import type { CollaborationTimelineChangedEventOutDto } from "../../../contracts/collaboration/workflow/index.js";
import {
  createCollaborationMemory,
  createCollaborationTimeline,
  type EventCenterFacade,
  type EventCenterMemory,
  type EventCenterTimeline,
} from "../../services/support/capabilities/event-center/index.js";
import { initializeAiMemoryDatabase, type DatabasePort } from "../../services/support/platform/persistence/index.js";
import { createWorkflowRepository, type WorkflowRepositoryPort } from "../../services/workflow/index.js";

export interface PersistenceContext {
  readonly database: DatabasePort | null;
  readonly status: AiMemoryDatabaseStatus;
  readonly workflowRepository: WorkflowRepositoryPort | null;
  readonly collaborationTimeline: EventCenterTimeline | null;
  readonly collaborationMemory: EventCenterMemory | null;
  close(): void;
}

export interface CreatePersistenceContextOptions {
  projectRoot: string;
  runtimeMarkerPath: string;
  eventCenter: EventCenterFacade;
  onTimelineChanged(event: CollaborationTimelineChangedEventOutDto): void;
}

/** 统一创建 AI Memory 连接及其 Repository 投影，应用层只接收稳定 Port。 */
export function createPersistenceContext(options: CreatePersistenceContextOptions): PersistenceContext {
  const initialization = initializeAiMemoryDatabase({
    projectRoot: options.projectRoot,
    runtimeMarkerPath: options.runtimeMarkerPath,
  });
  const database = initialization.database;
  const workflowRepository = database ? createWorkflowRepository(database) : null;
  const collaborationTimeline = database ? createCollaborationTimeline(database) : null;
  const collaborationMemory = database ? createCollaborationMemory(database) : null;
  collaborationTimeline?.subscribeTimelineChanged(options.onTimelineChanged);
  options.eventCenter.attachRepository(workflowRepository);

  let closed = false;
  return {
    database,
    status: initialization.status,
    workflowRepository,
    collaborationTimeline,
    collaborationMemory,
    close: () => {
      if (closed) return;
      closed = true;
      try { database?.close(); }
      catch (error) {
        options.eventCenter.recordException({ kind: "technical", sourceType: "launcher", sourceId: "ai-memory", operation: "database_close", error });
      }
    },
  };
}
