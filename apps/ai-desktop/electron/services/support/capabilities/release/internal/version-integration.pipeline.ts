import { randomUUID } from "node:crypto";

import type { CollaborationIntegrationFailureKindValue, CollaborationMemberOutDto, CollaborationStateOutDto, CollaborationTaskOutDto } from "../../../../../../contracts/services/workflow/index.js";
import type { IntegrationReleaseInDto, ReleaseBatchDocumentOutDto } from "../../../../../../contracts/services/support/capabilities/release/index.js";
import type { CollaborationDurationPort, CollaborationStatePort } from "../../../../workflow/index.js";
import { ReleaseBatchStore } from "./release-batch.store.js";
import { LinghuAutomationFacade } from "../../../../personas/linghu/index.js";
import { createCollaborationResultSummary } from "../../../../workflow/index.js";
import {
  CandidateBranchConflictError,
  LocalChangeOwnershipError,
  MergeConflictError,
  type IntegrationCandidate,
  VersionWorkspaceManager,
} from "./version-workspace.manager.js";

export interface VersionIntegrationPipelineOptions {
  store: CollaborationStatePort;
  durations: CollaborationDurationPort;
  workspaces: VersionWorkspaceManager;
  actorMemberId: string;
  verifyCandidate(candidate: IntegrationCandidate, taskIds: string[], releaseBatchId: string): Promise<string>;
  acquireRelease(request: IntegrationReleaseInDto): Promise<() => void>;
  releaseVersion: string;
  releaseBatches: ReleaseBatchStore;
  loadedRuntimeSha: string | null;
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
  readonly #publishRelease: VersionIntegrationPipelineOptions["publishRelease"];
  readonly #waitSpans = new Map<string, string>();
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
    const generations = state.integrationBatches
      .filter((batch) => (batch.state === "verified"
        // 仅恢复被旧启动逻辑误标的发布事实，不接受普通失败或未经测试的版本。
        || (batch.state === "failed" && batch.failureReason === "应用重建中断集成，等待用户恢复"
          && batch.taskIds.every((id) => state.tasks.some((task) => task.taskId === id
            && task.state === "awaiting-restart" && task.unifiedTest?.status === "passed"))))
        && Boolean(batch.integrationSha)
        && batch.integrationSha === this.#loadedRuntimeSha
        && state.tasks.some((task) => task.integrationGeneration === batch.generation && task.state === "awaiting-restart"))
      .map((batch) => batch.generation);
    for (const generation of generations) {
      const taskIds = state.tasks.filter((task) => task.integrationGeneration === generation && task.state === "awaiting-restart").map((task) => task.taskId);
      if (!taskIds.length) continue;
      this.#store.updateTask(taskIds[0], "release.restart_healthy", (_first, mutable) => {
        const batch = mutable.integrationBatches.find((item) => item.generation === generation);
        const completedAt = new Date().toISOString();
        if (batch) { batch.state = "completed"; batch.completedAt = completedAt; batch.failureReason = null; }
        const currentActor = requireActor(mutable, this.#actorMemberId);
        for (const task of mutable.tasks.filter((item) => taskIds.includes(item.taskId))) {
          task.state = "integrated";
          task.currentHandler = participantSnapshot(currentActor);
          task.completedAt = completedAt;
          task.blockingReason = null;
          task.resultSummary ||= createCollaborationResultSummary(task, task.finalResult || "任务已完成协同集成。", []);
          task.resultSummary.outcome = "succeeded";
          task.resultSummary.success = true;
          task.resultSummary.remaining = "无已知遗留内容。";
          task.resultSummary.generatedAt = completedAt;
          appendFlow(task, "release.restart_healthy", "integration", "completed", "新版本已重启并通过渲染器健康检查，结果返回南宫婉", currentActor);
        }
      });
    }
    return generations;
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
    const releaseBatchId = `release-${this.#releaseVersion}-g${generation}`;
    let releaseLease: (() => void) | null = null;
    let releaseDocument: ReleaseBatchDocumentOutDto | null = null;
    let publishedExecutable: string | null = null;
    let candidate: IntegrationCandidate | null = null;
    let verifySpan: string | null = null;
    let reconcileSpan: string | null = null;
    const integrationSpan = this.#durations.start(taskIds[0], "integration", { generation, taskCount: taskIds.length });

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
      this.#releaseBatches.write(releaseDocument);
      this.#durations.finish(reconcileSpan, "completed", { releaseEvent: "integration.candidate_ready" });
      reconcileSpan = null;

      // 组合验证期间由真实操作者持有当前处理权，页面和审计记录使用同一人物快照。
      this.#store.updateTask(taskIds[0], "integration.started", (_first, mutable) => {
        const batch = mutable.integrationBatches.find((item) => item.generation === generation);
        if (batch) batch.state = "integrating";
        const currentActor = requireActor(mutable, this.#actorMemberId);
        for (const task of mutable.tasks.filter((item) => taskIds.includes(item.taskId))) {
          task.state = "unified-testing";
          task.currentHandler = participantSnapshot(currentActor);
          task.unifiedTest = { status: "running", owner: participantSnapshot(currentActor), failureReason: null, startedAt: new Date().toISOString(), completedAt: null };
          appendFlow(task, "unified_test.started", "integration", "started", `${currentActor.displayName}正在统一测试（集成批次 ${generation}）`, currentActor);
        }
      });
      verifySpan = this.#durations.start(taskIds[0], "combination-test", { generation, taskCount: taskIds.length });
      releaseDocument.state = "testing";
      this.#releaseBatches.write(releaseDocument);
      publishedExecutable = await this.#verifyCandidate(candidate, taskIds, releaseBatchId);
      releaseDocument.state = "verified";
      releaseDocument.executable = publishedExecutable;
      this.#releaseBatches.write(releaseDocument);
      this.#durations.finish(verifySpan, "completed", { releaseEvent: "integration.verified" });
      verifySpan = null;

      // 只有候选验证完成后才能提升稳定集成指针并更新用户本地分支。
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
          appendFlow(task, "unified_test.passed", "integration", "completed", `${currentActor.displayName}统一测试通过，等待打包版本重启健康检查`, currentActor);
        }
      });

      const retirements = await Promise.allSettled(tasks.map((task) => task.versionWorkspace ? this.#workspaces.retireWorkspace(task.versionWorkspace) : Promise.resolve()));
      this.#store.updateTask(taskIds[0], "integration.worktrees_retired", (_first, mutable) => {
        const retiredAt = new Date().toISOString();
        for (const [index, taskId] of taskIds.entries()) {
          const task = mutable.tasks.find((item) => item.taskId === taskId);
          if (task?.versionWorkspace && retirements[index]?.status === "fulfilled") task.versionWorkspace.retiredAt = retiredAt;
        }
      });
      this.#durations.writeGenerationReport(generation, taskIds);
      releaseDocument.state = "published";
      releaseDocument.completedAt = new Date().toISOString();
      this.#releaseBatches.write(releaseDocument);
    } catch (error) {
      // 本地归属、Git 冲突与候选验证失败分别进入不同恢复路径，禁止统一伪装成测试失败。
      const ownershipBlocked = error instanceof LocalChangeOwnershipError;
      const mergeConflict = error instanceof MergeConflictError;
      const candidateBranchConflict = error instanceof CandidateBranchConflictError;
      const infrastructureFailure = LinghuAutomationFacade.isUnifiedTestInfrastructureError(error);
      const failureKind = ownershipBlocked ? "local-change-ownership" : mergeConflict ? "merge-conflict" : candidateBranchConflict ? "candidate-branch-conflict" : infrastructureFailure ? "infrastructure" : "verification";
      const failurePhase = ownershipBlocked || mergeConflict || candidateBranchConflict ? "preparation" : infrastructureFailure ? "release" : verifySpan ? "verification" : "release";
      const failurePresentation = integrationFailurePresentation(failureKind, generation, errorMessage(error));
      const conflictFiles = mergeConflict ? error.conflictFiles : [];
      if (reconcileSpan) this.#durations.finish(reconcileSpan, "failed", { error: errorMessage(error) });
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
          task.state = ownershipBlocked || mergeConflict || candidateBranchConflict || infrastructureFailure ? "blocked" : "test-failed";
          task.phase = null;
          task.blockingReason = failurePresentation.summary;
          task.recoveryTargetState = "ready-for-integration";
          task.integrationFailure = {
            kind: failureKind, phase: failurePhase, summary: failurePresentation.summary,
            impact: failurePresentation.impact, recoveryAction: failurePresentation.recoveryAction,
            detail: errorMessage(error), conflictFiles,
            baseSha: mergeConflict ? error.baseSha : task.versionWorkspace?.baseSha || null,
            resultSha: mergeConflict ? error.resultSha : task.versionWorkspace?.resultSha || null,
            generation, occurredAt: new Date().toISOString(),
          };
          task.currentHandler = participantSnapshot(currentActor);
          if (failurePhase === "verification") task.unifiedTest = { status: "failed", owner: task.currentHandler, failureReason: errorMessage(error), startedAt: task.unifiedTest?.startedAt || new Date().toISOString(), completedAt: new Date().toISOString() };
          appendFlow(
            task,
            ownershipBlocked ? "integration.local_change_ownership_blocked" : mergeConflict ? "integration.merge_conflict" : candidateBranchConflict ? "integration.candidate_preparation_failed" : infrastructureFailure ? "integration.infrastructure_failed" : "unified_test.failed",
            "integration", ownershipBlocked || mergeConflict || infrastructureFailure ? "waiting" : "failed", failurePresentation.summary, currentActor,
            !ownershipBlocked && !mergeConflict && !infrastructureFailure,
          );
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
      if (candidate) await this.#workspaces.retireCandidate(candidate).catch((error) => {
        this.#durations.instant(taskIds[0], "integration.candidate_retirement_failed", { generation, error: errorMessage(error) });
      });
      releaseLease?.();
      this.#running = false;
      this.schedule();
    }
    // 发布只消费已经归档为 published 的稳定可执行文件，失败批次不会触发受控重启。
    if (publishedExecutable && releaseDocument?.state === "published" && candidate) {
      this.#publishRelease(publishedExecutable, releaseBatchId, candidate.candidateSha);
    }
  }
}

