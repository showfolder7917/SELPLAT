import path from "node:path";

import type { StartupContext } from "./startup-context.js";
import type { createCapabilityContext } from "./capabilities.bootstrap.js";
import { CodexCollaborationSessionFactory, CollaborationCodexRegistry } from "../services/capabilities/conversation/index.js";
import {
  createReleaseBatchStore,
  createVersionIntegrationPipeline,
  createVersionWorkspaceManager,
  IntegrationReleaseCoordinatorFacade,
  stageVerifiedDeveloperExecutable,
  verifyCollaborationIntegration,
} from "../services/capabilities/release/index.js";
import { createTaskWorktreeTestRunner, TestResourceCoordinatorFacade } from "../services/capabilities/testing/index.js";
import { createSqliteCodexSessionRepository } from "../services/platform/codex/index.js";
import { createExecutorRuntime } from "../services/personas/executor/index.js";
import {
  CollaborationWorkflowFacade,
  createCollaborationDurationLog,
  createCollaborationState,
} from "../services/workflow/index.js";

type CapabilityContext = ReturnType<typeof createCapabilityContext>;
type CoordinatorOptions = ConstructorParameters<typeof CollaborationWorkflowFacade>[0];

export interface CollaborationBootstrapOptions {
  startup: Pick<StartupContext, "projectRoot" | "applicationName" | "projectPaths" | "workspaces" | "eventCenter">;
  capabilities: Pick<CapabilityContext, "collaborationRoot" | "codexHome" | "trustedCommands" | "screenshots" | "settings">;
  linghuSessions: ReturnType<typeof createSqliteCodexSessionRepository>;
  releaseVersion: string;
  readRuleInstructions(): string;
  runUnifiedTests(rootPath: string): Promise<string>;
  publishRelease(executable: string, releaseBatchId: string): void;
  onStateChanged: CoordinatorOptions["emitState"];
  onStream: CoordinatorOptions["emitStream"];
}

/** 装配多人协作、隔离工作树、测试资源和集成发布能力。 */
export function createCollaborationContext(options: CollaborationBootstrapOptions) {
  const { projectRoot, applicationName, projectPaths, workspaces, eventCenter } = options.startup;
  const { collaborationRoot, codexHome, trustedCommands, screenshots, settings } = options.capabilities;
  const collaborationStore = createCollaborationState(path.join(collaborationRoot, "collaboration-state.json"));
  const collaborationDurations = createCollaborationDurationLog(projectPaths.collaborationArchiveRoot);
  const collaborationRegistry = new CollaborationCodexRegistry(collaborationDurations);
  const versionWorkspaces = createVersionWorkspaceManager(projectRoot, path.join(collaborationRoot, "worktrees"));
  const testResources = new TestResourceCoordinatorFacade({
    coordinationRoot: path.join(projectPaths.runningTestRoot, "_资源协调"),
    recordEvent: (type, details, taskId) => eventCenter.recordEvent(type, details, taskId),
  });
  const integrationReleases = new IntegrationReleaseCoordinatorFacade({
    coordinationRoot: path.join(projectPaths.runningExecutionRoot, "_集成与发布协调"),
    recordEvent: (type, details) => eventCenter.recordEvent(type, details),
  });
  const releaseBatches = createReleaseBatchStore(projectPaths.runningExecutionRoot, projectPaths.archiveLogRoot);
  const taskTests = createTaskWorktreeTestRunner(
    projectRoot,
    applicationName,
    path.join(projectPaths.cacheRoot, "test-runtime"),
    (type, details, taskId) => eventCenter.recordEvent(type, details, taskId),
    testResources,
  );
  const collaborationSessions = new CodexCollaborationSessionFactory({
    projectRoot,
    applicationName,
    sessionRoot: path.join(collaborationRoot, "sessions"),
    codexHome,
    trustedCommands,
    registry: collaborationRegistry,
    resolveAttachmentPaths: (attachmentIds) => screenshots.resolveAttachmentPaths(attachmentIds),
    runCodeValidation: async (task, emit) => {
      const worktreeRoot = await versionWorkspaces.validateTaskWorkspace(task);
      await taskTests.run({ taskId: task.taskId, worktreeRoot, emit });
    },
    readSettings: () => settings.read(),
    readRuleInstructions: options.readRuleInstructions,
    readWorkspaceState: () => workspaces.read(),
    personaSessionStore: (memberId) => memberId === "linghu-ancestor" ? options.linghuSessions : null,
    recordEvent: (type, details, taskId) => eventCenter.recordEvent(type, details, taskId),
  });
  const executorRuntime = createExecutorRuntime(collaborationSessions);
  const versionIntegration = createVersionIntegrationPipeline({
    store: collaborationStore,
    durations: collaborationDurations,
    workspaces: versionWorkspaces,
    actorMemberId: "linghu-ancestor",
    verifyCandidate: async (candidate, taskIds, releaseBatchId) => {
      const rootPath = candidate.rootPath;
      await testResources.run({
        runId: `integration-${taskIds.join("-")}`,
        taskId: taskIds.length === 1 ? taskIds[0] : null,
        initiatorMemberId: "collaboration-integrator",
        kind: "integration-validation",
        port: 4197,
        buildRoot: projectPaths.buildRoot,
      }, () => verifyCollaborationIntegration(rootPath, taskIds, projectRoot, applicationName, candidate));
      const candidateExecutable = await options.runUnifiedTests(rootPath);
      return stageVerifiedDeveloperExecutable(candidateExecutable, projectPaths.buildRoot, releaseBatchId);
    },
    acquireRelease: (request) => integrationReleases.acquire(request),
    releaseVersion: options.releaseVersion,
    releaseBatches,
    publishRelease: options.publishRelease,
  });
  const collaboration = new CollaborationWorkflowFacade({
    store: collaborationStore,
    durations: collaborationDurations,
    workspaces: versionWorkspaces,
    executor: executorRuntime.facade,
    integrationPipeline: versionIntegration,
    emitState: options.onStateChanged,
    emitStream: options.onStream,
  });

  return {
    collaboration,
    collaborationStore,
    collaborationRegistry,
    versionWorkspaces,
    testResources,
    releaseBatches,
  };
}
