import type { EvolutionStateOutDto } from "../../../../contracts/services/evolution/index.js";
import type { CollaborationStateOutDto } from "../../../../contracts/services/workflow/index.js";
import { ProposalExecutionAggregate } from "./proposal-execution.aggregate.js";

/** 当前专题关联对象是否仍允许审批、分发、恢复或验收的唯一只读结论。 */
export type CurrentTopicOperationDecision = {
  kind: "operable" | "cancelled" | "unavailable";
  message: string;
  topicId: string | null;
  proposalId: string | null;
  cancelledTaskIds: string[];
};

/**
 * 依据专题、提案、运行和协作任务的同一份快照判定可操作性。
 * 页面与所有写入口都只能消费该结论，不能通过旧审批或时间线节点重新推导权限。
 */
export function decideCurrentTopicOperation(
  evolution: EvolutionStateOutDto,
  collaboration: CollaborationStateOutDto,
  reference: { topicId?: string | null; proposalId?: string | null; runId?: string | null },
): CurrentTopicOperationDecision {
  const proposalId = reference.proposalId || evolution.oneShotRun?.proposalId || null;
  const proposal = proposalId ? evolution.proposals.find((item) => item.proposalId === proposalId) || null : null;
  const topicId = reference.topicId || proposal?.topicId || evolution.oneShotRun?.topicId || null;
  const topic = topicId ? evolution.topics.find((item) => item.topicId === topicId) || null : null;
  const run = evolution.oneShotRun || null;

  if (!proposal || !topic || proposal.topicId !== topic.topicId) {
    return unavailable(topicId, proposalId, "当前专题关联无法可信读取，不能从历史记录推导操作。");
  }
  if (reference.runId && (!run || run.runId !== reference.runId || run.topicId !== topic.topicId || run.proposalId !== proposal.proposalId)) {
    return unavailable(topic.topicId, proposal.proposalId, "当前运行关联已经变化，不能恢复历史运行。");
  }

  // 替代链只能以最新有效任务决定可操作性；旧取消任务已被后续修复接管时不能误伤当前链。
  const execution = new ProposalExecutionAggregate({ proposal, collaborationTasks: collaboration.tasks }).view();
  const cancelledTaskIds = execution.effectiveTasks.filter((task) => task.state === "cancelled").map((task) => task.taskId);
  if (cancelledTaskIds.length > 0) {
    return {
      kind: "cancelled",
      message: "本专题已取消。已取消任务及其旧提案、旧运行和旧审批链仅保留历史，不能重新推进。",
      topicId: topic.topicId,
      proposalId: proposal.proposalId,
      cancelledTaskIds,
    };
  }
  if (topic.status === "rejected" || proposal.status === "rejected") {
    return unavailable(topic.topicId, proposal.proposalId, "当前专题已经退出可操作状态，不能从历史记录重新推进。");
  }
  return { kind: "operable", message: "当前专题可继续沿有效原步骤处理。", topicId: topic.topicId, proposalId: proposal.proposalId, cancelledTaskIds: [] };
}

function unavailable(topicId: string | null, proposalId: string | null, message: string): CurrentTopicOperationDecision {
  return { kind: "unavailable", message, topicId, proposalId, cancelledTaskIds: [] };
}
