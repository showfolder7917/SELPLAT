import type { CurrentTopicAcceptanceOutDto, CurrentTopicStageDurationEvidenceOutDto, CurrentTopicStageOutDto, EvolutionStateOutDto } from "../../../../contracts/services/evolution/index.js";
import type { CollaborationStateOutDto, CollaborationTaskOutDto } from "../../../../contracts/services/workflow/index.js";
import type { CollaborationTaskDurationEvidence } from "../internal/collaboration/collaboration-duration.log.js";
import { ProposalExecutionAggregate } from "./proposal-execution.aggregate.js";
import { decideCurrentTopicOperation } from "./current-topic-operation.decision.js";
import { projectCurrentTechnicalRecovery } from "./current-topic-technical-recovery.projection.js";
import { emptyCurrentTopicDeliveryEvidence, projectCurrentTopicDeliveryEvidence } from "./current-topic-delivery-evidence.js";
import { projectTopicPreparationStage } from "./current-topic-preparation.projection.js";
import { readCurrentTopicRecovery as readRecovery } from "./current-topic-read-recovery.js";
import { projectTopicFinalPresentation } from "./topic-final-presentation.projection.js";

/**
 * 把专题、提案、有效任务链和最新真实验收事实收敛为唯一当前阶段。
 * 该投影只读取快照，不写入 Evolution、Workflow 或历史档案。
 */
