import type { CurrentTopicAcceptanceOutDto, CurrentTopicStageOutDto, EvolutionStateOutDto } from "../../../../contracts/services/evolution/index.js";
import type { CollaborationStateOutDto, CollaborationTaskOutDto } from "../../../../contracts/services/workflow/index.js";
import { ProposalExecutionAggregate } from "./proposal-execution.aggregate.js";

/**
 * 把专题、提案、有效任务链和最新真实验收事实收敛为唯一当前阶段。
 * 该投影只读取快照，不写入 Evolution、Workflow 或历史档案。
 */
export function projectCurrentTopicStage(
  evolution: EvolutionStateOutDto,
  collaboration: CollaborationStateOutDto,
): CurrentTopicStageOutDto {
  const awaitingConfirmation = hasPendingConfirmation(evolution);
  const proposalId = evolution.oneShotRun?.proposalId || null;
  const proposal = proposalId ? evolution.proposals.find((item) => item.proposalId === proposalId) || null : null;
  const topic = proposal ? evolution.topics.find((item) => item.topicId === proposal.topicId) || null : null;

  if (awaitingConfirmation) {
    return {
      topicId: null, proposalId: null, status: "awaiting-confirmation", title: "等待用户确认",
      summary: "南宫婉已经给出本轮范围说明，等待用户确认。", repairContent: "", remaining: "等待用户确认范围说明。",
      waitingFor: "用户确认", nextAction: "确认当前范围说明后继续。", userAction: "confirmation",
      effectiveTaskIds: [], missingTaskIds: [], latestAcceptance: null, deliveryEvidence: emptyDeliveryEvidence(), updatedAt: confirmationUpdatedAt(evolution),
    };
  }

  if (!proposal) {
    return {
      topicId: null, proposalId: null, status: "not-run", title: "暂无修复任务", summary: "当前没有可展示的专题提案。", repairContent: "", remaining: "",
      waitingFor: "南宫婉", nextAction: "等待形成可执行专题。", userAction: "none",
      effectiveTaskIds: [], missingTaskIds: [], latestAcceptance: null, deliveryEvidence: emptyDeliveryEvidence(), updatedAt: evolution.updatedAt,
    };
  }

  const execution = new ProposalExecutionAggregate({ proposal, collaborationTasks: collaboration.tasks }).view();
  const latestAcceptance = readLatestAcceptance(evolution, proposal);
  const task = latestEffectiveTask(execution.effectiveTasks);
  const deliveryEvidence = readDeliveryEvidence(execution.effectiveTasks, collaboration, latestAcceptance);
  const taskNeedsConfirmation = execution.effectiveTasks.some((item) => item.repairRequiresUserConfirmation === true);
  // 只有原流程已进入真实验收，且开始时间晚于上次结果，才展示新一轮验收中。
  const run = evolution.oneShotRun;
  const acceptanceStarted = run?.status === "running" && run.phase === "accepting"
    && (!latestAcceptance || run.updatedAt > latestAcceptance.occurredAt);
  // 完成态后的真实复核仍属于当前专题；运行明确阻塞时不得让旧完成事实覆盖恢复入口。
  const runBlocked = run?.status === "blocked"
    && run.topicId === topic?.topicId
    && run.proposalId === proposal.proposalId;
  const failedAcceptance = latestAcceptance?.status === "failed" || latestAcceptance?.status === "blocked";
  let status: CurrentTopicStageOutDto["status"] = "executing";
  if (awaitingConfirmation || taskNeedsConfirmation) status = "awaiting-confirmation";
  else if (acceptanceStarted || deliveryEvidence.acceptance === "running") status = "accepting";
  else if (runBlocked || failedAcceptance || deliveryEvidence.unifiedTest === "failed") status = "failed-pending-repair";
  else if (deliveryEvidence.acceptance === "passed" && deliveryEvidence.restartHealth === "passed" && deliveryEvidence.release === "published" && deliveryEvidence.unifiedTest === "passed" && deliveryEvidence.candidate) status = "completed";
  else if (deliveryEvidence.restartHealth === "passed") status = "pending-acceptance";
  else if (deliveryEvidence.release === "published") status = "awaiting-restart-health";
  else if (deliveryEvidence.unifiedTest === "passed") status = "awaiting-release";
  else if (proposal.status === "pending-acceptance") status = "pending-acceptance";
  else if (execution.blocked) status = "failed-pending-repair";
  else if (execution.nextStatus === "verifying") status = "verifying";

  return {
    topicId: topic?.topicId || proposal.topicId,
    proposalId: proposal.proposalId,
    status,
    title: topic?.title || proposal.title,
    summary: stageSummary(status, execution.summary, latestAcceptance),
    repairContent: task?.resultSummary?.changes || task?.resultSummary?.solvedProblem || task?.snapshot.confirmedIntent || proposal.content,
    remaining: stageRemaining(status, task, execution.missingTaskIds),
    waitingFor: stageWaitingFor(status),
    nextAction: stageNextAction(status),
    userAction: status === "awaiting-confirmation" ? "confirmation" : status === "failed-pending-repair" && (taskNeedsConfirmation || runBlocked) ? "resume" : "none",
    effectiveTaskIds: execution.effectiveTasks.map((item) => item.taskId),
    missingTaskIds: execution.missingTaskIds,
    latestAcceptance,
    deliveryEvidence,
    updatedAt: [proposal.updatedAt, task?.updatedAt, latestAcceptance?.occurredAt].filter((item): item is string => Boolean(item)).sort().at(-1) || evolution.updatedAt,
  };
}

