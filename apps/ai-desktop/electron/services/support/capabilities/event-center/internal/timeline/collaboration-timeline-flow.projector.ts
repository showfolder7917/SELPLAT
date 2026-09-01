import type {
  CollaborationFlowEventOutDto,
  CollaborationParticipantSnapshotOutDto,
  CollaborationTaskOutDto,
  CollaborationTimelineGroupOutDto,
  CollaborationTimelineNodeOutDto,
} from "../../../../../../../contracts/services/workflow/index.js";

const NANGONG: CollaborationParticipantSnapshotOutDto = { memberId: "nangong-wan", displayName: "南宫婉" };
const LINGHU: CollaborationParticipantSnapshotOutDto = { memberId: "linghu-ancestor", displayName: "令狐老祖" };
const SYSTEM: CollaborationParticipantSnapshotOutDto = { memberId: "system", displayName: "系统" };
const EXECUTION_POOL: CollaborationParticipantSnapshotOutDto = { memberId: "execution-pool", displayName: "执行池" };

export type ProjectedTimelineFact = Omit<CollaborationTimelineNodeOutDto, "durationMs" | "taskId"> & {
  sourceSuffix: string;
};

export interface CollaborationFlowProjection {
  facts: ProjectedTimelineFact[];
  topicStatus: CollaborationTimelineGroupOutDto["status"];
}

/**
 * 把旧版已经落库为 `unmapped` 的 task.submitted 节点追加为终态纠正事实。
 *
 * 真实传参示例：旧节点仍为 current、任务已有 executor.assigned 时，返回同 nodeId 的 completed 事实。
 * 真实返回示例：页面折叠后只保留“任务已分发”，耗时截止到执行人接收时间。
 * 异常或副作用示例：尚未分配执行人时仍返回 waiting，不伪造完成时间；原始数据库事实保持不变。
 */
export function projectLegacySubmittedFlowCorrection(
  task: CollaborationTaskOutDto,
  event: CollaborationFlowEventOutDto,
  initiator: CollaborationParticipantSnapshotOutDto,
): CollaborationFlowProjection | null {
  if (event.type !== "task.submitted") return null;
  const assigned = task.flowEvents.find((candidate) => candidate.type === "executor.assigned" && candidate.occurredAt >= event.occurredAt);
  const recipient = assigned?.actor || task.originalExecutor || task.executionRecords.at(0)?.executor || EXECUTION_POOL;
  return projection("running", [{
    nodeId: `unmapped:${task.taskId}:${event.eventId}`, eventType: event.type,
    contentRole: "task-content", detailRole: "task-breakdown", kind: "distribution", actor: event.actor || initiator,
    recipients: [recipient], status: assigned ? "completed" : "waiting",
    action: assigned ? "任务已分发" : "等待分配执行人", summary: assigned?.summary || event.summary,
    content: task.snapshot.confirmedIntent, detail: task.snapshot.problemStatement, startedAt: event.occurredAt,
    completedAt: assigned?.occurredAt || null, automaticOpen: !assigned, manualApprovalProposalId: null,
    sourceSuffix: "",
  }]);
}

/**
 * 将 Coordinator 的类型化流程事件转换为页面可读事实，Repository 只负责持久化。
 *
 * 真实传参示例：`task.submitted` 先返回等待分配节点，`executor.assigned` 再结束该节点并开启技术分析。
 * 真实返回示例：执行人接收任务后，分发节点包含真实接收人和固定处理时长，不再继续计时。
 * 异常或副作用示例：历史数据中的未知事件会生成可读兜底节点，不会静默丢失，也不会修改任务快照。
 */