export function projectCurrentTopicStage(
  evolution: EvolutionStateOutDto,
  collaboration: CollaborationStateOutDto,
  durationEvidence: readonly CollaborationTaskDurationEvidence[] = [],
): CurrentTopicStageOutDto {
  const run = evolution.oneShotRun;
  const proposalId = evolution.oneShotRun?.proposalId || null;
  const activeTopic = evolution.activeTopicId ? evolution.topics.find((item) => item.topicId === evolution.activeTopicId) || null : null;
  // 崩溃发生在运行指针提交前时，页面仍可安全呈现唯一的当前待验收专题，等待 Runtime 原位恢复。
  const pendingAcceptanceCandidates = !proposalId && activeTopic?.status === "pending-acceptance"
    ? evolution.proposals.filter((item) => item.topicId === activeTopic.topicId
      && item.version === activeTopic.currentProposalVersion
      && item.status === "pending-acceptance")
    : [];
  const proposal = proposalId
    ? evolution.proposals.find((item) => item.proposalId === proposalId) || null
    : pendingAcceptanceCandidates.length === 1 ? pendingAcceptanceCandidates[0] : null;
  const topic = proposal ? evolution.topics.find((item) => item.topicId === proposal.topicId) || null : null;
  const preparation = projectTopicPreparationStage(evolution, proposal !== null);
  if (preparation) return preparation;
  if (!proposal) throw new Error("当前专题准备阶段缺少未建立提案的投影。");

  // 已取消链只能作为历史展示，绝不能被当前专题投影重新包装成恢复、审批或验收入口。
  const operation = decideCurrentTopicOperation(evolution, collaboration, {
    topicId: topic?.topicId || proposal.topicId,
    proposalId: proposal.proposalId,
    runId: evolution.oneShotRun?.runId || null,
  });
  const operationStage = projectOperationStage(operation, evolution, proposal, topic);
  if (operationStage) return operationStage;

  const currentExecution = new ProposalExecutionAggregate({ proposal, collaborationTasks: collaboration.tasks }).view();
  const execution = currentExecution;
  const currentDurationEvidence = projectCurrentTopicDurationEvidence(execution.effectiveTasks, durationEvidence);
  const latestAcceptance = readLatestAcceptance(evolution, proposal);
  const failureEvidence = readFailureEvidence(evolution, proposal, execution.effectiveTasks);
  const hostStartupAcceptance = readHostStartupAcceptance(evolution, proposal);
  // 只有原流程已进入真实验收，且开始时间晚于上次结果，才展示新一轮验收中。
  const acceptanceStarted = run?.status === "running" && run.phase === "accepting"
    && (!latestAcceptance || run.updatedAt > latestAcceptance.occurredAt);
  // 运行中的新验收轮次优先于已归档的上一轮结果；否则页面会把“验收中”错误展示为旧轮已通过。
  const deliveryAcceptance = acceptanceStarted
    ? { runId: run.runId, status: "running" as const, occurredAt: run.updatedAt }
    : latestAcceptance;
  // 当前恢复任务决定预检状态，最近已交付任务决定候选和交付证据，二者不能互相覆盖。
  const currentTaskEvidence = projectCurrentTopicDeliveryEvidence(execution.effectiveTasks, collaboration, deliveryAcceptance);
  const deliveredTaskEvidence = projectCurrentTopicDeliveryEvidence(execution.deliveryTasks, collaboration, deliveryAcceptance);
  const deliveryEvidence = { ...deliveredTaskEvidence, preflight: currentTaskEvidence.preflight };
  const technicalStage = projectCurrentTechnicalRecovery({ evolution, proposal, topic, execution,
    latestAcceptance, hostStartupAcceptance, deliveryEvidence });
  // 技术恢复只改变责任人与恢复入口；同一专题的失败分类和真实阶段时长仍必须留在主卡。
  if (technicalStage) return { ...technicalStage, durationEvidence: currentDurationEvidence, failureEvidence };

  const monitorStage = projectMonitorAcceptanceStage(evolution, proposal, topic);
  if (monitorStage) return monitorStage;

  const finalConclusion = readFinalConclusion(evolution, proposal);
  const task = latestEffectiveTask(execution.effectiveTasks);
  // 完成态后的真实复核仍属于当前专题；运行明确阻塞时不得让旧完成事实覆盖恢复入口。
  const runBlocked = run?.status === "blocked"
    && run.topicId === topic?.topicId
    && run.proposalId === proposal.proposalId;
  const failedAcceptance = latestAcceptance?.status === "failed" || latestAcceptance?.status === "blocked";
  const finalPresentation = projectTopicFinalPresentation({
    terminal: finalConclusion ? {
      occurredAt: finalConclusion.occurredAt,
      summary: "韩立结果验收已经通过，专题已完成。",
    } : null,
    // 当前专题投影已确认这些是真实活动；它们只能在终态之后覆盖旧结论。
    laterActivity: runBlocked ? { occurredAt: run!.updatedAt, status: "blocked", summary: "当前专题运行受阻，等待按原恢复点处理。" }
      : acceptanceStarted ? { occurredAt: run!.updatedAt, status: "verifying", summary: "韩立已开始本轮结果验收。" }
        : failedAcceptance ? { occurredAt: latestAcceptance!.occurredAt, status: "blocked", summary: "最新真实验收未通过，等待按原恢复点处理。" }
          : execution.blocked ? { occurredAt: task?.updatedAt || evolution.updatedAt, status: "blocked", summary: execution.summary }
            : null,
  });
  const deliveryGate = readDeliveryGate(deliveryEvidence);
  const preflightGate = readPreflightGate(deliveryEvidence, execution.effectiveTasks);
  const stageGate = preflightGate || deliveryGate;
  const taskNeedsConfirmation = execution.effectiveTasks.some((item) => item.repairRequiresUserConfirmation === true);
  let status: CurrentTopicStageOutDto["status"] = "executing";
  if (taskNeedsConfirmation) status = "awaiting-confirmation";
  else if (runBlocked) status = "failed-pending-repair";
  else if (acceptanceStarted) status = "accepting";
  else if (failedAcceptance) status = "failed-pending-repair";
  else if (proposal.status === "completed") status = finalPresentation?.status === "completed" ? "completed" : "completed-unverified";
  else if (stageGate) status = stageGate.status;
  else if (execution.nextStatus === "pending-acceptance") status = "pending-acceptance";
  else if (execution.blocked) status = "failed-pending-repair";
  else if (execution.nextStatus === "verifying") status = "verifying";

  // 当前任务另有真实阻塞时，旧一次性运行的恢复入口不能抢在任务归属判定前签发。
  // 任务级客户动作只能由已核对故障关联与完整指导的技术恢复投影签发。
  const userAction = status === "awaiting-confirmation" ? "confirmation" : status === "failed-pending-repair" && runBlocked && !execution.blocked ? "resume" : "none";
  const updatedAt = [proposal.updatedAt, task?.updatedAt, latestAcceptance?.occurredAt].filter((item): item is string => Boolean(item)).sort().at(-1) || evolution.updatedAt;
  const topicDuration = projectTopicDuration(topic, status, finalConclusion, updatedAt);
  const waitingFor = stageWaitingFor(status, stageGate);
  const nextAction = stageNextAction(status, stageGate);

  return {
    topicId: topic?.topicId || proposal.topicId,
    proposalId: proposal.proposalId,
    status,
    title: topic?.title || proposal.title,
    summary: stageSummary(status, execution.summary, latestAcceptance, stageGate),
    repairContent: task?.resultSummary?.changes || task?.resultSummary?.solvedProblem || task?.snapshot?.confirmedIntent || proposal.content,
    remaining: stageRemaining(status, task, execution.missingTaskIds, stageGate),
    waitingFor,
    nextAction,
    userAction,
    // 一次性专题阻塞必须携带原运行标识，Renderer 才能调用已有补验恢复入口；任务级卡点继续保持空值。
    resumeOneShotRunId: userAction === "resume" && runBlocked ? run.runId : null,
    resumeTaskId: null,
    customerActionGuidance: null,
    readRecovery: readRecovery(userAction, waitingFor, nextAction, updatedAt),
    effectiveTaskIds: execution.effectiveTasks.map((item) => item.taskId),
    missingTaskIds: execution.missingTaskIds,
    latestAcceptance,
    finalConclusion,
    hostStartupAcceptance,
    deliveryEvidence,
    durationEvidence: currentDurationEvidence,
    topicDuration,
    failureEvidence,
    updatedAt,
  };
}

