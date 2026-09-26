import { summarizeTestFailure } from "../../testing/index.js";
import { randomUUID } from "node:crypto";
import path from "node:path";

import type { CollaborationFlowEventDetailsOutDto, CollaborationIntegrationFailureKindValue, CollaborationMemberOutDto, CollaborationStateOutDto, CollaborationTaskOutDto } from "../../../../../../contracts/services/workflow/index.js";
import type { IntegrationReleaseInDto, ReleaseBatchDocumentOutDto } from "../../../../../../contracts/services/support/capabilities/release/index.js";
import type { ManagedExecutionVerificationEvidenceOutDto } from "../../../../../../contracts/services/support/platform/codex/index.js";
import type { CollaborationDurationPort, CollaborationStatePort } from "../../../../workflow/index.js";
import { ReleaseBatchStore } from "./release-batch.store.js";
import { StablePublishedApplicationCollisionError } from "./verified-package.release.js";
import { LinghuAutomationFacade } from "../../../../personas/linghu/index.js";
import { createCollaborationResultSummary } from "../../../../workflow/index.js";
import {
  CandidateBranchConflictError,
  CandidateCompletenessError,
  LocalChangeOwnershipError,
  MergeConflictError,
  type IntegrationCandidate,
  VersionWorkspaceManager,
} from "./version-workspace.manager.js";
import { ACCEPTANCE_PLAN_SOURCE_PATHS } from "./acceptance-plan-candidate-source.js";
import { inspectAcceptancePlanCandidateEvidence, inspectAcceptancePlanCandidateEvidenceFromContents } from "./integration.verifier.js";
import { executeGit } from "./git-process.js";
import { requiresRuntimeActivation } from "./runtime-activation.policy.js";

class QuickPreflightError extends Error {}

export interface VersionIntegrationPipelineOptions {
  store: CollaborationStatePort;
  durations: CollaborationDurationPort;
  workspaces: VersionWorkspaceManager;
  actorMemberId: string;
  verifyCandidate(candidate: IntegrationCandidate, taskIds: string[], releaseBatchId: string): Promise<{ executable: string; verificationEvidence: ManagedExecutionVerificationEvidenceOutDto[] }>;
  acquireRelease(request: IntegrationReleaseInDto): Promise<() => void>;
  releaseVersion: string;
  releaseBatches: ReleaseBatchStore;
  loadedRuntimeSha: string | null;
  prepareRuntimeActivation(candidate: IntegrationCandidate, releaseBatchId: string): Promise<string>;
  activateRuntime(executable: string, releaseBatchId: string, runtimeSourceSha: string): void;
  publishRelease(executable: string, releaseBatchId: string, runtimeSourceSha: string): void;
}

export interface IntegrationWaitRegistration {
  segment: Parameters<CollaborationDurationPort["startWait"]>[1];
  waitType: Parameters<CollaborationDurationPort["startWait"]>[2];
  reasonCode: string;
  resource: string;
  resourceOwner: string | null;
}

/** 独立编排版本候选、组合验证、本地合并和发布；人物协调器只提交已满足业务条件的任务。 */
export class VersionIntegrationPipeline {
  readonly #store: CollaborationStatePort;
  readonly #durations: CollaborationDurationPort;
  readonly #workspaces: VersionWorkspaceManager;
  readonly #actorMemberId: string;
  readonly #verifyCandidate: VersionIntegrationPipelineOptions["verifyCandidate"];
  readonly #acquireRelease: VersionIntegrationPipelineOptions["acquireRelease"];
  readonly #releaseVersion: string;
  readonly #releaseBatches: ReleaseBatchStore;
  readonly #loadedRuntimeSha: string | null;
  readonly #prepareRuntimeActivation: VersionIntegrationPipelineOptions["prepareRuntimeActivation"];
  readonly #activateRuntime: VersionIntegrationPipelineOptions["activateRuntime"];
  readonly #publishRelease: VersionIntegrationPipelineOptions["publishRelease"];
  readonly #waitSpans = new Map<string, string>();
  readonly #runningTaskIds = new Set<string>();
  readonly #invalidatedTaskIds = new Set<string>();
  #running = false;
  #disposed = false;

  constructor(options: VersionIntegrationPipelineOptions) {
    this.#store = options.store;
    this.#durations = options.durations;
    this.#workspaces = options.workspaces;
    this.#actorMemberId = options.actorMemberId;
    this.#verifyCandidate = options.verifyCandidate;
    this.#acquireRelease = options.acquireRelease;
    this.#releaseVersion = options.releaseVersion;
    this.#releaseBatches = options.releaseBatches;
    this.#loadedRuntimeSha = options.loadedRuntimeSha;
    this.#prepareRuntimeActivation = options.prepareRuntimeActivation;
    this.#activateRuntime = options.activateRuntime;
    this.#publishRelease = options.publishRelease;
  }

