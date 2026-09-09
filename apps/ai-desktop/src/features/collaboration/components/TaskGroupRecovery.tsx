/**
 * 任务协作群中专题级别的恢复入口。
 * 只有当前专题原运行确实暂停或阻塞时才显示，不为历史专题创建第二条恢复线路。
 */

import type {
  // 时间线专题：提供专题、提案和等待节点标识。
  CollaborationTimelineGroupOutDto,
} from "../../../../contracts/system/desktop/index";
import type {
  // 演化控制器：读取原运行卡点并执行恢复操作。
  useEvolutionRuntime,
} from "../../evolution";

type TaskGroupRecoveryProps = {
  /** 当前正在渲染的时间线专题。 */
  group: CollaborationTimelineGroupOutDto;
  /** 专题演化状态及恢复操作。 */
  evolution: ReturnType<typeof useEvolutionRuntime>;
};

/** 仅为当前专题原运行提供唯一恢复入口。 */
export function TaskGroupRecovery({ group, evolution }: TaskGroupRecoveryProps) {
  // 客户操作卡点已经在具体节点提供按钮时，专题顶部不能再显示重复入口。
  const hasCustomerActionNode = group.nodes.some((node) => {
    return node.eventType === "customer.action_required" && node.status === "waiting";
  });
  if (hasCustomerActionNode) return null;

  const evolutionState = evolution.state;
  const oneShotRun = evolutionState?.oneShotRun;
  if (!oneShotRun?.proposalId) return null;

  const belongsToCurrentGroup = oneShotRun.topicId === group.topicId
    && oneShotRun.proposalId === group.proposalId;
  if (!belongsToCurrentGroup) return null;

  const proposal = evolutionState.proposals.find((item) => item.proposalId === oneShotRun.proposalId);
  const recoveryPending = evolution.resumingRunId === oneShotRun.runId;
  const recoveryFeedback = evolution.resumeFeedback?.runId === oneShotRun.runId
    ? evolution.resumeFeedback
    : null;

  const runCanResume = oneShotRun.status !== "completed"
    && (oneShotRun.status === "blocked" || evolutionState.automationRuntime.status === "paused");
  const resumableProposalStates = [
    "supplement-required",
    "rejected",
    "blocked",
    "pending-acceptance",
    "executing",
    "verifying",
  ];
  const proposalCanResume = proposal && resumableProposalStates.includes(proposal.status);
  const showResumeButton = Boolean(runCanResume && proposalCanResume);

  if (!showResumeButton && !recoveryPending && !recoveryFeedback) return null;

  /** 继续同一个一次性运行，不创建新的专题或提案。 */
  const resumeOriginalRun = () => {
    void evolution.resumeOneShot(oneShotRun.runId);
  };

  return (
    <div className="task-group-recovery">
      {(showResumeButton || recoveryPending) && (
        <button
          type="button"
          className="task-recovery-continue"
          disabled={recoveryPending}
          onClick={resumeOriginalRun}
        >
          {recoveryPending ? "恢复中…" : "从卡点继续"}
        </button>
      )}
      {recoveryPending && <p role="status">正在恢复原任务，请勿重复操作。</p>}
      {!recoveryPending && recoveryFeedback && (
        <p role={recoveryFeedback.error ? "alert" : "status"}>{recoveryFeedback.message}</p>
      )}
      {!recoveryPending && !recoveryFeedback && oneShotRun.blockingReason && (
        <p>{oneShotRun.blockingReason}</p>
      )}
    </div>
  );
}