/** 专题总历时只使用专题创建与可追溯终态，不能由阶段总和或最近刷新时间补造。 */
function projectTopicDuration(topic: EvolutionStateOutDto["topics"][number] | null, status: CurrentTopicStageOutDto["status"], finalConclusion: CurrentTopicStageOutDto["finalConclusion"] | null, updatedAt: string): CurrentTopicStageOutDto["topicDuration"] {
  const startedAt = topic?.createdAt || null;
  if (!startedAt || !Number.isFinite(Date.parse(startedAt))) return { startedAt: null, endedAt: null, durationMs: null, status: "missing" };
  const terminal = Boolean(finalConclusion) || ["completed", "completed-unverified", "cancelled"].includes(status);
  const endedAt = terminal ? finalConclusion?.occurredAt || updatedAt : null;
  const endMs = endedAt ? Date.parse(endedAt) : Number.NaN;
  return { startedAt, endedAt, durationMs: Number.isFinite(endMs) && endMs >= Date.parse(startedAt) ? endMs - Date.parse(startedAt) : terminal ? null : 0, status: terminal ? "completed" : "running" };
}

/** 只聚合当前有效任务已完成的绑定时段；缺项保留为缺项，不能用总处理时长填补。 */
function projectCurrentTopicDurationEvidence(
  tasks: readonly CollaborationTaskOutDto[],
  evidence: readonly CollaborationTaskDurationEvidence[],
): CurrentTopicStageDurationEvidenceOutDto {
  const taskIds = new Set(tasks.map((task) => task.taskId));
  const relevant = evidence.filter((item) => taskIds.has(item.taskId));
  const bindingStatus = relevant.length === 0 ? "missing"
    : relevant.some((item) => item.bindingStatus !== "available")
      ? relevant.find((item) => item.bindingStatus !== "available")!.bindingStatus
      : "available";
  const phases: Array<{ phase: CurrentTopicStageDurationEvidenceOutDto["phases"][number]["phase"]; segments: string[]; flowRange?: [string[], string[]] }> = [
    { phase: "investigation", segments: ["analysis"], flowRange: [["worker.phase.analyzing"], ["technical_analysis.ready"]] },
    { phase: "implementation", segments: ["source-change"], flowRange: [["execution.started"], ["executor.self_test_started"]] },
    { phase: "testing", segments: ["verification", "preflight", "combination-test"], flowRange: [["executor.self_test_started"], ["task.code_verified"]] },
    { phase: "release", segments: ["release"], flowRange: [["release.restart_scheduled"], ["release.published"]] },
    { phase: "restart", segments: ["restart-health"], flowRange: [["release.published"], ["release.restart_healthy"]] },
    { phase: "hanli-acceptance", segments: ["result-acceptance"] },
  ];
  return {
    bindingStatus,
    phases: phases.map(({ phase, segments, flowRange }) => {
      const events = relevant.flatMap((item) => item.events)
        .filter((event) => event.outcome === "completed" && segments.includes(event.segment));
      const flowDurationMs = events.length || !flowRange ? null : sumCompletedFlowRanges(tasks, flowRange[0], flowRange[1]);
      const durationMs = events.length ? events.reduce((total, event) => total + event.durationMs, 0) : flowDurationMs;
      const candidateAttempts = projectCandidateAttempts(events);
      return {
        phase, durationMs, status: durationMs === null ? "missing" : "recorded",
        completedCount: events.length || flowDurationMs !== null ? Math.max(events.length, 1) : 0,
        candidateAttempts,
      };
    }),
    waits: relevant.flatMap((item) => item.events)
      .filter((event) => event.outcome === "completed" && event.waitType !== null)
      .map((event) => ({ waitType: event.waitType!, reasonCode: event.reasonCode, durationMs: event.durationMs })),
  };
}

/** 同一候选的重复完成只在具有相同明确候选标识时合并；无标识事件单独保留缺失事实。 */
function projectCandidateAttempts(events: Array<CollaborationTaskDurationEvidence["events"][number]>): Array<{
  candidateSha: string | null;
  completedCount: number;
  durationMs: number;
}> {
  const attempts = new Map<string, { candidateSha: string | null; completedCount: number; durationMs: number }>();
  for (const event of events) {
    const candidateSha = typeof event.candidateSha === "string" ? event.candidateSha : null;
    const key = candidateSha || "candidate-not-recorded";
    const existing = attempts.get(key);
    if (existing) {
      existing.completedCount += 1;
      existing.durationMs += event.durationMs;
      continue;
    }
    attempts.set(key, { candidateSha, completedCount: 1, durationMs: event.durationMs });
  }
  return [...attempts.values()];
}

