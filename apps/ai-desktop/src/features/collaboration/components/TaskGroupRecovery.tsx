import type { CollaborationTimelineGroupOutDto } from "../../../../contracts/system/desktop/index";
import type { useEvolutionRuntime } from "../../evolution/model/useEvolutionRuntime";

/** 仅当前专题的原运行提供恢复入口，历史任务和正在推进的运行不显示按钮。 */
export function TaskGroupRecovery({ group, evolution }: { group: CollaborationTimelineGroupOutDto; evolution: ReturnType<typeof useEvolutionRuntime> }) {
  const state = evolution.state;
  const run = state?.oneShotRun;
  if (!run || !run.proposalId || run.topicId !== group.topicId || run.proposalId !== group.proposalId) return null;
  const proposal = state.proposals.find((item) => item.proposalId === run.proposalId);
  const pending = evolution.resumingRunId === run.runId;
  const feedback = evolution.resumeFeedback?.runId === run.runId ? evolution.resumeFeedback : null;
  const resumable = run.status !== "completed" && (run.status === "blocked" || state.automationRuntime.status === "paused")
    && !!proposal && ["supplement-required", "rejected", "blocked", "pending-acceptance", "executing", "verifying"].includes(proposal.status);
  if (!resumable && !pending && !feedback) return null;
  return <div className="task-group-recovery">
    {(resumable || pending) && <button type="button" className="task-recovery-continue" disabled={pending} onClick={() => void evolution.resumeOneShot(run.runId)}>{pending ? "恢复中…" : "从卡点继续"}</button>}
    {pending && <p role="status">正在恢复原任务，请勿重复操作。</p>}
    {!pending && feedback && <p role={feedback.error ? "alert" : "status"}>{feedback.message}</p>}
    {!pending && !feedback && run.blockingReason && <p>{run.blockingReason}</p>}
  </div>;
}
