import type {
  CollaborationParticipantSnapshot,
  CollaborationState,
  CollaborationTask,
  CollaborationTimelineGroup,
  CollaborationTimelineNode,
  CollaborationTimelineSnapshot,
} from "../../../contracts/collaboration/collaboration.js";
import type { EvolutionApproval, EvolutionProposal, NangongEvolutionState } from "../../../contracts/collaboration/nangong-evolution.js";

const HAN_LI: CollaborationParticipantSnapshot = { memberId: "han-li", displayName: "韩立" };
const SYSTEM: CollaborationParticipantSnapshot = { memberId: "system", displayName: "系统" };
const TERMINAL_STATES = new Set<CollaborationTask["state"]>(["integrated", "cancelled"]);

/**
 * 生成任务协作群唯一时间线读模型。
 * 传参示例：buildCollaborationTimeline(collaborationState, evolutionState, now)。
 * 返回示例：version=1 且 groups 按最新更新时间倒序，每组内部 nodes 按 startedAt 正序。
 * 异常或副作用：纯函数不写状态；缺失旧数据会降级为系统人物和可确认摘要，不抛出原始路径或日志。
 */
export function buildCollaborationTimeline(
  collaboration: CollaborationState,
  evolution: NangongEvolutionState,
  now = new Date().toISOString(),
): CollaborationTimelineSnapshot {
  const tasksById = new Map(collaboration.tasks.map((task) => [task.taskId, task]));
  const groupedTaskIds = new Set<string>();
  const groups: CollaborationTimelineGroup[] = [];

  for (const topic of evolution.topics) {
    const proposals = evolution.proposals.filter((proposal) => proposal.topicId === topic.topicId).sort(compareCreatedAt);
    if (!proposals.length) continue;
    const taskIds = proposals.flatMap((proposal) => proposal.distributedTaskIds);
    taskIds.forEach((taskId) => groupedTaskIds.add(taskId));
    const tasks = taskIds.map((taskId) => tasksById.get(taskId)).filter((task): task is CollaborationTask => Boolean(task));
    groups.push(buildTopicGroup(topic.topicId, topic.title, proposals, tasks, evolution, now));
  }

  // 非专题协作任务仍进入独立任务卡，保证新接口接管后旧任务不会从页面消失。
  for (const task of collaboration.tasks.filter((candidate) => !groupedTaskIds.has(candidate.taskId))) {
    groups.push(buildStandaloneGroup(task, now));
  }

  groups.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  return { version: 1, groups, updatedAt: latestTimestamp(groups.map((group) => group.updatedAt), now) };
}

function buildTopicGroup(
  topicId: string,
  title: string,
  proposals: EvolutionProposal[],
  tasks: CollaborationTask[],
  evolution: NangongEvolutionState,
  now: string,
): CollaborationTimelineGroup {
  const nodes: CollaborationTimelineNode[] = [];
  const latestProposal = proposals.at(-1)!;
  for (const proposal of proposals) {
    const submitter = participant(proposal.submitterMemberId, proposal.submitterDisplayName);
    const automaticApprovalEnabled = proposal.origin === "linghu" ? evolution.automaticLinghuApprovalEnabled : evolution.automaticNangongApprovalEnabled;
    const waitingForManualApproval = proposal === latestProposal && proposal.status === "pending-approval" && !automaticApprovalEnabled;
    nodes.push({
      nodeId: `proposal:${proposal.proposalId}`,
      taskId: null,
      kind: "approval-application",
      actor: submitter,
      recipients: [HAN_LI],
      status: waitingForManualApproval ? "current" : "completed",
      action: proposal.supersedesProposalId ? "补充后再次申请" : "审批申请",
      summary: proposal.content,
      content: proposal.content,
      detail: proposal.evidence.join("\n"),
      startedAt: proposal.createdAt,
      completedAt: waitingForManualApproval ? null : proposal.updatedAt,
      durationMs: durationMs(proposal.createdAt, waitingForManualApproval ? now : proposal.updatedAt),
      automaticOpen: waitingForManualApproval,
      manualApprovalProposalId: waitingForManualApproval ? proposal.proposalId : null,
    });
    for (const approval of proposal.approvals) nodes.push(approvalNode(approval, submitter));
    if (proposal.distributedTaskIds.length) {
      const recipients = tasks
        .filter((task) => proposal.distributedTaskIds.includes(task.taskId))
        .map(taskRecipient)
        .filter(uniqueParticipant);
      nodes.push({
        nodeId: `distribution:${proposal.proposalId}`,
        taskId: null,
        kind: "distribution",
        actor: submitter,
        recipients,
        status: "completed",
        action: "任务分发",
        summary: proposal.distributionPlan?.summary || proposal.content,
        content: distributionContent(proposal, proposals),
        detail: proposal.distributionPlan?.units.map((unit) => `${unit.title}：${unit.scope}`).join("\n") || "",
        startedAt: proposal.updatedAt,
        completedAt: proposal.updatedAt,
        durationMs: 0,
        automaticOpen: false,
        manualApprovalProposalId: null,
      });
    }
  }
  nodes.push(...tasks.flatMap((task) => taskNodes(task, now)));
  nodes.sort((left, right) => left.startedAt.localeCompare(right.startedAt));
  return groupFromNodes(`topic:${topicId}`, topicId, latestProposal.proposalId, title, nodes, now);
}