/** 进程重启会中断内存计时；只用同一任务已落盘的明确开始/结束事件补回真实完成时段。 */
function sumCompletedFlowRanges(tasks: readonly CollaborationTaskOutDto[], starts: string[], ends: string[]): number | null {
  const durations = tasks.flatMap((task) => {
    const flow = Array.isArray(task.flowEvents) ? task.flowEvents : [];
    const startIndex = flow.findIndex((event) => starts.includes(event.type));
    if (startIndex < 0) return [];
    // 某阶段的结束也可能由下一阶段 started 事件标记；事件本身无需伪装成 completed。
    const end = flow.slice(startIndex + 1).find((event) => ends.includes(event.type));
    const startedAt = Date.parse(flow[startIndex].occurredAt);
    const endedAt = end ? Date.parse(end.occurredAt) : Number.NaN;
    return Number.isFinite(startedAt) && Number.isFinite(endedAt) && endedAt >= startedAt ? [endedAt - startedAt] : [];
  });
  return durations.length ? durations.reduce((total, duration) => total + duration, 0) : null;
}

/** 从真实验收运行与替代链投影客户可辨分类；不解析自由文本，也不把多个条件扩成多个缺陷。 */
function readFailureEvidence(
  evolution: EvolutionStateOutDto,
  proposal: EvolutionStateOutDto["proposals"][number],
  tasks: readonly CollaborationTaskOutDto[],
): CurrentTopicStageOutDto["failureEvidence"] {
  const record = evolution.archiveRecords.filter((item) => item.proposalId === proposal.proposalId && item.eventType === "acceptance.result_checked")
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0];
  const run = record?.payload.acceptanceRun as { runId?: unknown; status?: unknown; acceptanceDisposition?: unknown; stepResults?: unknown } | undefined;
  if (!run || run.status === "passed" || typeof run.runId !== "string") return null;
  const classification = run.acceptanceDisposition === "product-or-safety-failure" ? "product-defect"
    : run.acceptanceDisposition === "acceptance-capability-or-runtime-blocked" ? "acceptance-capability-blocked"
      : run.acceptanceDisposition === "acceptance-precondition-unavailable" ? "infrastructure-blocked" : null;
  if (!classification) return null;
  const failedSteps = Array.isArray(run.stepResults) ? run.stepResults.filter((item) => {
    const step = item as { status?: unknown; layoutStatus?: unknown };
    return step.status === "failed" || step.status === "blocked" || step.layoutStatus === "failed" || step.layoutStatus === "blocked";
  }) : [];
  const repairTaskIds = tasks.map((task) => task.taskId);
  return {
    classification,
    summary: failedSteps.length ? `原始验收保留 ${failedSteps.length} 项未通过或未验证条件。` : "原始验收失败事实已保留。",
    relatedFailures: failedSteps.length > 1 || tasks.some((task) => Boolean(task.replacementForTaskId)) ? "merged-single-repair-chain" : "single-failure",
    acceptanceRunId: run.runId,
    repairTaskIds,
  };
}

/** 已取消链只保留历史，不重新包装成恢复、审批或验收入口。 */
function projectOperationStage(
  operation: ReturnType<typeof decideCurrentTopicOperation>,
  evolution: EvolutionStateOutDto,
  proposal: EvolutionStateOutDto["proposals"][number],
  topic: EvolutionStateOutDto["topics"][number] | null,
): CurrentTopicStageOutDto | null {
  if (operation.kind === "cancelled") return {
    topicId: operation.topicId, proposalId: operation.proposalId, status: "cancelled", title: topic?.title || proposal.title,
    summary: operation.message, repairContent: "", remaining: "", waitingFor: "当前无需操作", nextAction: "本专题已取消", userAction: "none",
    resumeOneShotRunId: null,
    readRecovery: readRecovery("none", "当前无需操作", "本专题已取消", evolution.updatedAt),
    effectiveTaskIds: [], missingTaskIds: [], latestAcceptance: null, hostStartupAcceptance: emptyHostStartupAcceptance(), deliveryEvidence: emptyCurrentTopicDeliveryEvidence(), updatedAt: evolution.updatedAt,
  };
  if (operation.kind === "unavailable") return {
    topicId: operation.topicId, proposalId: operation.proposalId, status: "not-run", title: "当前专题读取受阻",
    summary: operation.message, repairContent: "", remaining: operation.message, waitingFor: "当前专题状态", nextAction: "重新读取当前专题状态后再决定后续操作。", userAction: "none",
    resumeOneShotRunId: null,
    readRecovery: readRecovery("none", "当前专题状态", "重新读取当前专题状态后再决定后续操作。", evolution.updatedAt),
    effectiveTaskIds: [], missingTaskIds: [], latestAcceptance: null, hostStartupAcceptance: emptyHostStartupAcceptance(), deliveryEvidence: emptyCurrentTopicDeliveryEvidence(), updatedAt: evolution.updatedAt,
  };
  return null;
}