  /** 记录任务进入版本集成前的真实等待原因，由流水线在冻结批次时统一结束等待。 */
  trackWaitingTask(taskId: string, registration: IntegrationWaitRegistration): void {
    this.finishWaitingTask(taskId, "interrupted", { releaseEvent: "integration.wait_replaced" });
    this.#waitSpans.set(taskId, this.#durations.startWait(
      taskId,
      registration.segment,
      registration.waitType,
      registration.reasonCode,
      registration.resource,
      registration.resourceOwner,
    ));
  }

  finishWaitingTask(taskId: string, outcome: "completed" | "failed" | "interrupted", details: Record<string, unknown>): void {
    const spanId = this.#waitSpans.get(taskId);
    if (!spanId) return;
    this.#durations.finish(spanId, outcome, details);
    this.#waitSpans.delete(taskId);
  }

  /** 客户修正任务范围时，只标记实际在途的旧批次；尚未开始的下一批不会被误伤。 */
  invalidateTask(taskId: string): void {
    if (this.#runningTaskIds.has(taskId)) this.#invalidatedTaskIds.add(taskId);
  }

  /** 合并工作串行自调度；重复通知只会复用当前运行中的批次。 */
  schedule(): void {
    if (this.#disposed || this.#running || this.#store.state().mode !== "collaboration") return;
    queueMicrotask(() => void this.#runNextBatch());
  }

  dispose(): void {
    this.#disposed = true;
    this.#waitSpans.clear();
  }

  /** 新版本渲染器真实就绪后再把已发布批次交还南宫婉，禁止重启前伪报完成。 */
  confirmPublishedRestart(): number[] {
    const state = this.#store.state();
    const restartTaskIds = new Map<number, string[]>();
    for (const batch of state.integrationBatches) {
      if (!(batch.state === "verified"
        // 仅恢复被旧启动逻辑误标的发布事实，不接受普通失败或未经测试的版本。
        || (batch.state === "failed" && batch.failureReason === "应用重建中断集成，等待用户恢复"
          && batch.taskIds.every((id) => state.tasks.some((task) => task.taskId === id
            && task.state === "awaiting-restart" && task.unifiedTest?.status === "passed"))))
        || !batch.integrationSha) continue;
      const loadedBatch = batch.integrationSha === this.#loadedRuntimeSha;
      if (!loadedBatch) continue;
      const directTaskIds = state.tasks.filter((task) => batch.taskIds.includes(task.taskId)
        && task.integrationGeneration === batch.generation && task.state === "awaiting-restart").map((task) => task.taskId);
      if (directTaskIds.length) {
        restartTaskIds.set(batch.generation, directTaskIds);
        continue;
      }
      // 心跳恢复可能在已验证版本启动期间误冻结一个无源码变化的新批次。新进程只能在
      // 运行 SHA、发布文档中的任务结果提交和当前工作树结果完全一致，且较新批次仅因
      // 应用重建中断时，复用已经通过的旧批次；任何真实失败或源码变化仍必须重新验证。
      const releaseBatchId = `release-${this.#releaseVersion}-g${batch.generation}`;
      const document = this.#releaseBatches.runningDocument(releaseBatchId);
      if (document?.state !== "integrated" || document.candidateSha !== this.#loadedRuntimeSha) continue;
      const recoveredTaskIds = state.tasks.filter((task) => {
        if (!batch.taskIds.includes(task.taskId) || task.state !== "recovering"
          || task.recoveryTargetState !== "unified-testing"
          || (task.integrationGeneration ?? 0) <= batch.generation) return false;
        const recordedTask = document.tasks.find((item) => item.taskId === task.taskId);
        const interruptedDuplicate = state.integrationBatches.find((candidate) => candidate.generation === task.integrationGeneration
          && candidate.state === "failed" && candidate.failureReason === "应用重建中断集成，等待用户恢复"
          && candidate.integrationSha === null && candidate.taskIds.includes(task.taskId));
        return Boolean(recordedTask?.resultSha && interruptedDuplicate
          && recordedTask.resultSha === task.versionWorkspace?.resultSha);
      }).map((task) => task.taskId);
      if (recoveredTaskIds.length) restartTaskIds.set(batch.generation, recoveredTaskIds);
    }
    const generations = [...restartTaskIds.keys()];
    for (const generation of generations) {
      const taskIds = restartTaskIds.get(generation) || [];
      if (!taskIds.length) continue;
      // 开发版只有新进程加载同一候选并通过健康检查后才成为已发布版本；等待重启事件不能替代该事实。
      this.#releaseBatches.confirmDeveloperRestart(`release-${this.#releaseVersion}-g${generation}`);
      const releaseDocument = this.#releaseBatches.runningDocument(`release-${this.#releaseVersion}-g${generation}`);
      const candidateSha = releaseDocument?.candidateSha || null;
      const restartSpans = candidateSha
        ? taskIds.map((taskId) => ({ taskId, spanId: this.#durations.start(taskId, "restart-health", { generation, candidateSha }) }))
        : [];
      this.#store.updateTask(taskIds[0], "release.restart_healthy", (_first, mutable) => {
        const batch = mutable.integrationBatches.find((item) => item.generation === generation);
        const completedAt = new Date().toISOString();
        if (batch) { batch.state = "completed"; batch.completedAt = completedAt; batch.failureReason = null; }
        const currentActor = requireActor(mutable, this.#actorMemberId);
        for (const task of mutable.tasks.filter((item) => taskIds.includes(item.taskId))) {
          task.state = "integrated";
          task.integrationGeneration = generation;
          task.recoveryTargetState = null;
          task.currentHandler = participantSnapshot(currentActor);
          task.completedAt = completedAt;
          task.blockingReason = null;
          task.resultSummary ||= createCollaborationResultSummary(task, task.finalResult || "任务已完成协同集成。", []);
          task.resultSummary.outcome = "succeeded";
          task.resultSummary.success = true;
          task.resultSummary.remaining = "无已知遗留内容。";
          task.resultSummary.generatedAt = completedAt;
          appendFlow(task, "release.published", "integration", "completed", "开发版新进程已加载当前候选，发布批次已确认", currentActor);
          appendFlow(task, "release.restart_healthy", "integration", "completed", "新版本已重启并通过渲染器健康检查，结果返回南宫婉", currentActor);
        }
      });
      for (const { spanId } of restartSpans) this.#durations.finish(spanId, "completed", { generation, candidateSha });
      // 新版本已从独立运行目录加载，预激活候选不再是运行进程；只回收本批次临时副本。
      try {
        this.#releaseBatches.retireRuntimeActivationPackage(`release-${this.#releaseVersion}-g${generation}`);
      } catch (error) {
        // 临时包回收失败只记诊断；已经完成的运行版本健康事实不能倒退。
        this.#durations.instant(taskIds[0], "integration.runtime_activation_retirement_failed", { detail: errorMessage(error) });
      }
    }
    // 只有已确认批次进入终态后才回收任务工作树；回收失败不会把已完成任务重新派发。
    for (const task of this.#store.state().tasks) {
      if (!generations.includes(task.integrationGeneration ?? -1) || !task.versionWorkspace) continue;
      void this.#workspaces.retireWorkspace(task.versionWorkspace).then(() => {
        if (this.#disposed) return;
        this.#store.updateTask(task.taskId, "integration.worktrees_retired", (current) => {
          if (current.versionWorkspace) current.versionWorkspace.retiredAt = new Date().toISOString();
        });
      }).catch((error) => {
        this.#durations.instant(task.taskId, "integration.workspace_retirement_failed", { detail: errorMessage(error) });
      });
    }
    return generations;
  }

  /** 打包或启动脚本明确失败时，旧进程把等待重启的任务退回令狐可恢复卡点。 */
  reportDeveloperRestartFailure(releaseBatchId: string, detail: string): void {
    const document = this.#releaseBatches.runningDocument(releaseBatchId);
    if (!document || document.state !== "integrated" || document.executable !== null) return;
    const state = this.#store.state();
    const taskIds = document.tasks.map((task) => task.taskId);
    const active = state.tasks.filter((task) => taskIds.includes(task.taskId) && task.state === "awaiting-restart");
    if (!active.length) return;
    const presentation = integrationFailurePresentation("infrastructure", document.generation, detail);
    this.#store.updateTask(active[0].taskId, "release.developer_restart_failed", (_first, mutable) => {
      const batch = mutable.integrationBatches.find((item) => item.generation === document.generation);
      if (batch) { batch.state = "failed"; batch.failureReason = detail; batch.failureKind = "infrastructure"; batch.completedAt = new Date().toISOString(); }
      const actor = requireActor(mutable, this.#actorMemberId);
      for (const task of mutable.tasks.filter((item) => taskIds.includes(item.taskId) && item.state === "awaiting-restart")) {
        task.state = "blocked";
        task.blockingReason = presentation.summary;
        task.recoveryTargetState = "ready-for-integration";
        task.integrationFailure = {
          kind: "infrastructure", phase: "release", summary: presentation.summary,
          impact: presentation.impact, recoveryAction: presentation.recoveryAction,
          capacity: null, detail, workspaceRoot: null, conflictFiles: [],
          baseSha: null, resultSha: task.versionWorkspace?.resultSha || null,
          generation: document.generation, occurredAt: new Date().toISOString(),
        };
        appendFlow(task, "release.developer_restart_failed", "integration", "waiting", presentation.summary, actor, false);
      }
    });
    document.state = "failed";
    document.failureReason = detail;
    document.completedAt = new Date().toISOString();
    this.#releaseBatches.write(document);
    this.schedule();
  }

  /** 候选运行包重启后只恢复已归档的原候选，禁止重新组装出另一个 SHA。 */
  async resumeRuntimeActivation(releaseBatchId: string): Promise<void> {
    const document = this.#releaseBatches.pendingRuntimeActivation(releaseBatchId);
    if (!document) return;
    const activation = document.runtimeActivation;
    if (!activation) return;
    if (this.#loadedRuntimeSha !== activation.candidateSha) {
      throw new Error(`候选运行包激活版本不一致：已加载 ${this.#loadedRuntimeSha || "未登记"}，期望 ${activation.candidateSha}。`);
    }
    const taskIds = document.tasks.map((task) => task.taskId);
    const candidate: IntegrationCandidate = {
      generation: document.generation,
      releaseBatchId: document.releaseBatchId,
      version: document.version,
      branchName: document.candidateBranch || "",
      rootPath: activation.candidateRootPath,
      baseSha: activation.candidateBaseSha,
      candidateSha: activation.candidateSha,
      taskIds,
    };
    if (!candidate.branchName) throw new Error("待恢复批次缺少候选分支。");
    const actor = requireActor(this.#store.state(), this.#actorMemberId);
    const releaseLease = await this.#acquireRelease({ releaseBatchId, version: document.version, generation: document.generation, taskIds, initiatorMemberId: actor.memberId });
    let publishedExecutable: string | null = null;
    try {
      const restored = await this.#restoreRuntimeActivationImpactScope(candidate, activation);
      // 候选已成为当前宿主后，必须由候选自身的验证器重建证据；旧宿主快照不能代表新增门禁。
      document.candidateEvidence = await this.#inspectRetainedCandidateEvidence(candidate);
      document.state = "testing";
      document.runtimeActivation = { ...activation, impactScope: restored.snapshot, state: "resumed", detail: null, updatedAt: new Date().toISOString() };
      this.#releaseBatches.write(document);
      const impactScope = restored.files;
      let preflightBlocked = false;
      this.#store.updateTask(taskIds[0], "preflight.resumed_decided", (_first, mutable) => {
        for (const task of mutable.tasks.filter((item) => taskIds.includes(item.taskId))) {
          preflightBlocked ||= appendQuickPreflightDecision(task, candidate, document, impactScope, actor);
        }
      });
      if (preflightBlocked) throw new QuickPreflightError("快速预检发现候选证据问题");
      this.#store.updateTask(taskIds[0], "integration.runtime_activation_resumed", (_first, mutable) => {
        const batch = mutable.integrationBatches.find((item) => item.generation === document.generation);
        if (batch) batch.state = "integrating";
        for (const task of mutable.tasks.filter((item) => taskIds.includes(item.taskId))) {
          task.state = "unified-testing";
          task.currentHandler = participantSnapshot(requireActor(mutable, this.#actorMemberId));
          task.unifiedTest = { status: "running", owner: participantSnapshot(requireActor(mutable, this.#actorMemberId)), failureReason: null, startedAt: new Date().toISOString(), completedAt: null };
          appendFlow(task, "unified_test.started", "integration", "started", `${actor.displayName}已加载候选运行包，恢复原候选统一测试`, actor);
        }
      });
      const verified = await this.#verifyCandidate(candidate, taskIds, releaseBatchId);
      document.state = "verified";
      document.executable = verified.executable === "developer-script" ? null : verified.executable;
      this.#releaseBatches.write(document);
      const integrationSha = await this.#workspaces.promoteIntegrationCandidate(candidate);
      const localMergeSha = await this.#workspaces.mergeIntoLocalBranch(integrationSha);
      document.state = "integrated";
      document.localMergeSha = localMergeSha;
      this.#releaseBatches.write(document);
      this.#store.updateTask(taskIds[0], "release.awaiting_restart", (_first, mutable) => {
        const batch = mutable.integrationBatches.find((item) => item.generation === document.generation);
        if (batch) { batch.state = "verified"; batch.integrationSha = integrationSha; }
        for (const task of mutable.tasks.filter((item) => taskIds.includes(item.taskId))) {
          task.state = "awaiting-restart";
          task.currentHandler = participantSnapshot(requireActor(mutable, this.#actorMemberId));
          if (task.unifiedTest) { task.unifiedTest.status = "passed"; task.unifiedTest.completedAt = new Date().toISOString(); task.unifiedTest.failureReason = null; }
          appendFlow(task, "unified_test.passed", "integration", "completed", `${actor.displayName}统一测试通过，等待打包版本重启健康检查`, actor);
        }
      });
      document.state = verified.executable === "developer-script" ? "integrated" : "published";
      document.completedAt = verified.executable === "developer-script" ? null : new Date().toISOString();
      this.#releaseBatches.write(document);
      this.#store.updateTask(taskIds[0], verified.executable === "developer-script" ? "release.restart_scheduled" : "release.published", (_first, mutable) => {
        for (const task of mutable.tasks.filter((item) => taskIds.includes(item.taskId))) {
          appendFlow(task, verified.executable === "developer-script" ? "release.restart_scheduled" : "release.published", "integration", "completed", verified.executable === "developer-script" ? "候选验证完成，等待开发版脚本打包并重启" : "最终候选已发布，等待新版本重启健康检查", actor);
        }
      });
      publishedExecutable = verified.executable;
    } catch (error) {
      const preflightBlocked = error instanceof QuickPreflightError;
      const failureDetail = errorMessage(error);
      const failurePresentation = integrationFailurePresentation("verification", document.generation, failureDetail);
      document.state = "failed";
      document.failureReason = failureDetail;
      document.completedAt = new Date().toISOString();
      if (document.runtimeActivation) document.runtimeActivation = { ...document.runtimeActivation, state: "failed", detail: failureDetail, updatedAt: new Date().toISOString() };
      this.#releaseBatches.write(document);
      this.#store.updateTask(taskIds[0], "integration.runtime_activation_failed", (_first, mutable) => {
        const batch = mutable.integrationBatches.find((item) => item.generation === document.generation);
        if (batch) {
          batch.state = "failed";
          batch.failureReason = errorMessage(error);
          batch.failureKind = "verification";
          batch.completedAt = new Date().toISOString();
        }
        for (const task of mutable.tasks.filter((item) => taskIds.includes(item.taskId))) {
          task.state = preflightBlocked ? "blocked" : "test-failed";
          task.phase = null;
          task.blockingReason = failurePresentation.summary;
          task.recoveryTargetState = "ready-for-integration";
          // 受控激活后的验证失败必须与普通统一测试失败使用同一结构化契约；
          // 自动修复调度器只消费该事实，不能退回到字符串或卡点时间线猜测。
          task.integrationFailure = {
            kind: "verification",
            phase: "verification",
            summary: failurePresentation.summary,
            impact: failurePresentation.impact,
            recoveryAction: failurePresentation.recoveryAction,
            capacity: null,
            detail: failureDetail,
            workspaceRoot: candidate.rootPath,
            conflictFiles: [],
            baseSha: candidate.baseSha,
            resultSha: task.versionWorkspace?.resultSha || null,
            generation: document.generation,
            occurredAt: new Date().toISOString(),
          };
          task.currentHandler = participantSnapshot(requireActor(mutable, this.#actorMemberId));
          if (!preflightBlocked) {
            task.unifiedTest = { status: "failed", owner: task.currentHandler, failureReason: failureDetail, startedAt: task.unifiedTest?.startedAt || new Date().toISOString(), completedAt: new Date().toISOString() };
            appendFlow(task, "unified_test.failed", "integration", "failed", failureDetail, actor, true);
          }
        }
      });
      throw error;
    } finally {
      await this.#workspaces.retireCandidate(candidate).catch((error) => {
        this.#durations.instant(taskIds[0], "integration.candidate_retirement_failed", { generation: document.generation, error: errorMessage(error) });
      });
      releaseLease();
    }
    // 发布重启必须发生在候选清理和跨进程发布租约释放之后，避免新进程等待旧进程留下的活跃锁。
    if (publishedExecutable) this.#publishRelease(publishedExecutable, releaseBatchId, candidate.candidateSha);
  }

  /** 已提升候选恢复时优先使用冻结事实；仅为旧宿主文档从稳定仓库的保留分支补写一次快照。 */
  /** 候选运行时在工作树已回收后，仍从稳定仓库的同一候选 SHA 重建冻结材料。 */
  async #inspectRetainedCandidateEvidence(candidate: IntegrationCandidate): Promise<ReleaseBatchDocumentOutDto["candidateEvidence"]> {
    const repositoryPaths = Object.values(ACCEPTANCE_PLAN_SOURCE_PATHS)
      .map((relativePath) => `apps/ai-desktop/${relativePath}`);
    const files = await this.#workspaces.readRetainedCandidateFiles(candidate, repositoryPaths);
    const contents = Object.fromEntries(Object.entries(ACCEPTANCE_PLAN_SOURCE_PATHS).map(([source, relativePath]) => [
      source,
      files[`apps/ai-desktop/${relativePath}`],
    ])) as Record<keyof typeof ACCEPTANCE_PLAN_SOURCE_PATHS, string>;
    return inspectAcceptancePlanCandidateEvidenceFromContents(candidate.rootPath, candidate.candidateSha, this.#loadedRuntimeSha, contents);
  }

  async #restoreRuntimeActivationImpactScope(candidate: IntegrationCandidate, activation: NonNullable<ReleaseBatchDocumentOutDto["runtimeActivation"]>): Promise<{
    files: string[];
    snapshot: NonNullable<ReleaseBatchDocumentOutDto["runtimeActivation"]>["impactScope"];
  }> {
    const snapshot = restoredImpactScope(activation);
    if (snapshot) return { files: snapshot.files, snapshot };
    const files = await this.#workspaces.readRetainedCandidateChangedFiles(candidate);
    return {
      files,
      snapshot: { baseSha: activation.candidateBaseSha, candidateSha: activation.candidateSha, files: [...files] },
    };
  }

  async #runNextBatch(): Promise<void> {
    if (this.#disposed || this.#running) return;
    // 只冻结当前已经满足依赖和原子组屏障的任务，后到结果自然进入下一代。
    const state = this.#store.state();
    const ready = state.tasks.filter((task) => task.state === "ready-for-integration" && integrationDependenciesSatisfied(task, state));
    const eligible = ready.filter((task) => task.mergeStrategy !== "ATOMIC_GROUP" || atomicGroupReady(task, ready, state));
    if (eligible.length === 0) return;

    this.#running = true;
    // 运行态可能在测试数据清空后从 1 重新计数，发布归档才是批次标识不可复用的长期事实。
    const generation = this.#releaseBatches.nextAvailableGeneration(this.#releaseVersion, state.nextIntegrationGeneration);
    const taskIds = eligible.map((task) => task.taskId);
    for (const taskId of taskIds) this.#runningTaskIds.add(taskId);
    const releaseBatchId = `release-${this.#releaseVersion}-g${generation}`;
    let releaseLease: (() => void) | null = null;
    let releaseDocument: ReleaseBatchDocumentOutDto | null = null;
    let publishedExecutable: string | null = null;
    let verificationEvidence: ManagedExecutionVerificationEvidenceOutDto[] = [];
    let candidate: IntegrationCandidate | null = null;
    let verifySpan: string | null = null;
    let preflightSpan: string | null = null;
    let releaseSpan: string | null = null;
    let reconcileSpan: string | null = null;
    let activationScheduled = false;
    const integrationSpan = this.#durations.start(taskIds[0], "integration", {
      generation, taskCount: taskIds.length, executionAttemptId: this.#store.task(taskIds[0]).assignmentId || "",
    });

    try {
      // 组装层注入的真实操作者取得跨进程发布租约，流水线本身不认识任何固定人物。
      const actor = requireActor(this.#store.state(), this.#actorMemberId);
      releaseLease = await this.#acquireRelease({
        releaseBatchId,
        version: this.#releaseVersion,
        generation,
        taskIds,
        initiatorMemberId: actor.memberId,
      });
      const transferred = await this.#workspaces.transferOwnedLocalChanges(eligible.flatMap((task) => {
        const workspace = task.versionWorkspace;
        const execution = task.executionRecords.at(-1);
        if (!workspace || !execution?.changedFiles?.length) return [];
        return [{ taskId: task.taskId, memberName: execution.executor.displayName, workspace, changedFiles: execution.changedFiles }];
      }));
      if (transferred) {
        this.#store.updateTask(transferred.taskId, "integration.local_changes_transferred", (task) => {
          if (!task.versionWorkspace) throw new Error("本地修改归属任务缺少版本工作区。");
          task.versionWorkspace.resultSha = transferred.resultSha;
          appendFlow(task, "integration.local_changes_transferred", "integration", "completed", `已把 ${transferred.changedFiles.length} 个本地修改转入任务分支并生成唯一最终提交`, task.currentHandler || task.initiator);
        });
      }

      // 发布批次先固化任务与结果提交，再推进协同任务的集成代次状态。
      releaseDocument = this.#releaseBatches.create(
        releaseBatchId,
        this.#releaseVersion,
        generation,
        taskIds.map((taskId) => this.#store.task(taskId)),
        actor.memberId,
      );
      this.#store.updateTask(taskIds[0], "integration.batch_frozen", (_first, mutable) => {
        // 本轮可能跳过了归档中的旧代次，下一次必须从实际分配代次之后继续。
        mutable.nextIntegrationGeneration = generation + 1;
        mutable.integrationBatches.push({ generation, taskIds, state: "frozen", createdAt: new Date().toISOString(), completedAt: null, integrationSha: null, failureReason: null, failureKind: null, conflictFiles: [] });
        for (const task of mutable.tasks.filter((item) => taskIds.includes(item.taskId))) {
          task.state = "queued-integration";
          task.integrationGeneration = generation;
          appendFlow(task, "integration.batch_frozen", "integration", "waiting", `任务已进入集成批次 ${generation}`, null);
        }
      });
      for (const taskId of taskIds) this.finishWaitingTask(taskId, "completed", { releaseEvent: "integration.batch_frozen", generation });

      // 候选工作树只合并冻结后的 resultSha，冲突由版本工作区管理器保留结构化证据。
      const tasks = taskIds.map((taskId) => this.#store.task(taskId));
      reconcileSpan = this.#durations.start(taskIds[0], "conflict-resolution", { generation, taskCount: taskIds.length });
      candidate = await this.#workspaces.createReleaseCandidate(releaseBatchId, this.#releaseVersion, generation, tasks);
      releaseDocument.state = "candidate-ready";
      releaseDocument.candidateBranch = candidate.branchName;
      releaseDocument.candidateSha = candidate.candidateSha;
      // 只有候选确实包含同批冻结结果后才能记录 unified_test.started。
      await this.#workspaces.assertCandidateContainsTaskResults(candidate, tasks);
      const impactScope = await candidateChangedFiles(candidate.rootPath, candidate.baseSha, candidate.candidateSha);
      // 候选修改验证器时，旧宿主只能冻结候选身份和影响范围，不能以自身旧规则生成候选证据或预检结论。
      if (requiresRuntimeActivation(
        impactScope,
        this.#loadedRuntimeSha,
        candidate.candidateSha,
      )) {
        releaseDocument.state = "activating";
        releaseDocument.runtimeActivation = {
          state: "preparing",
          candidateRootPath: candidate.rootPath,
          candidateBaseSha: candidate.baseSha,
          candidateSha: candidate.candidateSha,
          impactScope: { baseSha: candidate.baseSha, candidateSha: candidate.candidateSha, files: [...impactScope] },
          executable: null,
          detail: `候选修改统一测试运行器：已加载 ${this.#loadedRuntimeSha || "未登记"}，候选 ${candidate.candidateSha}。`,
          updatedAt: new Date().toISOString(),
        };
        this.#releaseBatches.write(releaseDocument);
        let executable: string;
        let stagingCleanupFailure: string | null = null;
        try {
          executable = await this.#prepareRuntimeActivation(candidate, releaseBatchId);
        } catch (error) {
          const failureDetail = errorMessage(error);
          const stagedExecutable = isRuntimeActivationStagingCleanupFailure(failureDetail)
            ? this.#releaseBatches.resolveStagedRuntimeActivationExecutable(releaseBatchId, candidate.candidateSha)
            : null;
          if (!stagedExecutable) throw error;
          executable = stagedExecutable;
          stagingCleanupFailure = failureDetail;
          this.#durations.instant(taskIds[0], "integration.runtime_activation_staging_cleanup_recovered", {
            generation,
            releaseBatchId,
            candidateSha: candidate.candidateSha,
            detail: failureDetail,
          });
        }
        releaseDocument.runtimeActivation = {
          ...releaseDocument.runtimeActivation,
          state: "relaunch-scheduled",
          executable,
          detail: stagingCleanupFailure,
          updatedAt: new Date().toISOString(),
        };
        this.#releaseBatches.write(releaseDocument);
        activationScheduled = true;
        releaseLease?.();
        releaseLease = null;
        this.#activateRuntime(executable, releaseBatchId, candidate.candidateSha);
        return;
      }
      // 未修改验证器的候选由当前宿主生成证据；失败后候选工作树回收，归档仍可复核实际材料。
      releaseDocument.candidateEvidence = inspectAcceptancePlanCandidateEvidence(candidate.rootPath, candidate.candidateSha, this.#loadedRuntimeSha);
      this.#releaseBatches.write(releaseDocument);
      let preflightBlocked = false;
      preflightSpan = this.#durations.start(taskIds[0], "preflight", { generation, candidateSha: candidate.candidateSha });
      this.#store.updateTask(taskIds[0], "preflight.decided", (_first, mutable) => {
        for (const task of mutable.tasks.filter((item) => taskIds.includes(item.taskId))) {
          preflightBlocked ||= appendQuickPreflightDecision(task, candidate!, releaseDocument!, impactScope, actor);
        }
      });
      this.#durations.finish(preflightSpan, preflightBlocked ? "failed" : "completed", { generation, candidateSha: candidate.candidateSha });
      preflightSpan = null;
      if (preflightBlocked) throw new QuickPreflightError("快速预检发现候选证据问题");
      this.#durations.finish(reconcileSpan, "completed", { releaseEvent: "integration.candidate_ready" });
      reconcileSpan = null;
      // updateTask 的回调会跨越当前控制流；先冻结已校验候选 SHA，避免回调重新读取可空运行态。
      const verifiedCandidateSha = candidate.candidateSha;

      // 组合验证期间由真实操作者持有当前处理权，页面和审计记录使用同一人物快照。
      this.#store.updateTask(taskIds[0], "integration.started", (_first, mutable) => {
        const batch = mutable.integrationBatches.find((item) => item.generation === generation);
        if (batch) batch.state = "integrating";
        const currentActor = requireActor(mutable, this.#actorMemberId);
        for (const task of mutable.tasks.filter((item) => taskIds.includes(item.taskId))) {
          appendFlow(task, "integration.candidate_ready", "integration", "completed", `候选已校验：${verifiedCandidateSha.slice(0, 12)} 包含冻结任务结果`, currentActor);
          task.state = "unified-testing";
          task.currentHandler = participantSnapshot(currentActor);
          task.unifiedTest = { status: "running", owner: participantSnapshot(currentActor), failureReason: null, startedAt: new Date().toISOString(), completedAt: null };
          appendFlow(task, "unified_test.started", "integration", "started", `${currentActor.displayName}正在统一测试（集成批次 ${generation}）`, currentActor);
        }
      });
      verifySpan = this.#durations.start(taskIds[0], "combination-test", { generation, taskCount: taskIds.length, candidateSha: verifiedCandidateSha });
      releaseDocument.state = "testing";
      this.#releaseBatches.write(releaseDocument);
      const verifiedCandidate = await this.#verifyCandidate(candidate, taskIds, releaseBatchId);
      publishedExecutable = verifiedCandidate.executable;
      verificationEvidence = verifiedCandidate.verificationEvidence;
      if (taskIds.some((taskId) => this.#invalidatedTaskIds.has(taskId))) {
        const reason = "客户已修正任务范围，本批旧候选已停止，等待原任务按新范围重新验证。";
        releaseDocument.state = "failed";
        releaseDocument.failureReason = reason;
        releaseDocument.completedAt = new Date().toISOString();
        this.#releaseBatches.write(releaseDocument);
        this.#store.updateTask(taskIds[0], "integration.batch_invalidated", (_first, mutable) => {
          const batch = mutable.integrationBatches.find((item) => item.generation === generation);
          if (batch) {
            batch.state = "failed";
            batch.failureReason = reason;
            batch.completedAt = new Date().toISOString();
          }
        });
        this.#durations.finish(verifySpan, "interrupted", { releaseEvent: "integration.batch_invalidated" });
        verifySpan = null;
        this.#durations.finish(integrationSpan, "interrupted", { releaseEvent: "integration.batch_invalidated" });
        publishedExecutable = null;
        return;
      }
      releaseDocument.state = "verified";
      releaseDocument.executable = publishedExecutable === "developer-script" ? null : publishedExecutable;
      this.#releaseBatches.write(releaseDocument);
      this.#durations.finish(verifySpan, "completed", { releaseEvent: "integration.verified" });
      verifySpan = null;

      // 只有候选验证完成后才能提升稳定集成指针并更新用户本地分支。
      releaseSpan = this.#durations.start(taskIds[0], "release", { generation, candidateSha: candidate.candidateSha });
      const integrationSha = await this.#workspaces.promoteIntegrationCandidate(candidate);
      const localMergeSha = await this.#workspaces.mergeIntoLocalBranch(integrationSha);
      releaseDocument.state = "integrated";
      releaseDocument.localMergeSha = localMergeSha;
      this.#releaseBatches.write(releaseDocument);
      this.#durations.finish(integrationSpan, "completed", { releaseEvent: "integration.local_branch_updated", integrationSha });
      // 合并和统一测试通过后先等待新版本真实启动，禁止在重启前把任务伪报为终态。
      this.#store.updateTask(taskIds[0], "release.awaiting_restart", (_first, mutable) => {
        const batch = mutable.integrationBatches.find((item) => item.generation === generation);
        if (batch) {
          batch.state = "verified";
          batch.integrationSha = integrationSha;
        }
        const currentActor = requireActor(mutable, this.#actorMemberId);
        for (const task of mutable.tasks.filter((item) => taskIds.includes(item.taskId))) {
          task.state = "awaiting-restart";
          task.currentHandler = participantSnapshot(currentActor);
          if (task.unifiedTest) {
            task.unifiedTest.status = "passed";
            task.unifiedTest.failureReason = null;
            task.unifiedTest.completedAt = new Date().toISOString();
          }
          task.completedAt = null;
          task.blockingReason = null;
          appendFlow(task, "unified_test.passed", "integration", "completed", `${currentActor.displayName}统一测试通过，等待打包版本重启健康检查`, currentActor, false, {
            verificationEvidence,
            technicalEvidence: verificationEvidence.map((evidence) => `${evidence.scenario}：${evidence.command}（${evidence.status}）`),
          });
        }
      });

      // 原任务工作树必须保留到真实重启确认，失败时仍可在原任务继续修复。
      this.#durations.writeGenerationReport(generation, taskIds);
      releaseDocument.state = publishedExecutable === "developer-script" ? "integrated" : "published";
      releaseDocument.completedAt = publishedExecutable === "developer-script" ? null : new Date().toISOString();
      this.#releaseBatches.write(releaseDocument);
      this.#store.updateTask(taskIds[0], publishedExecutable === "developer-script" ? "release.restart_scheduled" : "release.published", (_first, mutable) => {
        // 该回调独立提交发布事实，不能引用统一测试回调内部的局部执行人变量。
        const currentActor = requireActor(mutable, this.#actorMemberId);
        for (const task of mutable.tasks.filter((item) => taskIds.includes(item.taskId))) {
          appendFlow(task, publishedExecutable === "developer-script" ? "release.restart_scheduled" : "release.published", "integration", "completed", publishedExecutable === "developer-script" ? "候选验证完成，等待开发版脚本打包并重启" : "最终候选已发布，等待新版本重启健康检查", currentActor);
        }
      });
      this.#durations.finish(releaseSpan, "completed", { generation, candidateSha: candidate.candidateSha });
      releaseSpan = null;
    } catch (error) {
      // 本地归属、Git 冲突与候选验证失败分别进入不同恢复路径，禁止统一伪装成测试失败。
      const ownershipBlocked = error instanceof LocalChangeOwnershipError;
      const mergeConflict = error instanceof MergeConflictError;
      const candidateBranchConflict = error instanceof CandidateBranchConflictError;
      const candidateIncomplete = error instanceof CandidateCompletenessError;
      const preflightBlocked = error instanceof QuickPreflightError;
      const capacityBlocked = LinghuAutomationFacade.isUnifiedTestCapacityBlockedError(error);
      const capacityFailure = capacityBlocked ? error as { capacity: { fileBytes: number; directoryBytes: number; headroomBytes: number; requiredBytes: number; availableBytes: number } } : null;
      const infrastructureFailure = capacityBlocked || LinghuAutomationFacade.isUnifiedTestInfrastructureError(error) || error instanceof StablePublishedApplicationCollisionError;
      const failureKind = ownershipBlocked ? "local-change-ownership" : mergeConflict ? "merge-conflict" : preflightBlocked || candidateBranchConflict || candidateIncomplete ? "candidate-branch-conflict" : infrastructureFailure ? "infrastructure" : "verification";
      const failurePhase = preflightBlocked || ownershipBlocked || mergeConflict || candidateBranchConflict || candidateIncomplete ? "preparation" : infrastructureFailure ? "release" : verifySpan ? "verification" : "release";
      const failurePresentation = integrationFailurePresentation(failureKind, generation, errorMessage(error), capacityFailure, candidateIncomplete);
      // 本地修改归属异常同样必须保留具体文件，不能在进入令狐调查前把证据清空。
      const conflictFiles = ownershipBlocked ? error.conflictFiles : mergeConflict ? error.conflictFiles : [];
      if (reconcileSpan) this.#durations.finish(reconcileSpan, "failed", { error: errorMessage(error) });
      if (preflightSpan) this.#durations.finish(preflightSpan, "failed", { error: errorMessage(error), candidateSha: candidate?.candidateSha || null });
      if (releaseSpan) this.#durations.finish(releaseSpan, "failed", { error: errorMessage(error), candidateSha: candidate?.candidateSha || null });
      if (verifySpan) this.#durations.finish(verifySpan, "failed", { error: errorMessage(error) });
      this.#durations.finish(integrationSpan, "failed", { error: errorMessage(error) });
      this.#store.updateTask(taskIds[0], "integration.failed", (_first, mutable) => {
        const batch = mutable.integrationBatches.find((item) => item.generation === generation);
        if (batch) {
          batch.state = "failed";
          batch.failureReason = errorMessage(error);
          batch.failureKind = failureKind;
          batch.conflictFiles = conflictFiles;
          batch.completedAt = new Date().toISOString();
        }
        const currentActor = requireActor(mutable, this.#actorMemberId);
        for (const task of mutable.tasks.filter((item) => taskIds.includes(item.taskId))) {
          task.state = preflightBlocked || ownershipBlocked || mergeConflict || candidateBranchConflict || candidateIncomplete || infrastructureFailure ? "blocked" : "test-failed";
          task.phase = null;
          // 容量不足需要保留策略授权；此标记使自动恢复生成操作指导而不会再次签发源码修复。
          task.repairRequiresUserConfirmation = capacityBlocked;
          task.blockingReason = failurePresentation.summary;
          task.recoveryTargetState = "ready-for-integration";
          task.integrationFailure = {
            kind: failureKind, phase: failurePhase, summary: failurePresentation.summary,
            impact: failurePresentation.impact, recoveryAction: failurePresentation.recoveryAction,
            capacity: capacityFailure?.capacity || null,
            detail: errorMessage(error), workspaceRoot: ownershipBlocked ? error.workspaceRoot : null, conflictFiles,
            baseSha: mergeConflict ? error.baseSha : task.versionWorkspace?.baseSha || null,
            resultSha: mergeConflict ? error.resultSha : task.versionWorkspace?.resultSha || null,
            generation, occurredAt: new Date().toISOString(),
          };
          task.currentHandler = participantSnapshot(currentActor);
          if (failurePhase === "verification" || capacityBlocked) task.unifiedTest = { status: "failed", owner: task.currentHandler, failureReason: errorMessage(error), startedAt: task.unifiedTest?.startedAt || new Date().toISOString(), completedAt: new Date().toISOString() };
          if (!preflightBlocked) appendFlow(
            task,
            ownershipBlocked ? "integration.local_change_ownership_blocked" : mergeConflict ? "integration.merge_conflict" : candidateBranchConflict || candidateIncomplete ? "integration.candidate_preparation_failed" : infrastructureFailure ? "integration.infrastructure_failed" : "unified_test.failed",
            "integration", ownershipBlocked || mergeConflict || infrastructureFailure ? "waiting" : "failed", failurePresentation.summary, currentActor,
            !ownershipBlocked && !mergeConflict && !infrastructureFailure,
          );
          // 集成已经重新落到等待或失败终点，此时没有人物在执行任务。释放上一次恢复留下的占用，
          // 防止侧栏继续显示南宫婉或令狐正在恢复。
          for (const member of mutable.members.filter((candidate) => candidate.currentTaskId === task.taskId)) {
            member.currentTaskId = null;
            member.role = null;
            member.phase = null;
            member.blockingReason = null;
            member.lastHeartbeatAt = null;
            member.lastProtocolProgressAt = null;
            member.state = member.state === "draining" ? "draining" : "idle";
            member.updatedAt = new Date().toISOString();
          }
        }
      });
      this.#durations.writeGenerationReport(generation, taskIds);
      if (releaseDocument) {
        releaseDocument.state = "failed";
        releaseDocument.failureReason = errorMessage(error);
        releaseDocument.completedAt = new Date().toISOString();
        this.#releaseBatches.write(releaseDocument);
      }
    } finally {
      // 无论成功失败都回收临时候选并释放发布租约；流水线随后继续检查下一代就绪任务。
      if (candidate && !activationScheduled) await this.#workspaces.retireCandidate(candidate).catch((error) => {
        this.#durations.instant(taskIds[0], "integration.candidate_retirement_failed", { generation, error: errorMessage(error) });
      });
      releaseLease?.();
      for (const taskId of taskIds) {
        this.#runningTaskIds.delete(taskId);
        this.#invalidatedTaskIds.delete(taskId);
      }
      this.#running = false;
      this.schedule();
    }
    // 正式模式消费已发布可执行文件；开发模式消费已集成候选，由脚本完成打包与重启。
    if (publishedExecutable && (releaseDocument?.state === "published" || (publishedExecutable === "developer-script" && releaseDocument?.state === "integrated")) && candidate) {
      this.#publishRelease(publishedExecutable, releaseBatchId, candidate.candidateSha);
    }
  }
}