function buildStandaloneGroup(task: CollaborationTask, now: string): CollaborationTimelineGroup {
  const nodes = taskNodes(task, now);
  return groupFromNodes(`task:${task.taskId}`, null, null, task.snapshot.title, nodes, now);
}

function groupFromNodes(
  groupId: string,
  topicId: string | null,
  proposalId: string | null,
  title: string,
  nodes: CollaborationTimelineNode[],
  now: string,
): CollaborationTimelineGroup {
  const executingCount = nodes.filter((node) => node.kind === "execution" && node.status === "current").length;
  const verifyingCount = nodes.filter((node) => node.kind === "verification" && node.status === "current").length;
  const waitingCount = nodes.filter((node) => node.status === "waiting" || node.kind === "approval-application" && node.status === "current").length;
  const completedCount = nodes.filter((node) => node.status === "completed").length;
  const startedAt = latestTimestamp(nodes.map((node) => node.startedAt).sort().slice(0, 1), now);
  const updatedAt = latestTimestamp(nodes.map((node) => node.completedAt || node.startedAt), now);
  const lastNode = nodes.at(-1);
  const status = nodes.some((node) => node.kind === "approval-application" && node.status === "current")
      ? "waiting-approval"
      : executingCount > 0
        ? "running"
        : verifyingCount > 0
          ? "verifying"
          : lastNode?.status === "failed"
            ? "blocked"
          : nodes.length > 0 && nodes.every((node) => node.status === "completed" || node.kind === "approval-decision")
            ? "completed"
            : "running";
  const active = nodes.find((node) => node.status === "current" || node.status === "failed");
  return {
    groupId,
    topicId,
    proposalId,
    title,
    status,
    summary: active?.summary || nodes.at(-1)?.summary || "等待任务事实",
    nodes,
    executingCount,
    verifyingCount,
    waitingCount,
    completedCount,
    startedAt,
    updatedAt,
    durationMs: durationMs(startedAt, status === "completed" ? updatedAt : now),
    nextStep: nextStep(status, nodes),
  };
}

function approvalNode(approval: EvolutionApproval, submitter: CollaborationParticipantSnapshot): CollaborationTimelineNode {
  const approved = approval.decision === "approved";
  return {
    nodeId: `approval:${approval.approvalId}`,
    taskId: null,
    kind: "approval-decision",
    actor: participant(approval.approverMemberId, approval.approverDisplayName),
    recipients: [submitter],
    status: approved ? "completed" : "failed",
    action: approved ? "审批通过" : "审批未通过",
    summary: approval.advice,
    content: approval.advice,
    detail: approval.capabilityScope || "",
    startedAt: approval.createdAt,
    completedAt: approval.createdAt,
    durationMs: 0,
    automaticOpen: false,
    manualApprovalProposalId: null,
  };
}

function taskNodes(task: CollaborationTask, now: string): CollaborationTimelineNode[] {
  const analysisNodes = task.plans.map((plan) => analysisNode(task, plan));
  if (!task.executionRecords.length) return [...analysisNodes, taskNode(task, undefined, true, now)];
  // 验证和问题修复是新的时间线事实，不能把上一位执行人的正文原位改写掉。
  const hasFollowingStage = task.phase === "verifying" || task.state === "unified-testing" || task.state === "awaiting-restart" || task.state === "repairing-execution";
  const executionNodes = task.executionRecords.map((record, index) => taskNode(task, record, index === task.executionRecords.length - 1 && !hasFollowingStage, now));
  if (!hasFollowingStage) return [...analysisNodes, ...executionNodes];
  const latestRecord = task.executionRecords.at(-1);
  const currentStage = taskNode(task, latestRecord, true, now);
  const terminal = TERMINAL_STATES.has(task.state);
  return [...analysisNodes, ...executionNodes, {
    ...currentStage,
    nodeId: `${currentStage.nodeId}:${task.state === "repairing-execution" ? "repair" : "verification"}`,
    kind: task.state === "repairing-execution" ? "repair" : "verification",
    status: terminal ? "completed" : "current",
    action: task.state === "repairing-execution" ? "当前正在修复" : "当前正在验证",
    completedAt: terminal ? task.completedAt || task.updatedAt : null,
    automaticOpen: !terminal,
  }];
}

function analysisNode(task: CollaborationTask, plan: CollaborationTask["plans"][number]): CollaborationTimelineNode {
  const startedAt = task.startedAt || task.createdAt;
  return {
    nodeId: `analysis:${task.taskId}:${plan.version}`,
    taskId: task.taskId,
    kind: "analysis",
    actor: participant(plan.ownerMemberId, plan.ownerDisplayName),
    recipients: task.initiator ? [task.initiator] : [],
    status: "completed",
    action: "技术分析",
    summary: plan.text,
    content: plan.text,
    detail: [...task.snapshot.constraints, ...task.snapshot.acceptanceCriteria].join("\n"),
    startedAt,
    completedAt: plan.createdAt,
    durationMs: durationMs(startedAt, plan.createdAt),
    automaticOpen: false,
    manualApprovalProposalId: null,
  };
}