/** 监控者独立验收卡没有分发计划，不套用普通代码候选门禁。 */
function projectMonitorAcceptanceStage(
  evolution: EvolutionStateOutDto,
  proposal: EvolutionStateOutDto["proposals"][number],
  topic: EvolutionStateOutDto["topics"][number] | null,
): CurrentTopicStageOutDto | null {
  const run = evolution.oneShotRun;
  if (!topic?.recoveryPoint?.startsWith("monitor-formal-acceptance-") || proposal.distributionPlan !== null
    || proposal.distributedTaskIds.length !== 0 || run?.topicId !== topic.topicId || run.proposalId !== proposal.proposalId) return null;
  const occurredAt = run.completedAt || run.updatedAt;
  const finalConclusion = readFinalConclusion(evolution, proposal);
  const latestAcceptance = readLatestAcceptance(evolution, proposal);
  const hostStartupAcceptance = readHostStartupAcceptance(evolution, proposal);
  const verified = topic.status === "completed" && proposal.status === "completed"
    && finalConclusion !== null && latestAcceptance?.status === "passed";
  const failed = topic.status === "supplement-required" || run.status === "blocked" || latestAcceptance?.status === "failed";
  return {
    topicId: topic.topicId, proposalId: proposal.proposalId,
    status: verified ? "completed" : topic.status === "completed" ? "completed-unverified" : failed ? "failed-pending-repair" : "pending-acceptance", title: topic.title,
    summary: verified ? (proposal.resultSummary || "正式页面验收通过，专题已完成。")
      : topic.status === "completed" ? "完成状态缺少可追溯验收记录，尚未核验。"
        : failed ? "独立页面验收未通过，等待核对失败证据。" : "正式版本已交付，等待独立页面验收。", repairContent: proposal.content,
    remaining: verified ? "" : "缺少当前专题的唯一最终验收结论及通过记录。", waitingFor: verified ? "当前无需操作" : "韩立独立验收",
    nextAction: verified ? "可开始下一专题。" : "核对正式页面验收证据并记录最终结论。", userAction: "none",
    resumeOneShotRunId: null,
    readRecovery: readRecovery("none", verified ? "当前无需操作" : "韩立独立验收", verified ? "可开始下一专题。" : "核对正式页面验收证据并记录最终结论。", occurredAt),
    effectiveTaskIds: [], missingTaskIds: [], latestAcceptance, finalConclusion,
    hostStartupAcceptance, deliveryEvidence: { ...emptyCurrentTopicDeliveryEvidence(), acceptance: verified ? "passed" : "missing" }, updatedAt: occurredAt,
  };
}

/** 只接受与完成提案、通过验收运行和完整条件证据绑定的同一快照档案。 */
function readFinalConclusion(evolution: EvolutionStateOutDto, proposal: EvolutionStateOutDto["proposals"][number]): NonNullable<CurrentTopicStageOutDto["finalConclusion"]> | null {
  const recordId = proposal.finalConclusionRecordId;
  if (proposal.status !== "completed" || typeof recordId !== "string" || !recordId) return null;
  const record = evolution.archiveRecords.find((item) => item.recordId === recordId
    && item.eventType === "proposal.result_decided"
    && item.topicId === proposal.topicId
    && item.proposalId === proposal.proposalId);
  const value = record?.payload.finalConclusion;
  if (!record || !value || typeof value !== "object") return null;
  const conclusion = value as {
    recordId?: unknown; handler?: unknown; occurredAt?: unknown; acceptanceRunId?: unknown;
    conditionResults?: unknown; evidenceReferences?: unknown;
  };
  if (conclusion.recordId !== record.recordId || typeof conclusion.handler !== "string" || !conclusion.handler.trim()
    || typeof conclusion.occurredAt !== "string" || typeof conclusion.acceptanceRunId !== "string"
    || !Array.isArray(conclusion.conditionResults) || !conclusion.conditionResults.length
    || !Array.isArray(conclusion.evidenceReferences) || !conclusion.evidenceReferences.length) return null;
  const acceptance = readLatestAcceptance(evolution, proposal);
  if (acceptance?.runId !== conclusion.acceptanceRunId || acceptance.status !== "passed") return null;
  const conditionResults: NonNullable<CurrentTopicStageOutDto["finalConclusion"]>["conditionResults"] = [];
  for (const raw of conclusion.conditionResults) {
    const item = raw as { checkId?: unknown; status?: unknown; evidenceReferences?: unknown };
    if (typeof item.checkId !== "string" || item.status !== "passed"
      || !Array.isArray(item.evidenceReferences) || !item.evidenceReferences.length
      || item.evidenceReferences.some((reference) => typeof reference !== "string" || !reference.trim())) return null;
    conditionResults.push({ checkId: item.checkId, status: item.status, evidenceReferences: [...item.evidenceReferences] });
  }
  if (conclusion.evidenceReferences.some((reference) => typeof reference !== "string" || !reference.trim())) return null;
  const evidenceReferences = conclusion.evidenceReferences as string[];
  return {
    recordId: record.recordId,
    handler: conclusion.handler,
    occurredAt: conclusion.occurredAt,
    acceptanceRunId: conclusion.acceptanceRunId,
    conditionResults,
    evidenceReferences: [...evidenceReferences],
  };
}

