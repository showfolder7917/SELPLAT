import type { AiMemoryDatabaseStatusOutDto } from "../../../contracts/services/support/platform/persistence/index.js";
import type { CollaborationTimelineChangedEventOutDto, CollaborationTimelineProjectionStatusOutDto } from "../../../contracts/services/workflow/index.js";
import {
  createCollaborationMemory,
  createCollaborationTimeline,
  createCodexCorpusPersistenceWorkerUrl,
  type EventCenterFacade,
  type EventCenterMemory,
  type EventCenterTimeline,
} from "../../services/support/capabilities/event-center/index.js";
import { BackgroundPersistenceWorkerPort, initializeAiMemoryDatabase, type BackgroundPersistencePort, type DatabasePort } from "../../services/support/platform/persistence/index.js";
import { createWorkflowRepository, type WorkflowRepositoryPort } from "../../services/workflow/index.js";

export interface PersistenceContext {
  readonly database: DatabasePort | null;
  /** 语料与检查点只能经此 Worker 端口读写，不能借 database 回退到主进程事务。 */
  readonly backgroundPersistence: BackgroundPersistencePort | null;
  readonly status: AiMemoryDatabaseStatusOutDto;
  readonly workflowRepository: WorkflowRepositoryPort | null;
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
export function createPersistenceContext(options: CreatePersistenceContextOptions): PersistenceContext {
  const initialization = initializeAiMemoryDatabase({
    projectRoot: options.projectRoot,
    runtimeMarkerPath: options.runtimeMarkerPath,
    migrationSqlRoot: options.migrationSqlRoot,
  });
  const database = initialization.database;
  const backgroundPersistence = database ? new BackgroundPersistenceWorkerPort({
    workerUrl: createCodexCorpusPersistenceWorkerUrl(),
    projectRoot: options.projectRoot,
    runtimeMarkerPath: options.runtimeMarkerPath,
    migrationSqlRoot: options.migrationSqlRoot,
  }) : null;
  const workflowRepository = database ? createWorkflowRepository(database) : null;
  const collaborationTimeline = database ? createCollaborationTimeline(database) : null;
  const collaborationMemory = backgroundPersistence ? createCollaborationMemory(backgroundPersistence) : null;
  collaborationTimeline?.subscribeTimelineChanged(options.onTimelineChanged);
  collaborationTimeline?.subscribeProjectionStatus(options.onTimelineProjectionStatus);
  options.eventCenter.attachRepository(workflowRepository);

  let closed = false;
  return {
    database,
    backgroundPersistence,
    status: initialization.status,
    workflowRepository,
    collaborationTimeline,
    collaborationMemory,
    close: () => {
      if (closed) return;
      closed = true;
      void backgroundPersistence?.close();
      try { database?.close(); }
      catch (error) {
        options.eventCenter.recordException({ kind: "technical", sourceType: "launcher", sourceId: "ai-memory", operation: "database_close", error });
      }
    },
  };
}