/** 运行器、候选读取器或门禁自身变更时，旧进程不得继续验证该候选。 */
async function candidateChangedFiles(rootPath: string, baseSha: string, candidateSha: string): Promise<string[]> {
  const { stdout } = await executeGit(["diff", "--name-only", `${baseSha}..${candidateSha}`], rootPath);
  return stdout.split(/\r?\n/).filter(Boolean);
}

/** 已提升包恢复时只消费激活前冻结的候选范围，临时候选工作树可能已被旧宿主回收。 */
function restoredImpactScope(activation: NonNullable<ReleaseBatchDocumentOutDto["runtimeActivation"]>): NonNullable<ReleaseBatchDocumentOutDto["runtimeActivation"]>["impactScope"] | null {
  const snapshot = activation.impactScope;
  if (!snapshot) return null;
  if (snapshot.baseSha !== activation.candidateBaseSha || snapshot.candidateSha !== activation.candidateSha
    || !Array.isArray(snapshot.files) || snapshot.files.some((file) => typeof file !== "string")) {
    throw new Error("待恢复批次缺少与候选身份匹配的已冻结影响范围快照。");
  }
  return { baseSha: snapshot.baseSha, candidateSha: snapshot.candidateSha, files: [...snapshot.files] };
}

function integrationFailurePresentation(
  kind: CollaborationIntegrationFailureKindValue,
  generation: number,
  detail: string,
  capacityBlocked: { capacity: { requiredBytes: number; availableBytes: number } } | null = null,
  candidateIncomplete = false,
): {
  summary: string;
  impact: string;
  recoveryAction: string;
} {
  if (candidateIncomplete) return {
    summary: `发布候选批次 ${generation} 缺少冻结任务结果，统一测试尚未启动`,
    impact: "候选提交链未包含全部已登记 resultSha；当前失败属于候选准备，不是产品源码或测试用例失败。",
    recoveryAction: "保留候选 SHA、任务 resultSha 和完整性诊断，重新组装包含冻结结果的候选后再开始统一测试。",
  };
  if (kind === "candidate-branch-conflict") return {
    summary: `发布候选批次 ${generation} 冲突，统一测试尚未启动`,
    impact: "候选分支创建阶段被阻断，本批次尚未运行统一测试命令，不能记作测试用例未通过。",
    recoveryAction: "保留既有发布证据，分配新的集成代次或清理确认无用的冲突候选后重新准备测试。",
  };
  if (kind === "local-change-ownership") return {
    summary: "合并前无法确认本地修改归属",
    impact: "版本候选尚未建立，但令狐会继续调查修改来源；未确认归属的修改不会被自动提交或合并。",
    recoveryAction: "先由令狐依据工作区、文件和任务记录调查并修复；只有仍无法确认归属时，才请客户按具体文件提示处理。",
  };
  if (kind === "merge-conflict") return {
    summary: "版本候选合并发生冲突",
    impact: "候选版本未完成组装，统一测试尚未开始。",
    recoveryAction: "依据冲突文件和固定提交证据修正任务分支，然后重新生成候选版本。",
  };
  if (capacityBlocked) {
    const shortfallBytes = capacityBlocked.capacity.requiredBytes - capacityBlocked.capacity.availableBytes;
    return {
      summary: "开发包容量不足，等待保留策略授权",
      impact: `容量预检在构建前停止；候选源码和打包输入均未继续写入。当前还缺少 ${shortfallBytes} 字节可用空间。`,
      recoveryAction: "请由具有发布物、缓存和工作树保留策略权限的人员处理已确认可释放的空间后，复用当前结果提交重新执行统一测试；禁止自动删除、降低预检值或派回源码修复。",
    };
  }
  if (kind === "infrastructure") return {
    summary: "统一测试基础设施故障，候选源码无需重复修复",
    impact: "统一测试脚本已经执行，但宿主控制器无法从用户所选工作区读取或提升发布产物；当前候选版本不能发布。",
    recoveryAction: `修复宿主测试控制器或工作区路径后重启，并复用当前候选提交重新验证；禁止把该故障派回候选源码：${detail.slice(0, 240)}`,
  };
  return {
    summary: "统一测试发现未通过项，已转入修复",
    impact: "候选版本已经开始统一测试，验证命令返回失败，本批次暂不能发布。",
    recoveryAction: `当前测试负责人根据失败证据修复后重新执行统一测试；原始证据保留：${detail.slice(0, 240)}`,
  };
}