function emptyHostStartupAcceptance(reason = "尚未记录当前专题的 Host 启动验收依据。"): CurrentTopicStageOutDto["hostStartupAcceptance"] {
  return { launchId: null, handler: null, startedAt: null, commandStatus: "missing", exitCode: null, healthStatus: "missing", healthSummary: null, evidenceReadable: false, evidenceReferences: [], launcherSource: null, healthResponse: null, status: "unverified", reason };
}

/** 只读取当前专题、当前提案的专用档案；审批、发布和历史记录均不参与。 */
function readHostStartupAcceptance(evolution: EvolutionStateOutDto, proposal: EvolutionStateOutDto["proposals"][number]): CurrentTopicStageOutDto["hostStartupAcceptance"] {
  const record = [...evolution.archiveRecords].reverse().find((item) => item.eventType === "host-startup.evidence-recorded" && item.topicId === proposal.topicId && item.proposalId === proposal.proposalId);
  const raw = record?.payload.hostStartupEvidence;
  if (!raw || typeof raw !== "object") return emptyHostStartupAcceptance();
  const value = raw as { launchId?: unknown; handler?: unknown; startedAt?: unknown; command?: { launchId?: unknown; state?: unknown; exitCode?: unknown }; health?: { launchId?: unknown; success?: unknown; checkedAt?: unknown; summary?: unknown }; evidenceSnapshot?: { launcherSource?: unknown; healthResponse?: unknown }; evidenceReferences?: unknown };
  const launchId = typeof value.launchId === "string" ? value.launchId : null;
  const handler = typeof value.handler === "string" ? value.handler : null;
  const startedAt = typeof value.startedAt === "string" ? value.startedAt : null;
  const commandStatus = value.command?.state === "running" || value.command?.state === "exited"
    ? value.command.state
    : typeof value.command?.exitCode === "number" ? "exited" : "missing";
  const exitCode = typeof value.command?.exitCode === "number" ? value.command.exitCode : null;
  const healthSummary = typeof value.health?.summary === "string" ? value.health.summary : null;
  const healthStatus = value.health?.success === true ? "passed" : value.health?.success === false ? "failed" : "missing";
  const evidenceReferences = Array.isArray(value.evidenceReferences) ? value.evidenceReferences.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
  let healthResponseReadable = false;
  if (typeof value.evidenceSnapshot?.healthResponse === "string" && value.evidenceSnapshot.healthResponse === healthSummary) {
    try {
      const response = JSON.parse(value.evidenceSnapshot.healthResponse) as { success?: unknown; data?: { status?: unknown } };
      healthResponseReadable = response.success === true && response.data?.status === "READY";
    } catch { healthResponseReadable = false; }
  }
  const launcherSource = typeof value.evidenceSnapshot?.launcherSource === "string" ? value.evidenceSnapshot.launcherSource : null;
  const healthResponse = typeof value.evidenceSnapshot?.healthResponse === "string" ? value.evidenceSnapshot.healthResponse : null;
  const expectedReferences = launchId ? [`archive://host-startup/${encodeURIComponent(launchId)}/launcherSource`, `archive://host-startup/${encodeURIComponent(launchId)}/healthResponse`] : [];
  // 引用只指向本次不可覆盖档案中的两个字段，避免把当前文件或已关闭的 8080 服务误当成可读历史依据。
  const evidenceReadable = launcherSource?.startsWith("#!/bin/zsh") === true && healthResponseReadable && evidenceReferences.length === expectedReferences.length
    && expectedReferences.every((reference) => evidenceReferences.includes(reference));
  const matchedLaunch = Boolean(launchId && value.command?.launchId === launchId && value.health?.launchId === launchId);
  const commandAccepted = commandStatus === "exited" && exitCode === 0;
  const passed = Boolean(matchedLaunch && handler?.trim() && startedAt && commandAccepted && healthStatus === "passed" && typeof value.health?.checkedAt === "string" && evidenceReadable && evidenceReferences.length);
  return { launchId, handler, startedAt, commandStatus, exitCode, healthStatus, healthSummary, evidenceReadable, evidenceReferences, launcherSource, healthResponse, status: passed ? "passed" : "unverified", reason: passed ? "同一启动标识的退出码、8080 health 和可读证据快照均已核验。" : "Host 启动依据不完整、失败、不可读取或未绑定同一启动标识。" };
}

