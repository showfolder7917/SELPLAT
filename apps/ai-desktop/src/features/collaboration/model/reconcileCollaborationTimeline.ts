import type {
  CollaborationTimelineGroupOutDto,
  CollaborationTimelineNodeOutDto,
  CollaborationTimelineSnapshotOutDto,
} from "../../../../contracts/system/desktop/index";

/**
 * 时间线每次从主进程读取都会反序列化成新对象。这里复用内容未变化的节点和专题，
 * 让 React.memo 能跳过已经完成的长历史，只更新真正发生变化的当前节点。
 */
export function reconcileCollaborationTimeline(
  previous: CollaborationTimelineSnapshotOutDto | null,
  incoming: CollaborationTimelineSnapshotOutDto,
): CollaborationTimelineSnapshotOutDto {
  if (!previous) return incoming;

  const previousGroups = new Map(previous.groups.map((group) => [group.groupId, group]));
  const groups = incoming.groups.map((group) => reconcileGroup(previousGroups.get(group.groupId), group));
  const sameGroups = groups.length === previous.groups.length
    && groups.every((group, index) => group === previous.groups[index]);

  return sameGroups && incoming.version === previous.version && incoming.updatedAt === previous.updatedAt
    ? previous
    : { ...incoming, groups };
}

/** 把按通知读取的专题替换进最近成功快照；未受影响卡片保持原内容与顺序。 */
export function reconcileChangedCollaborationTimeline(
  previous: CollaborationTimelineSnapshotOutDto | null,
  incoming: CollaborationTimelineSnapshotOutDto,
  changedGroupIds: string[],
): CollaborationTimelineSnapshotOutDto {
  if (!previous) return incoming;
  const changed = new Set(changedGroupIds);
  const replacement = new Map(incoming.groups.map((group) => [group.groupId, group]));
  const groups = previous.groups.map((group) => changed.has(group.groupId) ? replacement.get(group.groupId) || group : group);
  for (const group of incoming.groups) if (!previous.groups.some((current) => current.groupId === group.groupId)) groups.push(group);
  return { version: 1, groups, updatedAt: incoming.updatedAt };
}

/**
 * 启动全量读取尚未完成时，变更事件已经取得了指定专题的新快照。
 * 初始快照可能早于该事件，不能用其中的旧专题覆盖已经收到的变更；其余专题仍由全量快照补齐。
 */
export function reconcileInitialCollaborationTimeline(
  previous: CollaborationTimelineSnapshotOutDto | null,
  incoming: CollaborationTimelineSnapshotOutDto,
  changedGroupIdsDuringRead: ReadonlySet<string>,
): CollaborationTimelineSnapshotOutDto {
  if (!previous || changedGroupIdsDuringRead.size === 0) return reconcileCollaborationTimeline(previous, incoming);

  const previousGroups = new Map(previous.groups.map((group) => [group.groupId, group]));
  const incomingGroupIds = new Set(incoming.groups.map((group) => group.groupId));
  const groups = incoming.groups.map((group) => {
    const previousGroup = previousGroups.get(group.groupId);
    if (changedGroupIdsDuringRead.has(group.groupId) && previousGroup) return previousGroup;
    return reconcileGroup(previousGroup, group);
  });
  for (const group of previous.groups) {
    if (changedGroupIdsDuringRead.has(group.groupId) && !incomingGroupIds.has(group.groupId)) groups.push(group);
  }
  return { ...incoming, groups };
}

function reconcileGroup(
  previous: CollaborationTimelineGroupOutDto | undefined,
  incoming: CollaborationTimelineGroupOutDto,
): CollaborationTimelineGroupOutDto {
  if (!previous) return incoming;

  const previousNodes = new Map(previous.nodes.map((node) => [node.nodeId, node]));
  const reconciledNodes = incoming.nodes.map((node) => {
    const candidate = previousNodes.get(node.nodeId);
    return candidate && sameNode(candidate, node) ? candidate : node;
  });
  const nodes = reconciledNodes.length === previous.nodes.length
    && reconciledNodes.every((node, index) => node === previous.nodes[index])
    ? previous.nodes
    : reconciledNodes;

  return nodes === previous.nodes && sameGroup(previous, incoming) ? previous : { ...incoming, nodes };
}

function sameNode(left: CollaborationTimelineNodeOutDto, right: CollaborationTimelineNodeOutDto): boolean {
  return left.nodeId === right.nodeId
    && left.taskId === right.taskId
    && left.eventType === right.eventType
    && left.kind === right.kind
    && sameParticipant(left.actor, right.actor)
    && sameParticipants(left.recipients, right.recipients)
    && left.status === right.status
    && left.action === right.action
    && left.summary === right.summary
    && left.contentRole === right.contentRole
    && left.content === right.content
    && left.detailRole === right.detailRole
    && left.detail === right.detail
    && left.startedAt === right.startedAt
    && left.completedAt === right.completedAt
    && (left.completedAt === null || left.durationMs === right.durationMs)
    && left.automaticOpen === right.automaticOpen
    && left.manualApprovalProposalId === right.manualApprovalProposalId;
}

function sameGroup(left: CollaborationTimelineGroupOutDto, right: CollaborationTimelineGroupOutDto): boolean {
  const running = !["completed", "cancelled"].includes(right.status);
  return left.groupId === right.groupId
    && left.topicId === right.topicId
    && left.proposalId === right.proposalId
    && left.title === right.title
    && left.status === right.status
    && left.summary === right.summary
    && left.executingCount === right.executingCount
    && left.verifyingCount === right.verifyingCount
    && left.waitingCount === right.waitingCount
    && left.completedCount === right.completedCount
    && left.startedAt === right.startedAt
    && left.updatedAt === right.updatedAt
    && (running || left.durationMs === right.durationMs)
    && left.nextStep === right.nextStep
    && left.failureNextStep === right.failureNextStep
    && sameOptionalParticipant(left.nextOwner, right.nextOwner);
}

function sameParticipants(
  left: CollaborationTimelineNodeOutDto["recipients"],
  right: CollaborationTimelineNodeOutDto["recipients"],
): boolean {
  return left.length === right.length && left.every((participant, index) => sameParticipant(participant, right[index]));
}

function sameOptionalParticipant(
  left: CollaborationTimelineGroupOutDto["nextOwner"],
  right: CollaborationTimelineGroupOutDto["nextOwner"],
): boolean {
  // 旧时间线记录可能没有 nextOwner 字段；缺失值与显式 null 都表示“尚无下一负责人”。
  if (left == null || right == null) return left == null && right == null;
  return sameParticipant(left, right);
}

function sameParticipant(
  left: CollaborationTimelineNodeOutDto["actor"],
  right: CollaborationTimelineNodeOutDto["actor"],
): boolean {
  return left.memberId === right.memberId
    && left.displayName === right.displayName;
}
