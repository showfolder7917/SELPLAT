import path from "node:path";

import type { StartupContext } from "./startup-context.js";
import type { createCapabilityContext } from "./capabilities.bootstrap.js";
import { CodexCollaborationSessionFactory, CollaborationCodexRegistry } from "../../services/support/capabilities/conversation/index.js";
import {
  createReleaseBatchStore,
  createVersionIntegrationPipeline,
  createVersionWorkspaceManager,
  IntegrationReleaseCoordinatorFacade,
  stageVerifiedDeveloperExecutable,
  verifyCollaborationIntegration,
} from "../../services/support/capabilities/release/index.js";
import { createTaskWorktreeTestRunner, TestResourceCoordinatorFacade } from "../../services/support/capabilities/testing/index.js";
import type { FixedUnifiedTestRunResult } from "../../services/support/capabilities/testing/index.js";
import { createSqliteCodexSessionDao } from "../../dao/codex/index.js";
import { createExecutorRuntime } from "../../services/personas/executor/index.js";
import {
  CollaborationWorkflowFacade,
  createCollaborationDurationLog,
  createCollaborationInteractionPerformanceLog,
  createCollaborationNavigationPreference,
  createCollaborationState,
} from "../../services/workflow/index.js";

type CapabilityContext = ReturnType<typeof createCapabilityContext>;
type CoordinatorOptions = ConstructorParameters<typeof CollaborationWorkflowFacade>[0];

export interface CollaborationBootstrapOptions {
  startup: Pick<StartupContext, "projectRoot" | "applicationName" | "projectPaths" | "workspaces" | "eventCenter" | "runtimeSourceSha" | "resumeReleaseBatchId">;
  capabilities: Pick<CapabilityContext, "collaborationRoot" | "codexHome" | "trustedCommands" | "screenshots" | "settings" | "prompts" | "rules">;
  linghuSessions: ReturnType<typeof createSqliteCodexSessionDao>;
  releaseVersion: string;
  readRuleInstructions(memberId: string, task: import("../../../contracts/services/workflow/index.js").CollaborationTaskOutDto): string;
  runUnifiedTests(rootPath: string): Promise<FixedUnifiedTestRunResult>;
  prepareRuntimeActivation(rootPath: string, releaseBatchId: string, candidateSha: string): Promise<string>;
  activateRuntime(executable: string, releaseBatchId: string, runtimeSourceSha: string): void;
  publishRelease(executable: string, releaseBatchId: string, runtimeSourceSha: string): void;
  onStateChanged: CoordinatorOptions["emitState"];
  onStream: CoordinatorOptions["emitStream"];
}

/** 装配多人协作、隔离工作树、测试资源和集成发布能力。 */
export function createCollaborationContext(options: CollaborationBootstrapOptions) {
  const { projectRoot, applicationName, projectPaths, workspaces, eventCenter } = options.startup;
  const { collaborationRoot, codexHome, trustedCommands, screenshots, settings, prompts, rules } = options.capabilities;
  const collaborationStore = createCollaborationState(path.join(collaborationRoot, "collaboration-state.json"));
  const collaborationDurations = createCollaborationDurationLog(projectPaths.collaborationArchiveRoot);
  const collaborationNavigationPreference = createCollaborationNavigationPreference(path.join(collaborationRoot, "navigation-preference.json"));
  const collaborationInteractionPerformance = createCollaborationInteractionPerformanceLog(projectPaths.temporaryMaterialsRoot);
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
  const releaseBatches = createReleaseBatchStore(projectPaths.runningExecutionRoot, projectPaths.archiveLogRoot, projectPaths.buildRoot);
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
    runCodeValidation: async (task, authorizedFiles, emit) => {
      const worktreeRoot = await versionWorkspaces.validateTaskWorkspace(task);
      // 每次复测前都读取真实 Git 状态；模型未上报的范围外修改同样会被阻断。
      await versionWorkspaces.validateTaskChangeScope(task, authorizedFiles);
      await taskTests.run({ taskId: task.taskId, worktreeRoot, emit });
    },
    // 首次实施结束时由版本工作区提供真实文件列表，不能依赖执行人物流上报。
    readTaskChangedFiles: (task) => versionWorkspaces.readTaskChangedFiles(task),
    readSettings: () => settings.read(),
    readRuleInstructions: () => "",
    readRuleInstructionsForMember: options.readRuleInstructions,
    readWorkspaceState: () => workspaces.read(),
    prompts,
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
      const unifiedTestResult = await options.runUnifiedTests(rootPath);
      const candidateExecutable = unifiedTestResult.executable;
      return {
        // macOS 测试阶段由固定开发脚本在已合并的主工作区重新打包；候选应用留在受控工作树，重启健康后随工作树回收。
        executable: process.platform === "darwin"
          ? candidateExecutable
          : stageVerifiedDeveloperExecutable(candidateExecutable, projectPaths.buildRoot, releaseBatchId, candidate.candidateSha),
        verificationEvidence: unifiedTestResult.verificationEvidence,
      };
    },
    acquireRelease: (request) => integrationReleases.acquire(request),
    releaseVersion: options.releaseVersion,
    releaseBatches,
    loadedRuntimeSha: options.startup.runtimeSourceSha,
    prepareRuntimeActivation: (candidate, releaseBatchId) => options.prepareRuntimeActivation(candidate.rootPath, releaseBatchId, candidate.candidateSha),
    activateRuntime: options.activateRuntime,
    publishRelease: options.publishRelease,
  });
  if (options.startup.resumeReleaseBatchId) {
    void versionIntegration.resumeRuntimeActivation(options.startup.resumeReleaseBatchId).catch((error) => {
      eventCenter.recordException({ kind: "technical", sourceType: "system", sourceId: "runtime-activation", operation: "resume_release_candidate", error });
    });
  }
  const collaboration = new CollaborationWorkflowFacade({
    store: collaborationStore,
    durations: collaborationDurations,
    workspaces: versionWorkspaces,
    executor: executorRuntime.facade,
    integrationPipeline: versionIntegration,
    emitState: options.onStateChanged,
    emitStream: options.onStream,
    createTaskRuleContext: (taskRuleIds) => rules.createTaskRuleSnapshot("executor", taskRuleIds),
  });

  return {
    collaboration,
    collaborationStore,
    collaborationRegistry,
    collaborationNavigationPreference,
    collaborationInteractionPerformance,
    versionWorkspaces,
    testResources,
    releaseBatches,
  };
}
