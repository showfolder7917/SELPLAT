import type { AiMemoryDatabaseStatusOutDto } from "../../../contracts/services/support/platform/persistence/index.js";
import type { CollaborationTimelineChangedEventOutDto, CollaborationTimelineProjectionStatusOutDto } from "../../../contracts/services/workflow/index.js";
import {
  createCollaborationMemory,
  createCollaborationTimeline,
  type EventCenterFacade,
  type EventCenterMemory,
  type EventCenterTimeline,
} from "../../services/support/capabilities/event-center/index.js";
import { createCodexCorpusPersistenceWorkerUrl } from "../../dao/corpus/index.js";
import { initializeWorkflowDatabase, type DatabasePort } from "../../dao/platform/index.js";
import { createWorkflowDao } from "../../dao/workflow/index.js";
import { createCollaborationTimelineDao } from "../../dao/timeline/index.js";
import { BackgroundPersistenceWorkerPort, type BackgroundPersistencePort } from "../../services/support/platform/persistence/index.js";
import { type WorkflowPersistencePort } from "../../services/workflow/index.js";

export interface PersistenceContext {
  readonly workflowDatabase: DatabasePort | null;
  /** AI Memory 语料、人物记忆与检查点只能经此 Worker 端口读写。 */
  readonly backgroundPersistence: BackgroundPersistencePort | null;
  readonly status: AiMemoryDatabaseStatusOutDto;
  readonly workflowRepository: WorkflowPersistencePort | null;
  readonly collaborationTimeline: EventCenterTimeline | null;
  readonly collaborationMemory: EventCenterMemory | null;
  close(): void;
}

export interface CreatePersistenceContextOptions {
  projectRoot: string;
  runtimeMarkerPath: string;
  /** 已安装包的只读迁移目录；不得改变受控工程内的数据库文件位置。 */
  migrationSqlRoot?: string;
  eventCenter: EventCenterFacade;
  onTimelineChanged(event: CollaborationTimelineChangedEventOutDto): void;
  /** 投影写入失败与恢复只驱动页面局部反馈，不改变业务时间线。 */
  onTimelineProjectionStatus(status: CollaborationTimelineProjectionStatusOutDto): void;
}

/** 统一创建 AI Memory 连接及其 Repository 投影，应用层只接收稳定 Port。 */
export async function createPersistenceContext(options: CreatePersistenceContextOptions): Promise<PersistenceContext> {
  const backgroundPersistence = new BackgroundPersistenceWorkerPort({
    workerUrl: createCodexCorpusPersistenceWorkerUrl(),
    projectRoot: options.projectRoot,
    runtimeMarkerPath: options.runtimeMarkerPath,
    workflowRuntimeMarkerPath: `${options.runtimeMarkerPath}.workflow-control`,
    migrationSqlRoot: options.migrationSqlRoot,
  });
  const backgroundStatus = await backgroundPersistence.ready();
  if (backgroundStatus.state !== "ready") await backgroundPersistence.close();
  const workflowInitialization = backgroundStatus.state === "ready" ? initializeWorkflowDatabase({
    projectRoot: options.projectRoot,
    runtimeMarkerPath: `${options.runtimeMarkerPath}.workflow-control`,
    migrationSqlRoot: options.migrationSqlRoot,
  }) : { database: null, status: backgroundStatus, createdThisAttempt: false };
  const workflowDatabase = workflowInitialization.database;
  const usableBackgroundPersistence = backgroundStatus.state === "ready" ? backgroundPersistence : null;
  const workflowRepository = workflowDatabase ? createWorkflowDao(workflowDatabase) : null;
  const collaborationTimeline = workflowDatabase ? createCollaborationTimeline(createCollaborationTimelineDao(workflowDatabase)) : null;
  const collaborationMemory = usableBackgroundPersistence ? createCollaborationMemory(usableBackgroundPersistence) : null;
  collaborationTimeline?.subscribeTimelineChanged(options.onTimelineChanged);
  collaborationTimeline?.subscribeProjectionStatus(options.onTimelineProjectionStatus);
  options.eventCenter.attachRepository(workflowRepository);

  let closed = false;
  return {
    workflowDatabase,
    backgroundPersistence: usableBackgroundPersistence,
    status: workflowInitialization.status.state === "ready" ? backgroundStatus : workflowInitialization.status,
    workflowRepository,
    collaborationTimeline,
    collaborationMemory,
    close: () => {
      if (closed) return;
      closed = true;
      void usableBackgroundPersistence?.close();
      try { workflowDatabase?.close(); }
      catch (error) {
        options.eventCenter.recordException({ kind: "technical", sourceType: "launcher", sourceId: "ai-memory", operation: "database_close", error });
      }
    },
  };
}