function requireActor(state: CollaborationStateOutDto, memberId: string): CollaborationMemberOutDto {
  const actor = state.members.find((member) => member.memberId === memberId);
  if (!actor) throw new Error("版本集成操作者不存在。");
  return actor;
}

function participantSnapshot(member: Pick<CollaborationMemberOutDto, "memberId" | "displayName">): { memberId: string; displayName: string } {
  return { memberId: member.memberId, displayName: member.displayName };
}

/** 流水线只登记可审计的版本集成事实，不保存执行过程中的推理正文。 */
function appendFlow(
  task: CollaborationTaskOutDto,
  type: CollaborationTaskOutDto["flowEvents"][number]["type"],
  stage: CollaborationTaskOutDto["flowEvents"][number]["stage"],
  status: CollaborationTaskOutDto["flowEvents"][number]["status"],
  summary: string,
  actor: Pick<CollaborationMemberOutDto, "memberId" | "displayName"> | null,
  error = false,
  details?: CollaborationFlowEventDetailsOutDto,
): void {
  task.flowEvents.push({
    eventId: randomUUID(),
    type,
    stage,
    status,
    actor: actor ? participantSnapshot(actor) : null,
    summary: error ? summarizeTestFailure(summary) : summary.slice(0, 2_000),
    occurredAt: new Date().toISOString(),
    error,
    details,
  });
}