type DeliveryGate = {
  status: CurrentTopicStageOutDto["status"];
  summary: string;
  remaining: string;
  waitingFor: string;
  nextAction: string;
};

/** 预检只决定如何处理当前候选，不能替代统一测试、发布、重启健康或真实验收。 */
function readPreflightGate(evidence: CurrentTopicStageOutDto["deliveryEvidence"], tasks: CollaborationTaskOutDto[]): DeliveryGate | null {
  const preflight = evidence.preflight;
  const unifiedTestStarted = tasks.some((task) => (Array.isArray(task.flowEvents) ? task.flowEvents : [])
    .some((event) => event.type === "unified_test.started"));
  if (preflight.status === "running") return { status: "preflighting", summary: "快速预检进行中，尚未产生可复用结论。", remaining: "正在核对候选版本、影响范围、测试输入和证据有效性。", waitingFor: "当前任务处理者", nextAction: "完成快速预检并记录问题或复用决定。" };
  if (preflight.status === "issues-found") return { status: "failed-pending-repair", summary: "快速预检发现问题，完整统一测试尚未启动。", remaining: preflight.issues.map((issue) => `${issue.category}：${issue.summary}（影响 ${issue.affectedStage}）`).join("；") || "预检问题尚未提供完整说明。", waitingFor: "原任务恢复处理", nextAction: "依据同轮预检问题集合处理后，从原恢复点继续。" };
  if (!unifiedTestStarted && preflight.status === "rerun-required") return { status: "verifying", summary: "预检未满足复用条件，将重新执行。", remaining: preflight.issues.map((issue) => issue.summary).join("；") || "候选版本、影响范围、测试输入或证据有效性缺失或不一致。", waitingFor: "完整统一测试结论", nextAction: "使用当前候选重新执行完整统一测试，并保留本轮预检依据。" };
  if (!unifiedTestStarted && preflight.status === "reused") return { status: "verifying", summary: `预检确认可复用：${preflight.reusableStages.join("、") || "未受影响阶段"}。`, remaining: "仍需按当前候选完成未复用的后续交付门禁。", waitingFor: "完整统一测试结论", nextAction: "记录当前候选的完整统一测试结果，后续发布、重启健康和验收继续独立判定。" };
  return null;
}

/** 按交付闭环顺序找出第一个未满足事实，避免待验收状态掩盖候选或门禁缺项。 */
function readDeliveryGate(evidence: CurrentTopicStageOutDto["deliveryEvidence"]): DeliveryGate | null {
  if (!evidence.candidate) {
    return { status: "verifying", summary: "当前交付缺少最终候选，不能进入真实验收。", remaining: "缺少最终候选。", waitingFor: "最终候选", nextAction: "生成最终候选，并关联当前有效任务链。" };
  }
  if (evidence.unifiedTest === "failed") {
    return { status: "failed-pending-repair", summary: "最终候选的完整统一测试未通过，不能进入发布或真实验收。", remaining: "完整统一测试未通过。", waitingFor: "原任务恢复处理", nextAction: "保留完整统一测试失败证据并从原恢复点处理。" };
  }
  if (evidence.unifiedTest === "missing") {
    return { status: "verifying", summary: "最终候选缺少完整统一测试结论，不能进入发布或真实验收。", remaining: "缺少完整统一测试结论。", waitingFor: "完整统一测试结论", nextAction: "完成最终候选的完整统一测试，并记录通过或失败结果。" };
  }
  if (evidence.release === "missing") {
    return { status: "awaiting-release", summary: "最终候选已通过完整测试，缺少发布结果。", remaining: "缺少发布结果。", waitingFor: "发布服务", nextAction: "发布最终候选，并记录发布结果。" };
  }
  if (evidence.restartHealth === "missing") {
    return { status: "awaiting-restart-health", summary: "候选验证已完成，等待打包与重启健康检查确认发布结果。", remaining: "缺少重启健康检查结果。", waitingFor: "新版本重启健康检查", nextAction: "完成新版本重启健康检查，并记录结果。" };
  }
  if (evidence.acceptance === "passed") return null;
  if (evidence.acceptance === "running") {
    return { status: "accepting", summary: "韩立已开始本轮结果验收。", remaining: "等待真实验收结果。", waitingFor: "韩立真实验收", nextAction: "等待韩立记录本轮真实验收结果。" };
  }
  return { status: "pending-acceptance", summary: "最终候选已完成测试、发布和重启健康检查，缺少真实验收结果。", remaining: "缺少真实验收结果。", waitingFor: "韩立真实验收", nextAction: "韩立按真实路径验收最终候选，并记录结果。" };
}

