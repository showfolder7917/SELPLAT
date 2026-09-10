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
    // 只有仍在等待客户操作的节点才算当前有效卡点。
    return node.eventType === "customer.action_required" && node.status === "waiting";
  });
  // 节点已经拥有精确恢复入口时，专题级入口必须隐藏。
  if (hasCustomerActionNode) return null;

  const evolutionState = evolution.state;
  // 演化状态尚未从后端载入时，当前没有可以安全恢复的专题。
  if (!evolutionState) return null;

  // 一次性运行来自已经确认存在的演化状态，后续读取不再携带空值歧义。
  const oneShotRun = evolutionState.oneShotRun;
  // 没有正式提案标识的运行无法与当前专题安全关联。
  if (!oneShotRun?.proposalId) return null;

  // 专题归属同时核对课题和提案，避免把另一专题的恢复按钮显示到当前卡片。
  const belongsToCurrentGroup = oneShotRun.topicId === group.topicId
    && oneShotRun.proposalId === group.proposalId;
  // 当前一次性运行不属于这张专题卡时不显示任何恢复信息。
  if (!belongsToCurrentGroup) return null;

  // 正式提案用于判断当前业务状态是否仍允许恢复。
  const proposal = evolutionState.proposals.find((item) => item.proposalId === oneShotRun.proposalId);
  // 恢复等待状态只匹配当前运行，不能被其他专题的恢复请求污染。
  const recoveryPending = evolution.resumingRunId === oneShotRun.runId;
  // 恢复反馈同样按运行标识归属，确保页面显示正确任务的结果。
  const recoveryFeedback = evolution.resumeFeedback?.runId === oneShotRun.runId
    ? evolution.resumeFeedback
    : null;

  // 原运行只有未完成且处于阻塞或暂停状态时才允许继续。
  const runCanResume = oneShotRun.status !== "completed"
    && (oneShotRun.status === "blocked" || evolutionState.automationRuntime.status === "paused");
  // 可恢复提案状态覆盖等待补充、退回、阻塞和执行验证中的真实卡点。
  const resumableProposalStates = [
    "supplement-required",
    "rejected",
    "blocked",
    "pending-acceptance",
    "executing",
    "verifying",
  ];
  // 提案必须真实存在并处于允许恢复的状态。
  const proposalCanResume = proposal && resumableProposalStates.includes(proposal.status);
  // 恢复按钮要求运行和提案两层状态同时允许继续。
  const showResumeButton = Boolean(runCanResume && proposalCanResume);

  // 没有按钮、等待状态或历史反馈时，专题顶部不保留空恢复区域。
  if (!showResumeButton && !recoveryPending && !recoveryFeedback) return null;

  /** 继续同一个一次性运行，不创建新的专题或提案。 */
  const resumeOriginalRun = () => {
    void evolution.resumeOneShot(oneShotRun.runId);
  };

  return (
    // 专题恢复区域集中显示继续按钮、等待提示、反馈或阻塞原因。
    <div className="task-group-recovery">
      {/* 恢复按钮：可恢复或正在恢复时保持位置稳定，提交后立即禁用。 */}
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
      {/* 恢复等待：明确提示用户不要重复触发同一运行。 */}
      {recoveryPending && <p role="status">正在恢复原任务，请勿重复操作。</p>}
      {/* 恢复反馈：失败使用警告语义，成功使用普通状态语义。 */}
      {!recoveryPending && recoveryFeedback && (
        <p role={recoveryFeedback.error ? "alert" : "status"}>{recoveryFeedback.message}</p>
      )}
      {/* 原始阻塞原因：尚未执行恢复且没有反馈时说明当前为什么停住。 */}
      {!recoveryPending && !recoveryFeedback && oneShotRun.blockingReason && (
        <p>{oneShotRun.blockingReason}</p>
      )}
    </div>
  );
}