export function projectCollaborationFlowEvent(
  task: CollaborationTaskOutDto,
  event: CollaborationFlowEventOutDto,
  initiator: CollaborationParticipantSnapshotOutDto,
): CollaborationFlowProjection {
  const actor = event.actor || SYSTEM;
  const assignment = assignmentAt(task, actor.memberId, event.occurredAt);
  const assignmentKey = assignment?.assignmentId || `${actor.memberId}:${event.eventId}`;
  const ids = {
    analysis: `analysis:${task.taskId}:${assignmentKey}`,
    execution: `execution:${task.taskId}:${assignmentKey}`,
    verification: `verification:${task.taskId}:${assignmentKey}`,
  };
  const fact = (
    input: Omit<ProjectedTimelineFact, "sourceSuffix" | "eventType" | "contentRole" | "detailRole">
      & Partial<Pick<ProjectedTimelineFact, "eventType" | "contentRole" | "detailRole">>,
    sourceSuffix = "",
  ): ProjectedTimelineFact => ({ ...timelineSemantics(input.kind), ...input, eventType: input.eventType || event.type, sourceSuffix });

  if (event.type === "task.submitted") {
    const recipient = task.originalExecutor || task.executionRecords.at(0)?.executor || EXECUTION_POOL;
    return projection("running", [fact({
      nodeId: `distribution:${task.taskId}`, kind: "distribution", actor: event.actor || initiator, recipients: [recipient],
      status: "waiting", action: "等待分配执行人", summary: event.summary, content: task.snapshot.confirmedIntent,
      detail: task.snapshot.problemStatement, startedAt: event.occurredAt, completedAt: null,
      automaticOpen: true, manualApprovalProposalId: null,
    })]);
  }

  if (event.type === "executor.assigned" || event.type === "executor.reassigned") {
    const facts = [fact({
      nodeId: ids.analysis, kind: "analysis", actor, recipients: [initiator], status: "current", action: "当前正在技术分析",
      summary: event.summary, content: "", detail: [...task.snapshot.constraints, ...task.snapshot.acceptanceCriteria].join("\n"),
      startedAt: event.occurredAt, completedAt: null, automaticOpen: true, manualApprovalProposalId: null,
    })];
    if (event.type === "executor.assigned") facts.unshift(fact({
      nodeId: `distribution:${task.taskId}`, kind: "distribution", actor: initiator, recipients: [actor], status: "completed",
      action: "任务已分发", summary: event.summary, content: task.snapshot.confirmedIntent, detail: task.snapshot.problemStatement,
      startedAt: task.startedAt, completedAt: event.occurredAt, automaticOpen: false, manualApprovalProposalId: null,
    }, ":distribution-completed"));
    if (event.type === "executor.reassigned") facts.unshift(fact({
      nodeId: `return-from-repair:${task.taskId}:${assignmentKey}`, kind: "distribution", actor: NANGONG, recipients: [actor], status: "completed",
      action: "修复后任务已重新交回", summary: event.summary, content: event.details?.repairResult || task.repairResult || event.summary,
      detail: event.details?.failureSummary || task.repairFailureReason || "", startedAt: event.occurredAt, completedAt: event.occurredAt,
      automaticOpen: false, manualApprovalProposalId: null,
    }, ":repair-returned"));
    return projection("running", facts);
  }

  if (event.type === "technical_analysis.ready") return projection("running", [fact({
    nodeId: ids.analysis, kind: "analysis", actor, recipients: [initiator], status: "completed", action: "技术分析完成",
    summary: event.summary, content: task.plans.find((plan) => plan.ownerMemberId === actor.memberId)?.text || event.summary,
    detail: [...task.snapshot.constraints, ...task.snapshot.acceptanceCriteria].join("\n"), startedAt: assignment?.assignedAt || event.occurredAt,
    completedAt: event.occurredAt, automaticOpen: false, manualApprovalProposalId: null,
  })]);

  if (event.type === "execution.started") return projection("running", [fact({
    nodeId: ids.execution, kind: "execution", actor, recipients: [initiator], status: "current", action: "当前正在执行",
    summary: event.summary, content: "", detail: "", startedAt: event.occurredAt, completedAt: null,
    automaticOpen: true, manualApprovalProposalId: null,
  })]);

  if (event.type.startsWith("worker.phase.")) {
    const phase = event.type.slice("worker.phase.".length);
    if (phase === "verifying") return projection("verifying", [
      fact({
        nodeId: ids.verification, kind: "verification", actor, recipients: [initiator], status: "current", action: "当前正在执行人自检",
        summary: event.summary, content: "", detail: (assignment?.changedFiles || []).join("\n"), startedAt: event.occurredAt,
        completedAt: null, automaticOpen: true, manualApprovalProposalId: null,
      }),
      fact({
        nodeId: ids.execution, kind: "execution", actor, recipients: [initiator], status: "completed", action: "执行完成",
        summary: event.summary, content: assignment?.result || event.summary, detail: (assignment?.changedFiles || []).join("\n"),
        startedAt: assignment?.executionStartedAt || assignment?.assignedAt || event.occurredAt, completedAt: event.occurredAt,
        automaticOpen: false, manualApprovalProposalId: null,
      }, ":execution-completed"),
    ]);
    if (phase === "analyzing" || phase === "planning") return projection("running", [fact({
      nodeId: ids.analysis, kind: "analysis", actor, recipients: [initiator], status: "current",
      action: phase === "planning" ? "正在整理技术方案" : "当前正在技术分析", summary: event.summary, content: "",
      detail: [...task.snapshot.constraints, ...task.snapshot.acceptanceCriteria].join("\n"), startedAt: assignment?.assignedAt || event.occurredAt,
      completedAt: null, automaticOpen: true, manualApprovalProposalId: null,
    })]);
    const phaseFailed = phase === "blocked" || phase === "failed";
    return projection(phaseFailed ? "blocked" : "running", [fact({
      nodeId: ids.execution, kind: "execution", actor, recipients: [initiator], status: phaseFailed ? "failed" : "current",
      action: phaseFailed ? "执行遇到阻塞" : phase === "finalizing" ? "正在整理执行结果" : "当前正在执行",
      summary: event.summary, content: assignment?.result || "", detail: task.blockingReason || (assignment?.changedFiles || []).join("\n"),
      startedAt: assignment?.executionStartedAt || assignment?.assignedAt || event.occurredAt,
      completedAt: phaseFailed ? event.occurredAt : null, automaticOpen: true, manualApprovalProposalId: null,
    })]);
  }

  if (event.type === "task.code_verified") {
    const facts = [fact({
      nodeId: ids.execution, kind: "execution", actor, recipients: [initiator], status: "completed", action: "执行完成",
      summary: event.summary, content: assignment?.result || task.finalResult || event.summary,
      detail: (assignment?.changedFiles || []).join("\n"),
      startedAt: assignment?.executionStartedAt || assignment?.assignedAt || task.startedAt, completedAt: event.occurredAt,
      automaticOpen: false, manualApprovalProposalId: null,
    }, ":execution-completed"), fact({
      nodeId: ids.verification, kind: "verification", actor, recipients: [initiator], status: "completed", action: "执行人自检完成",
      summary: event.summary, content: task.finalResult || event.summary,
      detail: task.resultSummary?.changes || (assignment?.changedFiles || []).join("\n"),
      startedAt: assignment?.executionStartedAt || task.startedAt, completedAt: event.occurredAt,
      automaticOpen: false, manualApprovalProposalId: null,
    })];
    if (task.evolutionProposalId) facts.push(fact({
      nodeId: `return:${task.taskId}`, kind: "result", actor, recipients: [NANGONG], status: "completed", action: "执行与自检结果已返回",
      summary: event.summary, content: task.finalResult || event.summary, detail: task.resultSummary?.changes || "",
      startedAt: event.occurredAt, completedAt: event.occurredAt, automaticOpen: false, manualApprovalProposalId: null,
    }, ":returned-to-nangong"));
    return projection("running", facts);
  }

  if (event.type === "evolution.task_collected") return projection("running", [fact({
    nodeId: `collection:${task.evolutionRoundId || task.taskId}`, kind: "result", actor: NANGONG, recipients: [LINGHU], status: "completed",
    action: "提交统一测试", summary: "南宫婉已汇总完整执行结果并提交令狐老祖统一测试。", content: event.summary,
    detail: task.finalResult || "", startedAt: event.occurredAt, completedAt: event.occurredAt,
    automaticOpen: false, manualApprovalProposalId: null,
  })]);

  if (event.type === "integration.candidate_preparation_failed") {
    const presentation = integrationFailurePresentation(task, true);
    return projection("blocked", [fact({
      nodeId: `integration-preparation:${task.taskId}:${task.integrationGeneration || 0}`, kind: "verification", actor,
      recipients: [NANGONG], status: "failed", action: "统一测试准备失败",
      summary: presentation.summary, content: presentation.impact, detail: presentation.detail,
      startedAt: priorEventAt(task, "integration.batch_frozen") || event.occurredAt, completedAt: event.occurredAt,
      automaticOpen: true, manualApprovalProposalId: null,
    })]);
  }
  if (event.type === "integration.infrastructure_failed") {
    const presentation = integrationFailurePresentation(task, false);
    return projection("blocked", [fact({
      nodeId: `integration-infrastructure:${task.taskId}:${task.integrationGeneration || 0}`, kind: "verification", actor,
      recipients: [NANGONG], status: "waiting", action: "发布基础设施故障",
      summary: presentation.summary, content: presentation.impact, detail: presentation.detail,
      startedAt: priorEventAt(task, "unified_test.started") || event.occurredAt, completedAt: event.occurredAt,
      automaticOpen: true, manualApprovalProposalId: null,
    })]);
  }

  if (event.type === "unified_test.started" || event.type === "unified_test.passed" || event.type === "unified_test.failed") {
    const failed = event.type === "unified_test.failed";
    const completed = event.type === "unified_test.passed";
    const preparationFailure = failed && isCandidatePreparationFailure(task);
    const presentation = failed ? integrationFailurePresentation(task, preparationFailure) : null;
    const facts = [fact({
      nodeId: `unified-test:${task.taskId}:${task.integrationGeneration || 0}`, kind: "verification", actor, recipients: [NANGONG],
      status: failed ? "failed" : completed ? "completed" : "current",
      action: preparationFailure ? "统一测试准备失败" : failed ? "统一测试未通过" : completed ? "统一测试通过" : "当前正在统一测试",
      summary: presentation?.summary || event.summary, content: presentation?.impact || event.summary,
      detail: presentation?.detail || task.integrationFailure?.detail || "",
      startedAt: task.unifiedTest?.startedAt || event.occurredAt, completedAt: event.type === "unified_test.started" ? null : event.occurredAt,
      automaticOpen: !completed, manualApprovalProposalId: null,
    })];
    if (event.type === "unified_test.started") facts.unshift(fact({
      nodeId: `integration-queue:${task.taskId}:${task.integrationGeneration || 0}`, kind: "verification", actor: NANGONG,
      recipients: [LINGHU], status: "completed", action: "令狐老祖已接手统一测试", summary: event.summary,
      content: event.summary, detail: "", startedAt: priorEventAt(task, "integration.batch_frozen") || event.occurredAt,
      completedAt: event.occurredAt, automaticOpen: false, manualApprovalProposalId: null,
    }, ":queue-completed"));
    return projection(failed ? "blocked" : completed ? "running" : "verifying", facts);
  }

  if (event.type.startsWith("unified_test.repair_") || event.type.startsWith("execution.repair_")) {
    const status = event.status === "failed" ? "failed" : event.status === "completed" ? "completed" : event.status === "waiting" ? "waiting" : "current";
    const started = repairStartedEvent(task, event);
    const investigationNodeId = `repair-investigation:${task.taskId}:${started?.eventId || event.eventId}`;
    const executionNodeId = `repair-execution:${task.taskId}:${started?.eventId || event.eventId}`;
    const facts: ProjectedTimelineFact[] = [];
    if (event.type.endsWith("repair_started")) {
      const previous = latestOriginalExecution(task, event.occurredAt);
      if (previous) facts.unshift(fact({
        nodeId: `execution:${task.taskId}:${previous.assignmentId}`, kind: "execution", actor: previous.executor, recipients: [initiator], status: "failed",
        action: "执行已结束并转交修复", summary: event.details?.failureSummary || task.repairFailureReason || task.blockingReason || event.summary,
        content: previous.result || "原执行已停止，未继续与令狐同时计时。", detail: repairDetail(event, task),
        startedAt: previous.executionStartedAt || previous.assignedAt, completedAt: event.occurredAt, automaticOpen: true, manualApprovalProposalId: null,
      }, ":original-execution-closed"));
      facts.splice(facts.length - 1, 0, fact({
        nodeId: `repair-handoff:${task.taskId}:${event.eventId}`, kind: "distribution", actor: initiator, recipients: [event.actor || LINGHU], status: "completed",
        action: "执行故障已转交修复", summary: event.details?.failureSummary || event.summary,
        content: event.details?.failureSummary || event.summary, detail: repairDetail(event, task), startedAt: event.occurredAt,
        completedAt: event.occurredAt, automaticOpen: false, manualApprovalProposalId: null,
      }, ":failure-handoff"));
      facts.push(fact({
        nodeId: investigationNodeId, kind: "analysis", actor: event.actor || LINGHU, recipients: [initiator], status: "current",
        action: "当前正在调查故障", summary: event.summary, content: event.summary, detail: repairDetail(event, task),
        startedAt: event.occurredAt, completedAt: null, automaticOpen: true, manualApprovalProposalId: null,
      }));
    }
    if (event.type.endsWith("repair_investigated")) facts.push(fact({
      nodeId: investigationNodeId, kind: "analysis", actor: event.actor || LINGHU, recipients: [initiator], status: "completed",
      action: "故障调查完成", summary: event.summary, content: event.details?.repairDiagnosis || event.summary,
      detail: repairDetail(event, task), startedAt: started?.occurredAt || event.occurredAt, completedAt: event.occurredAt,
      automaticOpen: false, manualApprovalProposalId: null,
    }, ":investigation-completed"), fact({
      nodeId: executionNodeId, kind: "repair", actor: event.actor || LINGHU, recipients: [initiator], status: "current",
      action: "当前正在修复", summary: event.summary, content: event.details?.repairDiagnosis || event.summary,
      detail: repairDetail(event, task), startedAt: event.occurredAt, completedAt: null,
      automaticOpen: true, manualApprovalProposalId: null,
    }, ":repair-started"));
    if (!event.type.endsWith("repair_started") && !event.type.endsWith("repair_investigated")) facts.push(fact({
      nodeId: executionNodeId, kind: "repair", actor: event.actor || LINGHU, recipients: [initiator], status,
      action: status === "failed" ? "修复未完成" : status === "completed" ? "修复完成" : /授权/.test(event.summary) ? "等待用户授权" : "等待恢复条件",
      summary: event.summary, content: event.details?.repairResult || event.summary, detail: repairDetail(event, task),
      startedAt: task.flowEvents.find((candidate) => candidate.type.endsWith("repair_investigated") && candidate.occurredAt >= (started?.occurredAt || ""))?.occurredAt || started?.occurredAt || event.occurredAt,
      completedAt: status === "completed" || status === "failed" ? event.occurredAt : null,
      automaticOpen: status !== "completed", manualApprovalProposalId: null,
    }));
    if (event.type.endsWith("repair_completed")) facts.push(fact({
      nodeId: `repair-result:${task.taskId}:${event.eventId}`, kind: "result", actor: event.actor || LINGHU, recipients: [initiator], status: "completed",
      action: "修复结果已返回", summary: event.summary, content: event.details?.repairResult || task.repairResult || event.summary,
      detail: repairDetail(event, task), startedAt: event.occurredAt, completedAt: event.occurredAt,
      automaticOpen: false, manualApprovalProposalId: null,
    }, ":result-returned"));
    return projection(status === "failed" || status === "waiting" ? "blocked" : "running", facts);
  }

  if (event.type === "integration.local_change_ownership_blocked" || event.type === "integration.merge_conflict") {
    const ownership = event.type === "integration.local_change_ownership_blocked";
    return projection("blocked", [fact({
      nodeId: `integration-blocked:${task.taskId}:${task.integrationGeneration || 0}:${event.type}`, kind: "repair",
      actor: event.actor || LINGHU, recipients: [initiator], status: "waiting",
      action: ownership ? "等待确认本地修改归属" : "等待修正合并冲突", summary: event.summary, content: event.summary,
      detail: task.integrationFailure?.detail || task.blockingReason || event.summary, startedAt: event.occurredAt,
      completedAt: null, automaticOpen: true, manualApprovalProposalId: null,
    })]);
  }

  if (event.type === "integration.batch_frozen") return projection("running", [fact({
    nodeId: `integration-queue:${task.taskId}:${task.integrationGeneration || 0}`, kind: "verification", actor: NANGONG,
    recipients: [LINGHU], status: "waiting", action: "等待令狐老祖统一测试", summary: event.summary,
    content: event.summary, detail: "", startedAt: event.occurredAt, completedAt: null, automaticOpen: true, manualApprovalProposalId: null,
  })]);

  if (event.type === "integration.local_changes_transferred") return projection("running", [fact({
    nodeId: `integration-transfer:${task.taskId}:${task.integrationGeneration || 0}`, kind: "result", actor,
    recipients: [LINGHU], status: "completed", action: "本地修改已归入任务", summary: event.summary, content: event.summary,
    detail: task.versionWorkspace?.resultSha || "", startedAt: event.occurredAt, completedAt: event.occurredAt,
    automaticOpen: false, manualApprovalProposalId: null,
  })]);

  if (event.type === "release.restart_healthy") return projection("completed", [fact({
    nodeId: `acceptance:${task.taskId}:${task.integrationGeneration || 0}`, kind: "result", actor, recipients: [NANGONG], status: "completed",
    action: "发布验收完成", summary: event.summary, content: event.summary, detail: task.finalResult || "",
    startedAt: event.occurredAt, completedAt: event.occurredAt, automaticOpen: false, manualApprovalProposalId: null,
  })]);

  if (event.type === "task.blocked") {
    const facts = [fact({
      nodeId: `blocked:${event.eventId}`, kind: "repair", actor, recipients: [initiator], status: "failed", action: "处理未完成",
      summary: event.summary, content: event.summary, detail: task.blockingReason || "", startedAt: event.occurredAt,
      completedAt: event.occurredAt, automaticOpen: true, manualApprovalProposalId: null,
    })];
    if (assignment) facts.push(fact({
      nodeId: ids.execution, kind: "execution", actor: assignment.executor, recipients: [initiator], status: "failed", action: "处理未完成",
      summary: event.summary, content: assignment.result || event.summary, detail: task.blockingReason || assignment.blockingReason || "",
      startedAt: assignment.executionStartedAt || assignment.assignedAt, completedAt: event.occurredAt,
      automaticOpen: true, manualApprovalProposalId: null,
    }, ":execution-failed"));
    return projection("blocked", facts);
  }

  if (event.type === "task.cancelled") return projection("cancelled", [fact({
    nodeId: `cancelled:${task.taskId}`, kind: "result", actor, recipients: [initiator], status: "failed", action: "任务已取消",
    summary: event.summary, content: event.summary, detail: task.blockingReason || "", startedAt: event.occurredAt,
    completedAt: event.occurredAt, automaticOpen: true, manualApprovalProposalId: null,
  })]);

  if (event.type === "task.interrupted" || event.type === "task.recovery_requested" || event.type === "integration.conflict_correction_requested" || event.type === "unified_test.retry_requested") {
    const waiting = event.type === "task.interrupted";
    const facts = [fact({
      nodeId: `recovery:${task.taskId}:${task.taskRevision}:${event.eventId}`, kind: "repair", actor, recipients: [initiator],
      status: waiting ? "waiting" : "current",
      action: waiting ? "等待恢复任务" : event.type === "unified_test.retry_requested" ? "准备重新统一测试" : event.type === "integration.conflict_correction_requested" ? "正在修正合并冲突" : "正在恢复任务",
      summary: event.summary, content: event.summary, detail: task.blockingReason || "", startedAt: event.occurredAt,
      completedAt: null, automaticOpen: true, manualApprovalProposalId: null,
    })];
    if (!waiting && (
      task.integrationFailure?.kind === "local-change-ownership"
      || task.integrationFailure?.kind === "merge-conflict"
    )) {
      const ownership = task.integrationFailure?.kind === "local-change-ownership";
      const blockedType = ownership ? "integration.local_change_ownership_blocked" : "integration.merge_conflict";
      facts.unshift(fact({
        nodeId: `integration-blocked:${task.taskId}:${task.integrationGeneration || 0}:${blockedType}`, kind: "repair",
        actor, recipients: [initiator], status: "completed", action: ownership ? "本地修改归属已确认" : "合并冲突已转入修正",
        summary: event.summary, content: event.summary, detail: task.integrationFailure.detail,
        startedAt: priorEventAt(task, blockedType) || task.integrationFailure.occurredAt, completedAt: event.occurredAt,
        automaticOpen: false, manualApprovalProposalId: null,
      }, ":integration-blocker-completed"));
    }
    return projection(waiting ? "blocked" : "running", facts);
  }

  // 历史数据库可能包含新版本尚未登记的事件。必须保留事实，避免页面再次出现“停住但没有原因”。
  const fallbackStatus = event.status === "completed" ? "completed" : event.status === "waiting" ? "waiting" : event.status === "failed" || event.status === "cancelled" ? "failed" : "current";
  const fallbackKind = event.stage === "analysis" ? "analysis" : event.stage === "integration" ? "verification" : event.stage === "recovery" ? "repair" : event.stage === "execution" ? "execution" : "result";
  return projection(fallbackStatus === "failed" || fallbackStatus === "waiting" ? "blocked" : "running", [fact({
    nodeId: `unmapped:${task.taskId}:${event.eventId}`, kind: fallbackKind, actor, recipients: [initiator], status: fallbackStatus,
    action: fallbackStatus === "waiting" ? "等待后续处理" : fallbackStatus === "failed" ? "流程处理失败" : fallbackStatus === "completed" ? "流程步骤完成" : "流程处理中",
    summary: event.summary, content: event.summary, detail: `事件类型：${String(event.type)}`, startedAt: event.occurredAt,
    completedAt: fallbackStatus === "completed" || fallbackStatus === "failed" ? event.occurredAt : null,
    automaticOpen: fallbackStatus !== "completed", manualApprovalProposalId: null,
  })]);
}

