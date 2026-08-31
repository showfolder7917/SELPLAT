import type { EvolutionWorkbenchChangeEvent, EvolutionWorkbenchView, EvolutionState } from "../../../../contracts/collaboration/evolution/index.js";

/**
 * 把专题前后状态整理为工作台轻量增量事件，不承担持久化或业务推进。
 * 真实传参示例：buildEvolutionWorkbenchChange(previous, current, "proposal.decided", "topic-1", "proposal-1")。
 * 真实返回示例：返回包含前后版本、负责人、下一步和受影响视图的 EvolutionWorkbenchChangeEvent。
 * 异常或副作用示例：纯函数没有写入副作用；缺少关联实体时降级为会话或自动化事件，不改变原始状态。
 */
export function buildEvolutionWorkbenchChange(
  previous: EvolutionState,
  current: EvolutionState,
  reason: string,
  topicId: string | null,
  proposalId: string | null,
): EvolutionWorkbenchChangeEvent {
  const proposal = proposalId ? current.proposals.find((item) => item.proposalId === proposalId) || null : null;
  const previousProposal = proposalId ? previous.proposals.find((item) => item.proposalId === proposalId) || null : null;
  const resolvedTopicId = topicId || proposal?.topicId || previousProposal?.topicId || null;
  const topic = resolvedTopicId ? current.topics.find((item) => item.topicId === resolvedTopicId) || null : null;
  const previousTopic = resolvedTopicId ? previous.topics.find((item) => item.topicId === resolvedTopicId) || null : null;
  const deliberation = reason.startsWith("deliberation.")
    ? (topic?.deliberationId ? current.deliberations.find((item) => item.deliberationId === topic.deliberationId) : current.deliberations.at(-1)) || null
    : null;
  const previousDeliberation = deliberation ? previous.deliberations.find((item) => item.deliberationId === deliberation.deliberationId) || null : null;
  const automationChange = reason.startsWith("automation.");
  const cleared = reason === "test-data.cleared";
  const conversationChange = reason.startsWith("conversation.");
  const entityType: EvolutionWorkbenchChangeEvent["entityType"] = cleared
    ? "workspace"
    : proposal || previousProposal
      ? "proposal"
      : deliberation || previousDeliberation
        ? "deliberation"
        : topic || previousTopic
          ? "topic"
          : automationChange
            ? "automation"
            : "conversation";
  const currentState = entityType === "proposal" ? proposal?.status || null
    : entityType === "deliberation" ? deliberation?.status || null
      : entityType === "topic" ? topic?.status || null
        : entityType === "automation" ? current.automationRuntime.status : null;
  const previousEntityState = entityType === "proposal" ? previousProposal?.status || null
    : entityType === "deliberation" ? previousDeliberation?.status || null
      : entityType === "topic" ? previousTopic?.status || null
        : entityType === "automation" ? previous.automationRuntime.status : null;
  const origin = proposal?.origin || topic?.origin || "nangong";
  const owner = currentState === "pending-approval"
    ? "韩立"
    : ["executing", "verifying", "pending-acceptance"].includes(currentState || "")
      ? "协同调度"
      : origin === "linghu" ? "令狐老祖" : "南宫婉";
  const affectedViews: EvolutionWorkbenchView[] = cleared
    ? ["topics", "deliberations", "pending-approvals", "approvals", "proposals", "tasks", "releases", "archives", "automation-runs", "recovery", "exceptions"]
    : proposal || previousProposal
      ? ["topics", "pending-approvals", "approvals", "proposals", "tasks", "releases", "archives", "recovery", "exceptions"]
      : deliberation || previousDeliberation
        ? ["topics", "deliberations", "archives"]
        : topic || previousTopic
          ? ["topics", "archives", "automation-runs"]
          : automationChange
            ? ["automation-runs", "recovery", "exceptions"]
            : [];
  const nextAction = currentState === "pending-approval" ? "韩立审批方向"
    : currentState === "approved" ? "南宫婉分发任务"
      : currentState === "blocked" ? "从恢复点继续或交给令狐修正"
        : currentState === "pending-acceptance" ? "韩立验收执行结果"
          : currentState === "completed" ? "归档并进入下一轮演化"
            : currentState ? "继续当前演化环节" : null;
  return {
    entityType,
    entityId: proposal?.proposalId || previousProposal?.proposalId || deliberation?.deliberationId || previousDeliberation?.deliberationId || topic?.topicId || previousTopic?.topicId || (cleared ? "evolution-workbench" : conversationChange ? current.conversation.conversationId : "evolution-automation"),
    topicId: resolvedTopicId,
    proposalId,
    reason,
    previousState: previousEntityState,
    currentState,
    currentStage: currentState ? (currentState === "pending-approval" ? "审批" : currentState === "approved" ? "分发" : currentState === "executing" ? "执行" : currentState === "verifying" || currentState === "pending-acceptance" ? "验收" : currentState === "completed" ? "归档" : "调查") : null,
    currentOwner: currentState ? owner : null,
    blockingReason: currentState === "blocked" ? current.automationRuntime.stopReason || "等待统一检测确认卡点" : null,
    nextAction,
    previousStateVersion: previous.updatedAt,
    stateVersion: current.updatedAt,
    updatedAt: current.updatedAt,
    affectedViews,
  };
}
