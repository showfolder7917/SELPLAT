import type { CurrentTopicAcceptanceOutDto, CurrentTopicStageOutDto, EvolutionStateOutDto } from "../../../../contracts/services/evolution/index.js";
import { isCompleteCustomerActionGuidance } from "../../../../contracts/services/workflow/index.js";
import type { ProposalExecutionAggregate } from "./proposal-execution.aggregate.js";
import { readCurrentTopicRecovery } from "./current-topic-read-recovery.js";

type Proposal = EvolutionStateOutDto["proposals"][number];
type Topic = EvolutionStateOutDto["topics"][number] | null;
type Execution = ReturnType<ProposalExecutionAggregate["view"]>;

/** 技术恢复仅在仍属于当前故障时占据当前卡片；过期记录保留在审计中。 */
export function projectCurrentTechnicalRecovery(input: {
  evolution: EvolutionStateOutDto;
  proposal: Proposal;
  topic: Topic;
  execution: Execution;
  latestAcceptance: CurrentTopicAcceptanceOutDto | null;
  hostStartupAcceptance: CurrentTopicStageOutDto["hostStartupAcceptance"];
  /** 已形成的当前候选交付事实；恢复状态不得清空它。 */
  deliveryEvidence: CurrentTopicStageOutDto["deliveryEvidence"];
}): CurrentTopicStageOutDto | null {
  const { evolution, proposal, topic, execution, latestAcceptance, hostStartupAcceptance, deliveryEvidence } = input;
  const recovery = evolution.technicalRecovery;
  const run = evolution.oneShotRun;
  const topicId = topic?.topicId || proposal.topicId;
  if (!recovery?.active || recovery.topicId !== topicId || recovery.proposalId !== proposal.proposalId) return null;

  const blockingTasks = execution.effectiveTasks.filter((item) => item.evolutionProposalId === proposal.proposalId
    && ["blocked", "test-failed"].includes(item.state));
  const blockingTask = blockingTasks[0] || null;
  const newestOccurrence = [...recovery.occurrences].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0];
  // 专题级恢复档案不自动属于任意新阻塞任务。只有当前任务正是故障发生时的任务，
  // 且此后没有更新的失败事实，才能把旧档案的原因和下一步投影到当前卡片。
  if (blockingTask && newestOccurrence?.taskId !== blockingTask.taskId) return null;
  const guidance = blockingTask?.customerActionGuidance || null;
  const guidanceEvent = blockingTask?.flowEvents.filter((event) => event.type === "customer.action_required"
    && event.details?.customerActionGuidance?.guidanceId === guidance?.guidanceId
    && event.details?.customerActionGuidance?.sourceFingerprint === guidance?.sourceFingerprint)
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0];
  // 令狐的任务卡点指纹与专题验收指纹属于不同故障域。较新的客户指导只需绑定
  // 原修复任务、当前结构化失败和持久化指导事件，不能拿专题指纹否定任务入口。
  const taskGuidanceComplete = blockingTask?.state === "blocked"
    && blockingTask.integrationFailure?.kind === "local-change-ownership"
    && Boolean(guidanceEvent)
    && isCompleteCustomerActionGuidance(guidance, guidance?.sourceFingerprint, {
      affectedFiles: blockingTask.integrationFailure.conflictFiles || [], nonFileRecovery: null,
    });
  const latestTaskFailure = blockingTask?.flowEvents.filter((event) => event.error || event.status === "failed")
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0];
  if (latestTaskFailure && newestOccurrence && latestTaskFailure.occurredAt > newestOccurrence.occurredAt
    && (!taskGuidanceComplete || !guidanceEvent || guidanceEvent.occurredAt < latestTaskFailure.occurredAt)) return null;
  if (guidance && guidance.sourceFingerprint !== recovery.faultFingerprint && !taskGuidanceComplete) return null;
  // 验收故障指纹包含真实验收运行标识。新一轮验收已落档时，旧指纹和旧发生时间
  // 不能再为当前页面提供 failureReason、nextAction 或任务确认入口。
  const acceptanceFingerprint = recovery.faultFingerprint?.includes(":run_hanli_result_acceptance:") === true;
  const recoveryOccurredAt = newestOccurrence?.occurredAt || recovery.updatedAt;
  const obsoleteAcceptanceRecovery = latestAcceptance !== null
    && (acceptanceFingerprint
      ? !recovery.faultFingerprint!.endsWith(`:${latestAcceptance.runId}`)
      : recoveryOccurredAt < latestAcceptance.occurredAt);
  if (obsoleteAcceptanceRecovery && (!taskGuidanceComplete || !guidanceEvent
    || guidanceEvent.occurredAt <= latestAcceptance!.occurredAt)) return null;

  const hasCompleteGuidance = taskGuidanceComplete || isCompleteCustomerActionGuidance(guidance, recovery.faultFingerprint, {
    affectedFiles: blockingTask?.integrationFailure?.conflictFiles || [], nonFileRecovery: null,
  });
  // 系统未派发修复、没有活动任务时开放原运行复验；复验一旦开始，旧恢复只供审计。
  const systemOnlyAcceptanceRetry = recovery.handler === "system" && recovery.handoffStatus === "pending"
    && recovery.failureCategory === "acceptance-capability-blocked" && latestAcceptance?.status === "failed"
    && run?.status === "blocked" && run.topicId === topicId && run.proposalId === proposal.proposalId
    && blockingTask === null
    && !execution.effectiveTasks.some((item) => item.evolutionProposalId === proposal.proposalId
      && !["integrated", "cancelled", "failed"].includes(item.state));
  const resumedAcceptance = run?.status === "running" && run.phase === "accepting"
    && run.topicId === topicId && run.proposalId === proposal.proposalId
    && (!latestAcceptance || run.updatedAt > latestAcceptance.occurredAt) && blockingTask === null;
  if (resumedAcceptance || systemOnlyAcceptanceRetry) return null;

  const resumeTaskId = hasCompleteGuidance ? blockingTask!.taskId : null;
  const monitoring = recovery.handoffStatus === "monitoring";
  const unverified = recovery.handoffStatus === "basis-unverified";
  const failed = recovery.handoffStatus === "failed";
  const summary = monitoring ? `监控接管复验：同一技术问题已保留 ${recovery.attemptCount} 轮证据。`
    : unverified ? "次数依据尚未核验。" : failed ? "令狐转交未完成。" : "令狐老祖处理中。";
  const waitingFor = monitoring ? "监控接管复验" : unverified || failed ? "系统恢复处理" : "令狐老祖";
  const nextAction = recovery.nextAction;
  return {
    topicId, proposalId: proposal.proposalId, status: "failed-pending-repair", title: topic?.title || proposal.title,
    summary, repairContent: proposal.content,
    remaining: taskGuidanceComplete ? blockingTask!.blockingReason || guidance!.problem
      : recovery.failureReason || recovery.occurrences.at(-1)?.reason || "没有待处理技术卡点。",
    waitingFor: resumeTaskId ? "用户确认后由令狐复查" : waitingFor,
    nextAction: taskGuidanceComplete ? "完成文件归属处理后，从原任务卡点继续，由令狐复查。" : nextAction,
    userAction: resumeTaskId ? "resume" : "none", resumeOneShotRunId: null,
    resumeTaskId,
    customerActionGuidance: resumeTaskId && guidance ? {
      affectedFiles: [...(guidance.affectedFiles || [])], problem: guidance.problem,
      reasonCustomerMustAct: guidance.reasonCustomerMustAct, steps: [...guidance.steps],
      completionCriteria: [...guidance.completionCriteria], resumeLabel: guidance.resumeLabel,
    } : null,
    readRecovery: readCurrentTopicRecovery(resumeTaskId ? "resume" : "none", resumeTaskId ? "用户确认后由令狐复查" : waitingFor, nextAction, recovery.updatedAt),
    effectiveTaskIds: [...new Set([...recovery.occurrences.map((item) => item.taskId).filter((item): item is string => Boolean(item)), ...blockingTasks.map((item) => item.taskId)])],
    missingTaskIds: [], latestAcceptance, hostStartupAcceptance,
    // 恢复只改变当前处理状态；候选、统一测试、发布和重启健康仍来自最近已交付任务。
    deliveryEvidence,
    updatedAt: recovery.updatedAt,
  };
}