function isCandidatePreparationFailure(task: CollaborationTaskOutDto): boolean {
  const failure = task.integrationFailure;
  return failure?.kind === "candidate-branch-conflict"
    || failure?.phase === "preparation"
    || /发布候选分支\s+\S+\s+已存在|禁止覆盖同一批次证据/.test(failure?.detail || "");
}

function integrationFailurePresentation(task: CollaborationTaskOutDto, preparation: boolean): { summary: string; impact: string; detail: string } {
  const failure = task.integrationFailure;
  const evidence = failure?.detail || task.blockingReason || "未记录技术证据";
  const summary = failure?.summary || (preparation ? "发布候选批次冲突，统一测试尚未启动" : "统一测试发现未通过项，已转入修复");
  const impact = failure?.impact || (preparation
    ? "候选分支创建阶段被阻断，本批次尚未运行统一测试命令，不能记作测试用例未通过。"
    : "候选版本已经开始统一测试，验证命令返回失败，本批次暂不能发布。");
  const recoveryAction = failure?.recoveryAction || (preparation
    ? "保留既有发布证据，分配新的集成代次或清理确认无用的冲突候选后重新准备测试。"
    : "令狐老祖根据失败证据修复后重新执行统一测试。原始失败不会被隐藏或覆盖。");
  return { summary, impact, detail: `技术证据：${evidence}\n恢复动作：${recoveryAction}` };
}