function taskNode(task: CollaborationTask, record: CollaborationTask["executionRecords"][number] | undefined, latest: boolean, now: string): CollaborationTimelineNode {
  const actor = latest ? task.currentHandler || record?.executor || task.originalExecutor || task.initiator || SYSTEM : record?.executor || SYSTEM;
  const initiator = task.initiator || participant("nangong-wan", "南宫婉");
  const verifying = latest && (task.phase === "verifying" || task.state === "unified-testing" || task.state === "awaiting-restart");
  const failed = latest && (task.state === "blocked" || task.state === "test-failed") || record?.status === "blocked";
  const completed = !latest || TERMINAL_STATES.has(task.state) || record?.status === "code-verified" || record?.status === "transferred" || task.state === "returned-to-nangong" || task.state === "ready-for-integration";
  const waiting = latest && (task.state === "queued-executor" || task.state === "preparing-worktree" || record?.status === "assigned");
  const status: CollaborationTimelineNode["status"] = failed ? "failed" : completed ? "completed" : waiting ? "waiting" : "current";
  const startedAt = record?.executionStartedAt || record?.assignedAt || task.startedAt;
  const completedAt = completed ? record?.completedAt || task.codeVerifiedAt || task.completedAt || task.updatedAt : null;
  return {
    nodeId: `task:${task.taskId}:${record?.assignmentId || task.taskRevision}`,
    taskId: task.taskId,
    kind: latest && task.state === "repairing-execution" ? "repair" : verifying ? "verification" : record?.status === "analyzing" || latest && task.state === "analyzing" ? "analysis" : "execution",
    actor,
    recipients: actor.memberId === initiator.memberId ? [] : [initiator],
    status,
    action: failed ? "处理失败" : verifying ? "当前正在验证" : waiting ? "等待接手" : completed ? "执行完成" : "当前正在执行",
    summary: taskSummary(task, record, latest),
    content: record?.result || task.finalResult || task.snapshot.confirmedIntent,
    detail: task.flowEvents.map((event) => `${event.summary}`).join("\n"),
    startedAt,
    completedAt,
    durationMs: durationMs(startedAt, completedAt || now),
    automaticOpen: latest && (status === "current" || status === "failed"),
    manualApprovalProposalId: null,
  };
}

function taskRecipient(task: CollaborationTask): CollaborationParticipantSnapshot {
  return task.currentHandler || task.executionRecords.at(-1)?.executor || task.originalExecutor || participant(task.preferredExecutorMemberId || "pending", "等待分配");
}

function taskSummary(task: CollaborationTask, record: CollaborationTask["executionRecords"][number] | undefined, latest: boolean): string {
  if (latest && task.blockingReason) return task.blockingReason;
  if (record?.result) return record.result;
  const latestEventSummary = task.flowEvents.at(-1)?.summary;
  return latestEventSummary || task.snapshot.confirmedIntent;
}

function distributionContent(proposal: EvolutionProposal, topicProposals: EvolutionProposal[]): string {
  const supplements = proposal.revisionFeedbackApprovalId
    ? topicProposals
      .filter((candidate) => candidate.createdAt < proposal.createdAt)
      .flatMap((candidate) => candidate.approvals)
      .filter((approval) => approval.decision !== "approved" && approval.advice.trim())
      .map((approval) => `审批未通过补充：${approval.advice.trim()}`)
      .join("\n")
    : "";
  const work = proposal.distributionPlan?.units.map((unit) => `${unit.title}：${unit.scope}`).join("\n") || proposal.content;
  return [proposal.content, supplements, work].filter(Boolean).join("\n\n");
}

function nextStep(status: CollaborationTimelineGroup["status"], nodes: CollaborationTimelineNode[]): string {
  if (status === "waiting-approval") return "韩立审批 · 等待中";
  if (status === "blocked") return "问题修复 · 等待恢复";
  if (status === "completed") return "本专题已完成";
  const active = nodes.filter((node) => node.status === "current" || node.status === "waiting");
  return active.length ? `结果汇总与验收 · 等待 ${active.length} 个节点完成` : "结果汇总与验收 · 等待中";
}

function participant(memberId: string, displayName: string): CollaborationParticipantSnapshot {
  return { memberId, displayName };
}

function uniqueParticipant(value: CollaborationParticipantSnapshot, index: number, items: CollaborationParticipantSnapshot[]): boolean {
  return items.findIndex((item) => item.memberId === value.memberId) === index;
}

function compareCreatedAt(left: EvolutionProposal, right: EvolutionProposal): number {
  return left.createdAt.localeCompare(right.createdAt);
}

function durationMs(startedAt: string, endedAt: string): number {
  const start = Date.parse(startedAt);
  const end = Date.parse(endedAt);
  return Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, end - start) : 0;
}

function latestTimestamp(values: string[], fallback: string): string {
  return values.filter(Boolean).sort().at(-1) || fallback;
}
