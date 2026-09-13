import type { BrowserWindow, BrowserWindowConstructorOptions } from "electron";
import type { AcceptanceScenePlanOutDto, HanliAcceptanceRunOutDto, HanliComputerAcceptanceInDto } from "../../../contracts/services/personas/hanli/index.js";
import type { AcceptanceEmptyTaskGroupSession } from "./acceptance-empty-task-group-session.js";
import type { CollaborationTimelineSnapshotOutDto } from "../../../contracts/services/workflow/index.js";
import { createSegmentGoal, mergeAcceptanceRuns, remapAcceptanceRun } from "./hanli-acceptance-scene-results.js";
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
  onSceneReady(): void;
  onInitialPass(run: HanliAcceptanceRunOutDto): void;
  record(eventType: string, details: Record<string, unknown>): void;
}

/** 依次准备不同证据源，任一阶段失败即停止；全部通过后才形成韩立最终验收结论。 */
export async function runHanliAcceptanceSceneSession(options: AcceptanceSceneSessionOptions): Promise<HanliAcceptanceRunOutDto> {
  const runs: HanliAcceptanceRunOutDto[] = [];
  let sceneReadyPublished = false;
  for (const [segmentIndex, segment] of options.plan.segments.entries()) {
    let prepared: Awaited<ReturnType<typeof prepareAcceptanceSceneWindow>> | undefined;
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
      const currentGoal = createSegmentGoal(options.goal, segment);
      if (!segment.completionReviewRequired || options.goal.reviewMode === "post-completion-review") {
        const run = remapAcceptanceRun(await options.execute(currentGoal, prepared.window), segment);
        runs.push(run);
        if (run.status !== "passed") return mergeAcceptanceRuns(options.goal, runs);
        continue;
      }

      const gateRun = await options.execute({
        ...currentGoal,
        criteria: ["确认当前真实窗口已进入目标专题的韩立验收阶段，任务卡可读、尚未误示为已完成，且页面没有阻止完成收口的错误。"],
        reviewMode: "pre-completion-gate",
      }, prepared.window);
      const gate = {
        ...gateRun,
        stepResults: gateRun.stepResults.map((step) => ({ ...step, checkId: "pre-completion-gate" })),
      };
      if (gate.status !== "passed") return mergeAcceptanceRuns(options.goal, [...runs, gate]);
      const initialPass = mergeAcceptanceRuns(options.goal, [...runs, gate]);
      options.onInitialPass(initialPass);
      const priorPhaseEvidence = {
        summary: initialPass.stepResults.map((step) => `${step.actual}；布局：${step.layoutActual || "未记录"}`).join("\n"),
        evidenceAttachmentIds: initialPass.evidenceAttachmentIds,
      };
      const review = remapAcceptanceRun(await options.execute({
        ...currentGoal,
        reviewMode: "post-completion-review",
        priorPhaseEvidence,
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
      prepared?.dispose();
      if (prepared) options.record("hanli.acceptance_scene.released", { segmentIndex, kind: segment.kind });
    }
  }
  return mergeAcceptanceRuns(options.goal, runs);
}
