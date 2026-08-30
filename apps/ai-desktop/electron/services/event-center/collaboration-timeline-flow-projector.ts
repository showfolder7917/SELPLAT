import type {
  CollaborationFlowEvent,
  CollaborationParticipantSnapshot,
  CollaborationTask,
  CollaborationTimelineGroup,
  CollaborationTimelineNode,
} from "../../../contracts/collaboration/collaboration.js";

const NANGONG: CollaborationParticipantSnapshot = { memberId: "nangong-wan", displayName: "南宫婉" };
const LINGHU: CollaborationParticipantSnapshot = { memberId: "linghu-ancestor", displayName: "令狐老祖" };
const SYSTEM: CollaborationParticipantSnapshot = { memberId: "system", displayName: "系统" };

export type ProjectedTimelineFact = Omit<CollaborationTimelineNode, "durationMs" | "taskId"> & {
  sourceSuffix: string;
};

export interface CollaborationFlowProjection {
  facts: ProjectedTimelineFact[];
  topicStatus: CollaborationTimelineGroup["status"];
}

/**
 * 将 Coordinator 的类型化流程事件转换为页面可读事实，Repository 只负责持久化。
 *
 * 真实传参示例：`integration.local_change_ownership_blocked` 返回“等待确认本地修改归属”的等待节点。
 * 真实返回示例：`worker.phase.verifying` 同时结束执行节点并开启独立自检节点。
 * 异常或副作用示例：历史数据中的未知事件会生成可读兜底节点，不会静默丢失，也不会修改任务快照。
 */
export function projectCollaborationFlowEvent(
  task: CollaborationTask,
  event: CollaborationFlowEvent,
  initiator: CollaborationParticipantSnapshot,
): CollaborationFlowProjection {
  const actor = event.actor || SYSTEM;
  const assignment = assignmentAt(task, actor.memberId, event.occurredAt);
  const assignmentKey = assignment?.assignmentId || `${actor.memberId}:${event.eventId}`;
  const ids = {
    analysis: `analysis:${task.taskId}:${assignmentKey}`,
    execution: `execution:${task.taskId}:${assignmentKey}`,
    verification: `verification:${task.taskId}:${assignmentKey}`,
  };
  const fact = (input: Omit<ProjectedTimelineFact, "sourceSuffix">, sourceSuffix = ""): ProjectedTimelineFact => ({ ...input, sourceSuffix });

  if (event.type === "executor.assigned" || event.type === "executor.reassigned") return projection("running", [fact({
    nodeId: ids.analysis, kind: "analysis", actor, recipients: [initiator], status: "current", action: "当前正在技术分析",
    summary: event.summary, content: "", detail: [...task.snapshot.constraints, ...task.snapshot.acceptanceCriteria].join("\n"),
    startedAt: event.occurredAt, completedAt: null, automaticOpen: true, manualApprovalProposalId: null,
  })]);

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

  if (event.type === "unified_test.started" || event.type === "unified_test.passed" || event.type === "unified_test.failed") {
    const failed = event.type === "unified_test.failed";
    const completed = event.type === "unified_test.passed";
    const facts = [fact({
      nodeId: `unified-test:${task.taskId}:${task.integrationGeneration || 0}`, kind: "verification", actor, recipients: [NANGONG],
      status: failed ? "failed" : completed ? "completed" : "current",
      action: failed ? "统一测试未通过" : completed ? "统一测试通过" : "当前正在统一测试",
      summary: event.summary, content: event.summary, detail: task.integrationFailure?.detail || "",
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
    return projection(status === "failed" || status === "waiting" ? "blocked" : "running", [fact({
      nodeId: `repair:${task.taskId}:${task.taskRevision}`, kind: "repair", actor: event.actor || LINGHU, recipients: [initiator], status,
      action: status === "failed" ? "修复未完成" : status === "completed" ? "修复完成" : status === "waiting" && /授权/.test(event.summary) ? "等待用户授权" : status === "waiting" ? "等待恢复条件" : "当前正在修复",
      summary: event.summary, content: event.summary, detail: task.repairFailureReason || task.integrationFailure?.detail || "",
      startedAt: event.occurredAt, completedAt: status === "completed" || status === "failed" ? event.occurredAt : null,
      automaticOpen: status !== "completed", manualApprovalProposalId: null,
    })]);
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

function projection(topicStatus: CollaborationTimelineGroup["status"], facts: ProjectedTimelineFact[]): CollaborationFlowProjection {
  return { facts, topicStatus };
}

function assignmentAt(task: CollaborationTask, memberId: string, occurredAt: string): CollaborationTask["executionRecords"][number] | null {
  return [...task.executionRecords].reverse().find((record) => record.executor.memberId === memberId && record.assignedAt <= occurredAt) || null;
}

function priorEventAt(task: CollaborationTask, type: string): string | null {
  return [...task.flowEvents].reverse().find((event) => event.type === type)?.occurredAt || null;
}