function emptyDeliveryEvidence(): CurrentTopicStageOutDto["deliveryEvidence"] {
  return { candidate: null, unifiedTest: "missing", release: "missing", restartHealth: "missing", acceptance: "missing" };
}

function readDeliveryEvidence(tasks: CollaborationTaskOutDto[], collaboration: CollaborationStateOutDto, acceptance: CurrentTopicAcceptanceOutDto | null): CurrentTopicStageOutDto["deliveryEvidence"] {
  if (!tasks.length) return { ...emptyDeliveryEvidence(), acceptance: acceptance?.status || "missing" };
  const generations = [...new Set(tasks.map((task) => task.integrationGeneration).filter((value): value is number => value !== null))];
  const generation = generations.length === 1 ? generations[0] : null;
  const batch = generation === null ? null : collaboration.integrationBatches?.find((item) => item.generation === generation) || null;
  const candidate = batch?.integrationSha ? { generation: batch.generation, integrationSha: batch.integrationSha } : null;
  const hasEvent = (task: CollaborationTaskOutDto, type: CollaborationTaskOutDto["flowEvents"][number]["type"]) => task.flowEvents.some((event) => event.type === type && event.status === "completed");
  const unifiedTest = tasks.every((task) => task.unifiedTest?.status === "passed" && hasEvent(task, "unified_test.passed")) ? "passed"
    : tasks.some((task) => task.unifiedTest?.status === "failed") ? "failed" : "missing";
  const release = candidate && tasks.every((task) => hasEvent(task, "release.published")) ? "published" : "missing";
  const restartHealth = release === "published" && tasks.every((task) => hasEvent(task, "release.restart_healthy")) ? "passed" : "missing";
  return { candidate, unifiedTest, release, restartHealth, acceptance: acceptance?.status || "missing" };
}

function hasPendingConfirmation(evolution: EvolutionStateOutDto): boolean {
  const pendingDeliberation = evolution.deliberations.some((item) => item.status === "ready-to-establish"
    && Boolean(item.rounds.at(-1)?.confirmation) && !item.rounds.at(-1)?.confirmation?.reply);
  return pendingDeliberation || evolution.oneShotConfirmation?.status === "awaiting-user-confirmation";
}

function confirmationUpdatedAt(evolution: EvolutionStateOutDto): string {
  return evolution.oneShotConfirmation?.createdAt || evolution.deliberations.flatMap((item) => item.rounds).at(-1)?.confirmation?.offeredAt || evolution.updatedAt;
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

function stageSummary(status: CurrentTopicStageOutDto["status"], executionSummary: string, acceptance: CurrentTopicAcceptanceOutDto | null): string {
  if (status === "failed-pending-repair") return acceptance ? `最新真实验收 ${acceptance.runId} 未通过，等待按原恢复点处理。` : executionSummary;
  if (status === "pending-acceptance") return "当前有效任务已经完成，等待韩立选择适用的结果验收方式。";
  if (status === "awaiting-release") return "最终候选已通过完整测试，等待发布结果。";
  if (status === "awaiting-restart-health") return "最终候选已发布，等待重启健康检查。";
  if (status === "accepting") return "韩立已开始本轮结果验收。";
  if (status === "completed") return "韩立结果验收已经通过，专题已完成。";
  return executionSummary;
}

function stageWaitingFor(status: CurrentTopicStageOutDto["status"]): string {
  if (status === "awaiting-confirmation") return "用户确认";
  if (status === "awaiting-release") return "发布服务";
  if (status === "awaiting-restart-health") return "新版本重启健康检查";
  if (status === "pending-acceptance" || status === "accepting") return "韩立真实验收";
  if (status === "failed-pending-repair") return "原任务恢复处理";
  return "当前任务处理者";
}

function stageNextAction(status: CurrentTopicStageOutDto["status"]): string {
  if (status === "awaiting-confirmation") return "确认当前范围说明后继续。";
  if (status === "awaiting-release") return "发布最终候选，并记录发布结果。";
  if (status === "awaiting-restart-health") return "完成新版本重启健康检查。";
  if (status === "pending-acceptance") return "韩立按真实路径验收最终候选。";
  if (status === "accepting") return "等待韩立记录本轮真实验收结果。";
  if (status === "failed-pending-repair") return "保留失败证据并从原恢复点处理。";
  return "完成当前处理后刷新交付结论。";
}

function stageRemaining(status: CurrentTopicStageOutDto["status"], task: CollaborationTaskOutDto | null, missingTaskIds: string[]): string {
  if (missingTaskIds.length > 0) return `关联任务记录缺失：${missingTaskIds.join("、")}`;
  if (status === "failed-pending-repair") return task?.blockingReason || task?.resultSummary?.remaining || "等待处理最新真实验收失败。";
  return task?.resultSummary?.remaining || task?.blockingReason || "";
}
