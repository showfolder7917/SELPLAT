import type { CurrentTopicAcceptanceOutDto, CurrentTopicStageOutDto, EvolutionStateOutDto } from "../../../../contracts/services/evolution/index.js";
import type { CollaborationStateOutDto, CollaborationTaskOutDto } from "../../../../contracts/services/workflow/index.js";
import { ProposalExecutionAggregate } from "./proposal-execution.aggregate.js";
import { decideCurrentTopicOperation } from "./current-topic-operation.decision.js";

/**
 * 把专题、提案、有效任务链和最新真实验收事实收敛为唯一当前阶段。
 * 该投影只读取快照，不写入 Evolution、Workflow 或历史档案。
 */
export function projectCurrentTopicStage(
  evolution: EvolutionStateOutDto,
  collaboration: CollaborationStateOutDto,
): CurrentTopicStageOutDto {
  // 已经绑定专题和提案的当前运行拥有交付阶段；后来产生但尚未确立的研讨不能把它覆盖成
  // 无专题的“等待确认”。独立专题切换必须先由状态机显式退役原运行，投影不在这里猜测切换。
  const activeProposalRun = Boolean(evolution.oneShotRun?.topicId && evolution.oneShotRun?.proposalId
    && evolution.oneShotRun.status !== "completed");
  const awaitingConfirmation = !activeProposalRun && hasPendingConfirmation(evolution);
  const proposalId = evolution.oneShotRun?.proposalId || null;
  const proposal = proposalId ? evolution.proposals.find((item) => item.proposalId === proposalId) || null : null;
  const topic = proposal ? evolution.topics.find((item) => item.topicId === proposal.topicId) || null : null;

  if (awaitingConfirmation) {
    return {
      topicId: null, proposalId: null, status: "awaiting-confirmation", title: "等待用户确认",
      summary: "南宫婉已经给出本轮范围说明，等待用户确认。", repairContent: "", remaining: "等待用户确认范围说明。",
      waitingFor: "用户确认", nextAction: "确认当前范围说明后继续。", userAction: "confirmation",
      resumeOneShotRunId: null,
      readRecovery: readRecovery("confirmation", "用户确认", "确认当前范围说明后继续。", confirmationUpdatedAt(evolution)),
      effectiveTaskIds: [], missingTaskIds: [], latestAcceptance: null, deliveryEvidence: emptyDeliveryEvidence(), updatedAt: confirmationUpdatedAt(evolution),
    };
  }

  if (!proposal) {
    return {
      topicId: null, proposalId: null, status: "not-run", title: "暂无修复任务", summary: "当前没有可展示的专题提案。", repairContent: "", remaining: "",
      waitingFor: "南宫婉", nextAction: "等待形成可执行专题。", userAction: "none",
      resumeOneShotRunId: null,
      readRecovery: readRecovery("none", "当前交付投影", "系统将自动重新读取当前交付投影。", evolution.updatedAt),
      effectiveTaskIds: [], missingTaskIds: [], latestAcceptance: null, deliveryEvidence: emptyDeliveryEvidence(), updatedAt: evolution.updatedAt,
    };
  }

  // 已取消链只能作为历史展示，绝不能被当前专题投影重新包装成恢复、审批或验收入口。
  const operation = decideCurrentTopicOperation(evolution, collaboration, {
    topicId: topic?.topicId || proposal.topicId,
    proposalId: proposal.proposalId,
    runId: evolution.oneShotRun?.runId || null,
  });
  if (operation.kind === "cancelled") {
    return {
      topicId: operation.topicId, proposalId: operation.proposalId, status: "cancelled", title: topic?.title || proposal.title,
      summary: operation.message, repairContent: "", remaining: "", waitingFor: "当前无需操作", nextAction: "本专题已取消", userAction: "none",
      resumeOneShotRunId: null,
      readRecovery: readRecovery("none", "当前无需操作", "本专题已取消", evolution.updatedAt),
      effectiveTaskIds: [], missingTaskIds: [], latestAcceptance: null, deliveryEvidence: emptyDeliveryEvidence(), updatedAt: evolution.updatedAt,
    };
  }
  if (operation.kind === "unavailable") {
    return {
      topicId: operation.topicId, proposalId: operation.proposalId, status: "not-run", title: "当前专题读取受阻",
      summary: operation.message, repairContent: "", remaining: operation.message, waitingFor: "当前专题状态", nextAction: "重新读取当前专题状态后再决定后续操作。", userAction: "none",
      resumeOneShotRunId: null,
      readRecovery: readRecovery("none", "当前专题状态", "重新读取当前专题状态后再决定后续操作。", evolution.updatedAt),
      effectiveTaskIds: [], missingTaskIds: [], latestAcceptance: null, deliveryEvidence: emptyDeliveryEvidence(), updatedAt: evolution.updatedAt,
    };
  }

  // 监控者验收归档记录的是“已经发布并在正式页面完成操作”的独立事实，不是新的代码交付任务。
  // 它明确没有分发计划或任务链，因此不能再套用普通交付的候选、测试、发布门禁，否则完成卡会被误投影成缺少候选。
  const run = evolution.oneShotRun;
  const monitorAcceptanceCompleted = topic?.status === "completed"
    && topic.recoveryPoint === "monitor-formal-acceptance-passed"
    && proposal.status === "completed"
    && proposal.distributionPlan === null
    && proposal.distributedTaskIds.length === 0
    && run?.topicId === topic.topicId
    && run.proposalId === proposal.proposalId
    && run.status === "completed";
  if (monitorAcceptanceCompleted) {
    const occurredAt = run.completedAt || run.updatedAt;
    const latestAcceptance: CurrentTopicAcceptanceOutDto = { runId: run.runId, status: "passed", occurredAt };
    return {
      topicId: topic.topicId, proposalId: proposal.proposalId, status: "completed", title: topic.title,
      summary: proposal.resultSummary || "正式页面验收通过，专题已完成。", repairContent: proposal.content,
      remaining: "", waitingFor: "当前无需操作", nextAction: "可开始下一专题。", userAction: "none",
      resumeOneShotRunId: null,
      readRecovery: readRecovery("none", "当前无需操作", "可开始下一专题。", occurredAt),
      effectiveTaskIds: [], missingTaskIds: [], latestAcceptance,
      deliveryEvidence: { ...emptyDeliveryEvidence(), acceptance: "passed" }, updatedAt: occurredAt,
    };
  }

  const execution = new ProposalExecutionAggregate({ proposal, collaborationTasks: collaboration.tasks }).view();
  const latestAcceptance = readLatestAcceptance(evolution, proposal);
  const task = latestEffectiveTask(execution.effectiveTasks);
  const deliveryEvidence = readDeliveryEvidence(execution.effectiveTasks, collaboration, latestAcceptance);
  const deliveryGate = readDeliveryGate(deliveryEvidence);
  const taskNeedsConfirmation = execution.effectiveTasks.some((item) => item.repairRequiresUserConfirmation === true);
  // 只有原流程已进入真实验收，且开始时间晚于上次结果，才展示新一轮验收中。
  const acceptanceStarted = run?.status === "running" && run.phase === "accepting"
    && (!latestAcceptance || run.updatedAt > latestAcceptance.occurredAt);
  // 完成态后的真实复核仍属于当前专题；运行明确阻塞时不得让旧完成事实覆盖恢复入口。
  const runBlocked = run?.status === "blocked"
    && run.topicId === topic?.topicId
    && run.proposalId === proposal.proposalId;
  const failedAcceptance = latestAcceptance?.status === "failed" || latestAcceptance?.status === "blocked";
  let status: CurrentTopicStageOutDto["status"] = "executing";
  if (awaitingConfirmation || taskNeedsConfirmation) status = "awaiting-confirmation";
  else if (runBlocked) status = "failed-pending-repair";
  else if (acceptanceStarted) status = "accepting";
  else if (failedAcceptance) status = "failed-pending-repair";
  else if (deliveryGate) status = deliveryGate.status;
  else if (deliveryEvidence.acceptance === "passed") status = "completed";
  else if (execution.blocked) status = "failed-pending-repair";
  else if (execution.nextStatus === "verifying") status = "verifying";

  const userAction = status === "awaiting-confirmation" ? "confirmation" : status === "failed-pending-repair" && (taskNeedsConfirmation || runBlocked) ? "resume" : "none";
  const updatedAt = [proposal.updatedAt, task?.updatedAt, latestAcceptance?.occurredAt].filter((item): item is string => Boolean(item)).sort().at(-1) || evolution.updatedAt;
  const waitingFor = stageWaitingFor(status, deliveryGate);
  const nextAction = stageNextAction(status, deliveryGate);

  return {
    topicId: topic?.topicId || proposal.topicId,
    proposalId: proposal.proposalId,
    status,
    title: topic?.title || proposal.title,
    summary: stageSummary(status, execution.summary, latestAcceptance, deliveryGate),
    repairContent: task?.resultSummary?.changes || task?.resultSummary?.solvedProblem || task?.snapshot.confirmedIntent || proposal.content,
    remaining: stageRemaining(status, task, execution.missingTaskIds, deliveryGate),
    waitingFor,
    nextAction,
    userAction,
    // 一次性专题阻塞必须携带原运行标识，Renderer 才能调用已有补验恢复入口；任务级卡点继续保持空值。
    resumeOneShotRunId: userAction === "resume" && runBlocked ? run.runId : null,
    readRecovery: readRecovery(userAction, waitingFor, nextAction, updatedAt),
    effectiveTaskIds: execution.effectiveTasks.map((item) => item.taskId),
    missingTaskIds: execution.missingTaskIds,
    latestAcceptance,
    deliveryEvidence,
    updatedAt,
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

type DeliveryGate = {
  status: CurrentTopicStageOutDto["status"];
  summary: string;
  remaining: string;
  waitingFor: string;
  nextAction: string;
};

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
    return { status: "awaiting-restart-health", summary: "最终候选已发布，缺少重启健康检查结果。", remaining: "缺少重启健康检查结果。", waitingFor: "新版本重启健康检查", nextAction: "完成新版本重启健康检查，并记录结果。" };
  }
  if (evidence.acceptance === "passed") return null;
  if (evidence.acceptance === "running") {
    return { status: "accepting", summary: "韩立已开始本轮结果验收。", remaining: "等待真实验收结果。", waitingFor: "韩立真实验收", nextAction: "等待韩立记录本轮真实验收结果。" };
  }
  return { status: "pending-acceptance", summary: "最终候选已完成测试、发布和重启健康检查，缺少真实验收结果。", remaining: "缺少真实验收结果。", waitingFor: "韩立真实验收", nextAction: "韩立按真实路径验收最终候选，并记录结果。" };
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

function stageSummary(status: CurrentTopicStageOutDto["status"], executionSummary: string, acceptance: CurrentTopicAcceptanceOutDto | null, deliveryGate: DeliveryGate | null): string {
  if (deliveryGate?.status === status) return deliveryGate.summary;
  if (status === "failed-pending-repair") return acceptance ? `最新真实验收 ${acceptance.runId} 未通过，等待按原恢复点处理。` : executionSummary;
  if (status === "pending-acceptance") return "当前有效任务已经完成，等待韩立选择适用的结果验收方式。";
  if (status === "awaiting-release") return "最终候选已通过完整测试，等待发布结果。";
  if (status === "awaiting-restart-health") return "最终候选已发布，等待重启健康检查。";
  if (status === "accepting") return "韩立已开始本轮结果验收。";
  if (status === "completed") return "韩立结果验收已经通过，专题已完成。";
  return executionSummary;
}

function stageWaitingFor(status: CurrentTopicStageOutDto["status"], deliveryGate: DeliveryGate | null): string {
  if (deliveryGate?.status === status) return deliveryGate.waitingFor;
  // 专题已经完成时不再虚构处理中处理人，卡片只说明当前无需操作。
  if (status === "completed") return "当前无需操作";
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

/** 读取恢复只复用档案投影已经声明的用户操作，不因 Renderer 的本地重试次数升级权限。 */
function readRecovery(userAction: CurrentTopicStageOutDto["userAction"], waitingFor: string, nextAction: string, updatedAt: string): CurrentTopicStageOutDto["readRecovery"] {
  const requiresUserAction = userAction !== "none";
  return {
    policyId: `${updatedAt}:${userAction}`,
    waitingFor: requiresUserAction ? waitingFor : "当前交付投影",
    requiresUserAction,
    nextAction: requiresUserAction ? `${nextAction} 完成后重新读取当前交付投影。` : "系统将自动重新读取当前交付投影；读取成功后再显示当前结论。",
  };
}
