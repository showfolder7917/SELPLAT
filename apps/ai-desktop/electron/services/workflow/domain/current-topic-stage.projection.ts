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
      effectiveTaskIds: [], missingTaskIds: [], latestAcceptance: null, updatedAt: confirmationUpdatedAt(evolution),
    };
  }

  if (!proposal) {
    return {
      topicId: null, proposalId: null, status: "not-run", title: "暂无修复任务", summary: "当前没有可展示的专题提案。", repairContent: "", remaining: "",
      effectiveTaskIds: [], missingTaskIds: [], latestAcceptance: null, updatedAt: evolution.updatedAt,
    };
  }

  const execution = new ProposalExecutionAggregate({ proposal, collaborationTasks: collaboration.tasks }).view();
  const latestAcceptance = readLatestAcceptance(evolution, proposal.proposalId);
  const task = latestEffectiveTask(execution.effectiveTasks);
  const taskNeedsConfirmation = execution.effectiveTasks.some((item) => item.repairRequiresUserConfirmation === true);
  // 只有原流程已进入真实验收，且开始时间晚于上次结果，才展示新一轮验收中。
  const run = evolution.oneShotRun;
  const acceptanceStarted = run?.status === "running" && run.phase === "accepting"
    && (!latestAcceptance || run.updatedAt > latestAcceptance.occurredAt);
  const failedAcceptance = latestAcceptance?.status === "failed" || latestAcceptance?.status === "blocked";
  const status = awaitingConfirmation || taskNeedsConfirmation
    ? "awaiting-confirmation"
    : acceptanceStarted
      ? "accepting"
    : failedAcceptance
    ? "failed-pending-repair"
    : proposal.status === "completed" && latestAcceptance?.status === "passed"
      ? "completed"
      : proposal.status === "pending-acceptance"
        ? "pending-acceptance"
        : execution.blocked
          ? "failed-pending-repair"
          : execution.nextStatus === "verifying"
            ? "verifying"
            : "executing";

  return {
    topicId: topic?.topicId || proposal.topicId,
    proposalId: proposal.proposalId,
    status,
    title: topic?.title || proposal.title,
    summary: stageSummary(status, execution.summary, latestAcceptance),
    repairContent: task?.resultSummary?.changes || task?.resultSummary?.solvedProblem || task?.snapshot.confirmedIntent || proposal.content,
    remaining: stageRemaining(status, task, execution.missingTaskIds),
    effectiveTaskIds: execution.effectiveTasks.map((item) => item.taskId),
    missingTaskIds: execution.missingTaskIds,
    latestAcceptance,
    updatedAt: [proposal.updatedAt, task?.updatedAt, latestAcceptance?.occurredAt].filter((item): item is string => Boolean(item)).sort().at(-1) || evolution.updatedAt,
  };
}

function hasPendingConfirmation(evolution: EvolutionStateOutDto): boolean {
  const pendingDeliberation = evolution.deliberations.some((item) => item.status === "ready-to-establish"
    && Boolean(item.rounds.at(-1)?.confirmation) && !item.rounds.at(-1)?.confirmation?.reply);
  return pendingDeliberation || evolution.oneShotConfirmation?.status === "awaiting-user-confirmation";
}

function confirmationUpdatedAt(evolution: EvolutionStateOutDto): string {
  return evolution.oneShotConfirmation?.createdAt || evolution.deliberations.flatMap((item) => item.rounds).at(-1)?.confirmation?.offeredAt || evolution.updatedAt;
}

function readLatestAcceptance(evolution: EvolutionStateOutDto, proposalId: string): CurrentTopicAcceptanceOutDto | null {
  const record = evolution.archiveRecords.filter((item) => item.proposalId === proposalId && item.eventType === "acceptance.real_app_checked")
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0];
  const acceptanceRun = record?.payload.acceptanceRun;
  if (!record || !acceptanceRun || typeof acceptanceRun !== "object") return null;
  const value = acceptanceRun as { runId?: unknown; status?: unknown };
  if (typeof value.runId !== "string" || !["running", "passed", "failed", "blocked"].includes(String(value.status))) return null;
  return { runId: value.runId, status: value.status as CurrentTopicAcceptanceOutDto["status"], occurredAt: record.occurredAt };
}

function latestEffectiveTask(tasks: CollaborationTaskOutDto[]): CollaborationTaskOutDto | null {
  return [...tasks].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] || null;
}

function stageSummary(status: CurrentTopicStageOutDto["status"], executionSummary: string, acceptance: CurrentTopicAcceptanceOutDto | null): string {
  if (status === "failed-pending-repair") return acceptance ? `最新真实验收 ${acceptance.runId} 未通过，等待按原恢复点处理。` : executionSummary;
  if (status === "pending-acceptance") return "当前有效任务已经完成，等待韩立开始真实界面验收。";
  if (status === "accepting") return "韩立已开始本轮真实界面验收。";
  if (status === "completed") return "韩立真实界面验收已经通过，专题已完成。";
  return executionSummary;
}

function stageRemaining(status: CurrentTopicStageOutDto["status"], task: CollaborationTaskOutDto | null, missingTaskIds: string[]): string {
  if (missingTaskIds.length > 0) return `关联任务记录缺失：${missingTaskIds.join("、")}`;
  if (status === "failed-pending-repair") return task?.blockingReason || task?.resultSummary?.remaining || "等待处理最新真实验收失败。";
  return task?.resultSummary?.remaining || task?.blockingReason || "";
}