function projection(topicStatus: CollaborationTimelineGroupOutDto["status"], facts: ProjectedTimelineFact[]): CollaborationFlowProjection {
  return { facts, topicStatus };
}

/** 类型字段只由流程事件和节点职责决定，禁止根据可变 action 文案反推详情含义。 */
function timelineSemantics(kind: CollaborationTimelineNodeOutDto["kind"]): Pick<ProjectedTimelineFact, "contentRole" | "detailRole"> {
  if (kind === "distribution") return { contentRole: "task-content", detailRole: "task-breakdown" };
  if (kind === "analysis") return { contentRole: "analysis-output", detailRole: "acceptance-criteria" };
  if (kind === "execution") return { contentRole: "execution-output", detailRole: "changed-files" };
  if (kind === "verification") return { contentRole: "verification-output", detailRole: "verification-evidence" };
  if (kind === "repair") return { contentRole: "repair-output", detailRole: "recovery-conditions" };
  if (kind === "result") return { contentRole: "result-output", detailRole: "result-evidence" };
  if (kind === "approval-application") return { contentRole: "approval-content", detailRole: "application-evidence" };
  return { contentRole: "approval-reason", detailRole: "approval-scope" };
}

function assignmentAt(task: CollaborationTaskOutDto, memberId: string, occurredAt: string): CollaborationTaskOutDto["executionRecords"][number] | null {
  return [...task.executionRecords].reverse().find((record) => record.executor.memberId === memberId && record.assignedAt <= occurredAt) || null;
}

function priorEventAt(task: CollaborationTaskOutDto, type: string): string | null {
  return [...task.flowEvents].reverse().find((event) => event.type === type)?.occurredAt || null;
}

function repairStartedEvent(task: CollaborationTaskOutDto, event: CollaborationFlowEventOutDto): CollaborationFlowEventOutDto | null {
  const prefix = event.type.startsWith("unified_test.") ? "unified_test.repair_" : "execution.repair_";
  return [...task.flowEvents].reverse().find((candidate) => candidate.occurredAt <= event.occurredAt && candidate.type === `${prefix}started`) || null;
}

function latestOriginalExecution(task: CollaborationTaskOutDto, occurredAt: string): CollaborationTaskOutDto["executionRecords"][number] | null {
  return [...task.executionRecords].reverse().find((record) => record.assignedAt <= occurredAt && record.executor.memberId !== LINGHU.memberId) || null;
}

function repairDetail(event: CollaborationFlowEventOutDto, task: CollaborationTaskOutDto): string {
  const evidence = event.details?.technicalEvidence?.filter(Boolean) || [];
  return [event.details?.failureSummary, ...evidence, task.integrationFailure?.detail, task.repairFailureReason].filter(Boolean).join("\n");
}