/** 候选冻结后只比较结构化事实；任一复用条件缺失均保留原因并重新执行。 */
function appendQuickPreflightDecision(
  task: CollaborationTaskOutDto,
  candidate: IntegrationCandidate,
  document: ReleaseBatchDocumentOutDto,
  impactScope: string[],
  actor: Pick<CollaborationMemberOutDto, "memberId" | "displayName">,
): boolean {
  const evidence = document.candidateEvidence;
  const testInputs = [
    `candidate:${candidate.candidateSha}`,
    ...((evidence?.sourceBlobs || []).map((blob) => `${blob.source}:${blob.sha256}`)),
  ];
  const evidenceValid = Boolean(evidence && !evidence.readError && evidence.acceptancePlanChecks.every((check) => check.passed));
  const evidenceReferences = [`release-batch://${document.releaseBatchId}/candidate-evidence`];
  const previous = [...task.flowEvents].reverse().find((event) => event.type === "preflight.reused" && event.details?.candidateSha === candidate.candidateSha);
  const previousDetails = previous?.details;
  const reusable = Boolean(previousDetails?.evidenceValid && evidenceValid
    && JSON.stringify(previousDetails.impactScope || []) === JSON.stringify(impactScope)
    && JSON.stringify(previousDetails.testInputs || []) === JSON.stringify(testInputs));
  const issues = !evidenceValid
    ? [{ category: "候选证据", summary: evidence?.readError || "候选验收能力证据不完整", affectedStage: "统一测试" }]
    : reusable ? [] : [{ category: "复用条件", summary: "没有与当前候选、影响范围、测试输入和有效证据同时匹配的可复用结果", affectedStage: "统一测试" }];
  const details: CollaborationFlowEventDetailsOutDto = {
    preflightRound: `submission:${task.taskId}`,
    candidateSha: candidate.candidateSha,
    impactScope,
    testInputs,
    evidenceReferences,
    evidenceValid,
    reusableStages: reusable ? previousDetails?.reusableStages || ["unified-test"] : [],
    preflightIssues: issues,
  };
  if (!evidenceValid) {
    appendFlow(task, "preflight.issues_found", "preflight", "failed", "快速预检发现候选证据问题，完整统一测试尚未启动", actor, true, details);
    return true;
  }
  appendFlow(task, reusable ? "preflight.reused" : "preflight.rerun_required", "preflight", "completed",
    reusable ? "快速预检确认未受影响阶段可复用，后续门禁继续独立执行" : "快速预检未找到可复用结果，将重新执行完整统一测试", actor, false, details);
  return false;
}

function integrationDependenciesSatisfied(task: CollaborationTaskOutDto, state: CollaborationStateOutDto): boolean {
  return task.dependencyTaskIds.every((dependencyId) => state.tasks.find((candidate) => candidate.taskId === dependencyId)?.state === "integrated");
}

function atomicGroupReady(task: CollaborationTaskOutDto, ready: CollaborationTaskOutDto[], state: CollaborationStateOutDto): boolean {
  if (!task.atomicGroupId) return false;
  const group = state.tasks.filter((candidate) => candidate.atomicGroupId === task.atomicGroupId);
  return group.length > 0 && group.every((candidate) => ready.some((item) => item.taskId === candidate.taskId));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** 只接受旧宿主在已提升候选后清理激活暂存树时的 Node 文件类型错误。 */
function isRuntimeActivationStagingCleanupFailure(detail: string): boolean {
  return /ENOTDIR: not a directory, (?:rmdir|unlink)/.test(detail)
    && detail.includes(`${path.sep}package${path.sep}activation-staging-`);
}