function integrationFailurePresentation(kind: CollaborationIntegrationFailureKindValue, generation: number, detail: string): {
  summary: string;
  impact: string;
  recoveryAction: string;
} {
  if (kind === "candidate-branch-conflict") return {
    summary: `发布候选批次 ${generation} 冲突，统一测试尚未启动`,
    impact: "候选分支创建阶段被阻断，本批次尚未运行统一测试命令，不能记作测试用例未通过。",
    recoveryAction: "保留既有发布证据，分配新的集成代次或清理确认无用的冲突候选后重新准备测试。",
  };
  if (kind === "local-change-ownership") return {
    summary: "合并前无法确认本地修改归属",
    impact: "版本候选尚未建立，未确认归属的修改不会被自动提交或合并。",
    recoveryAction: "确认修改所属任务并转回对应任务分支后，再重新进入集成准备。",
  };
  if (kind === "merge-conflict") return {
    summary: "版本候选合并发生冲突",
    impact: "候选版本未完成组装，统一测试尚未开始。",
    recoveryAction: "依据冲突文件和固定提交证据修正任务分支，然后重新生成候选版本。",
  };
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
): void {
  task.flowEvents.push({
    eventId: randomUUID(),
    type,
    stage,
    status,
    actor: actor ? participantSnapshot(actor) : null,
    summary: summary.slice(0, 2_000),
    occurredAt: new Date().toISOString(),
    error,
  });
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