function readLatestAcceptance(evolution: EvolutionStateOutDto, proposal: EvolutionStateOutDto["proposals"][number]): CurrentTopicAcceptanceOutDto | null {
  const record = evolution.archiveRecords.filter((item) => item.proposalId === proposal.proposalId && item.eventType === "acceptance.result_checked")
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0];
  const acceptanceRun = record?.payload.acceptanceRun;
  if (!record || !acceptanceRun || typeof acceptanceRun !== "object") return null;
  const value = acceptanceRun as { runId?: unknown; status?: unknown; planId?: unknown; acceptanceRoundId?: unknown };
  if (typeof value.runId !== "string" || !["running", "passed", "failed", "blocked"].includes(String(value.status))) return null;
  // 新计划链只显示当前验收轮次；旧归档没有计划时保留历史投影，但不能覆盖重开后的待验收状态。
  if (proposal.acceptancePlan && (value.planId !== proposal.acceptancePlan.planId || value.acceptanceRoundId !== proposal.acceptancePlan.currentRoundId)) return null;
  return { runId: value.runId, status: value.status as CurrentTopicAcceptanceOutDto["status"], occurredAt: record.occurredAt };
}

function latestEffectiveTask(tasks: CollaborationTaskOutDto[]): CollaborationTaskOutDto | null {
  return [...tasks].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] || null;
}

function stageSummary(status: CurrentTopicStageOutDto["status"], executionSummary: string, acceptance: CurrentTopicAcceptanceOutDto | null, deliveryGate: DeliveryGate | null): string {
  if (deliveryGate?.status === status) return deliveryGate.summary;
  if (status === "failed-pending-repair") return acceptance ? `最新真实验收 ${acceptance.runId} 未通过，等待按原恢复点处理。` : executionSummary;
  if (status === "pending-acceptance") return "当前有效任务已经完成，等待韩立选择适用的结果验收方式。";
  if (status === "awaiting-release") return "最终候选已通过完整测试，等待发布结果。";
  if (status === "awaiting-restart-health") return "候选验证已完成，等待重启健康检查确认发布结果。";
  if (status === "accepting") return "韩立已开始本轮结果验收。";
  if (status === "completed") return "韩立结果验收已经通过，专题已完成。";
  if (status === "completed-unverified") return "尚未核验：当前无法确认最终验收通过。";
  return executionSummary;
}

function stageWaitingFor(status: CurrentTopicStageOutDto["status"], deliveryGate: DeliveryGate | null): string {
  if (deliveryGate?.status === status) return deliveryGate.waitingFor;
  // 专题已经完成时不再虚构处理中处理人，卡片只说明当前无需操作。
  if (status === "completed") return "当前无需操作";
  if (status === "completed-unverified") return "验收依据";
  if (status === "awaiting-confirmation") return "用户确认";
  if (status === "awaiting-release") return "发布服务";
  if (status === "awaiting-restart-health") return "新版本重启健康检查";
  if (status === "pending-acceptance" || status === "accepting") return "韩立真实验收";
  if (status === "failed-pending-repair") return "原任务恢复处理";
  return "当前任务处理者";
}

function stageNextAction(status: CurrentTopicStageOutDto["status"], deliveryGate: DeliveryGate | null): string {
  if (deliveryGate?.status === status) return deliveryGate.nextAction;
  // 完成结论已闭合，下一步是开始独立的新专题而不是继续当前处理。
  if (status === "completed") return "可开始下一专题。";
  if (status === "completed-unverified") return "系统重新读取权威记录；仍无法取得时由结果验收流程重新记录本轮结论。";
  if (status === "awaiting-confirmation") return "确认当前范围说明后继续。";
  if (status === "awaiting-release") return "发布最终候选，并记录发布结果。";
  if (status === "awaiting-restart-health") return "完成新版本重启健康检查。";
  if (status === "pending-acceptance") return "韩立按真实路径验收最终候选。";
  if (status === "accepting") return "等待韩立记录本轮真实验收结果。";
  if (status === "failed-pending-repair") return "保留失败证据并从原恢复点处理。";
  return "完成当前处理后刷新交付结论。";
}

function stageRemaining(status: CurrentTopicStageOutDto["status"], task: CollaborationTaskOutDto | null, missingTaskIds: string[], deliveryGate: DeliveryGate | null): string {
  if (missingTaskIds.length > 0) return `关联任务记录缺失：${missingTaskIds.join("、")}`;
  if (deliveryGate?.status === status) return deliveryGate.remaining;
  if (status === "failed-pending-repair") return task?.blockingReason || task?.resultSummary?.remaining || "等待处理最新真实验收失败。";
  return task?.resultSummary?.remaining || task?.blockingReason || "";
}
