import type { BrowserWindow, BrowserWindowConstructorOptions } from "electron";
import type { AcceptanceScenePlanOutDto, CompletionReviewGateOutDto, HanliAcceptanceRunOutDto, HanliComputerAcceptanceInDto } from "../../../contracts/services/personas/hanli/index.js";
import type { AcceptanceEmptyTaskGroupSession } from "./acceptance-empty-task-group-session.js";
import type { CollaborationTimelineSnapshotOutDto } from "../../../contracts/services/workflow/index.js";
import { createCompletionGateGoal, createSegmentGoal } from "./hanli-acceptance-scene-goals.js";
import { assertSegmentAcceptanceRun, mergeAcceptanceRuns } from "./hanli-acceptance-scene-results.js";
import { prepareAcceptanceSceneWindow } from "./acceptance-scene-window.js";

interface AcceptanceSceneSessionOptions {
  goal: HanliComputerAcceptanceInDto;
  plan: AcceptanceScenePlanOutDto;
  targetWindow: BrowserWindow;
  targetBounds: { x: number; y: number; width: number; height: number };
  preloadPath: string;
  rendererRoot: string;
  sessions: AcceptanceEmptyTaskGroupSession;
  taskHandoff?: CollaborationTimelineSnapshotOutDto;
  createWindow(options: BrowserWindowConstructorOptions): BrowserWindow;
  execute(goal: HanliComputerAcceptanceInDto, window: BrowserWindow): Promise<HanliAcceptanceRunOutDto>;
  setWorkspaceFixtureSceneActive?(active: boolean): void;
  finalizeWorkspaceFixture?(): Promise<void>;
  onSceneReady(): void;
  onCompletionReviewReady(gate: CompletionReviewGateOutDto): void;
  record(eventType: string, details: Record<string, unknown>): void;
}

/** 依次准备不同证据源，任一阶段失败即停止；全部通过后才形成韩立最终验收结论。 */
export async function runHanliAcceptanceSceneSession(options: AcceptanceSceneSessionOptions): Promise<HanliAcceptanceRunOutDto> {
  const runs: HanliAcceptanceRunOutDto[] = [];
  let sceneReadyPublished = false;
  for (const [segmentIndex, segment] of options.plan.segments.entries()) {
    let prepared: Awaited<ReturnType<typeof prepareAcceptanceSceneWindow>> | undefined;
    options.setWorkspaceFixtureSceneActive?.(segment.kind === "workspace-explorer-fixture");
    try {
      prepared = await prepareAcceptanceSceneWindow(segment, {
        target: options.targetWindow,
        targetBounds: options.targetBounds,
        preloadPath: options.preloadPath,
        rendererRoot: options.rendererRoot,
        sessions: options.sessions,
        taskHandoff: segment.kind === "persona-conversation-with-task-handoff" ? options.taskHandoff : undefined,
        createWindow: options.createWindow,
      });
      options.record("hanli.acceptance_scene.ready", {
        segmentIndex,
        kind: segment.kind,
        conditionIds: segment.conditions.map(({ criterionId }) => criterionId),
        webContentsId: prepared.window.webContents.id,
      });
      if (!sceneReadyPublished) {
        sceneReadyPublished = true;
        options.onSceneReady();
      }
      const priorPhaseEvidence = runs.length ? summarizePriorRuns(runs) : undefined;
      // 后续证据段必须知道前序场景已经实际完成；否则临时夹具释放后，模型会误把“看不到旧夹具”当成当前页面故障。
      const currentGoal = {
        ...createSegmentGoal(options.goal, segment),
        ...(priorPhaseEvidence ? { priorPhaseEvidence } : {}),
      };
      const canEnterCompletionReview = runs.every((run) => run.status === "passed");
      if (!segment.completionReviewRequired || options.goal.reviewMode === "post-completion-review" || !canEnterCompletionReview) {
        if (segment.completionReviewRequired && !canEnterCompletionReview) {
          // 前序条件已有真实失败时，仍须采集本段原条件的证据，但不得触发业务完成状态变更。
          options.record("hanli.acceptance_scene.completion_review_skipped", {
            segmentIndex,
            conditionIds: segment.conditions.map(({ criterionId }) => criterionId),
            priorStatuses: runs.map((run) => run.status),
          });
        }
        const run = assertSegmentAcceptanceRun(await options.execute(currentGoal, prepared.window), segment);
        runs.push(run);
        continue;
      }

      // 进入完成门前先结束临时环境；工作区树和文件预览同步后，门禁才能观察真实任务卡。
      await options.finalizeWorkspaceFixture?.();
      const gateRun = await options.execute(createCompletionGateGoal(currentGoal), prepared.window);
      const gate = {
        ...gateRun,
        stepResults: gateRun.stepResults.map((step) => ({ ...step, checkId: "pre-completion-gate" })),
      };
      if (gate.status !== "passed") {
        // 完成前门禁没有覆盖原始验收条件，只能报告验收能力受阻，不能伪装成产品未通过。
        const blockedGate = {
          ...gate,
          status: "blocked" as const,
          stepResults: gate.stepResults.map((step) => ({
            ...step,
            status: "blocked" as const,
            layoutStatus: "blocked" as const,
          })),
        };
        return mergeAcceptanceRuns(options.goal, [...runs, blockedGate]);
      }
      const initialPass = mergeAcceptanceRuns(options.goal, [...runs, gate]);
      // 门禁记录没有本段原始条件，类型上也不能再被当作完整验收运行提交。
      options.onCompletionReviewReady({
        runId: initialPass.runId,
        topicId: initialPass.topicId,
        proposalId: initialPass.proposalId,
        evidenceAttachmentIds: initialPass.evidenceAttachmentIds,
        summary: initialPass.stepResults.map((step) => `${step.actual}；布局：${step.layoutActual || "未记录"}`).join("\n"),
      });
      const completionPhaseEvidence = summarizePriorRuns([initialPass]);
      const review = assertSegmentAcceptanceRun(await options.execute({
        ...currentGoal,
        reviewMode: "post-completion-review",
        priorPhaseEvidence: completionPhaseEvidence,
      }, prepared.window), segment);
      runs.push(review);
      return mergeAcceptanceRuns(options.goal, runs);
    } catch (error) {
      options.record(prepared ? "hanli.acceptance.failed" : "hanli.acceptance_scene.preparation_failed", {
        segmentIndex,
        kind: segment.kind,
        reason: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      options.setWorkspaceFixtureSceneActive?.(false);
      prepared?.dispose();
      if (prepared) options.record("hanli.acceptance_scene.released", { segmentIndex, kind: segment.kind });
    }
  }
  return mergeAcceptanceRuns(options.goal, runs);
}

/** 只传递已归档判断和附件身份；后续场景不能借此重新操作已释放的临时数据。 */
function summarizePriorRuns(runs: HanliAcceptanceRunOutDto[]): NonNullable<HanliComputerAcceptanceInDto["priorPhaseEvidence"]> {
  return {
    summary: runs.flatMap((run) => run.stepResults)
      .map((step) => `${step.checkId}：${step.actual}；布局：${step.layoutActual || "未记录"}`)
      .join("\n"),
    evidenceAttachmentIds: [...new Set(runs.flatMap((run) => run.evidenceAttachmentIds))],
  };
}
