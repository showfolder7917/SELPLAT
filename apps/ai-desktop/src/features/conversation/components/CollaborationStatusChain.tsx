import { ArrowClockwise24Regular } from "@fluentui/react-icons";

import { fixedUiText } from "../../../../contracts/foundation";
import type { CollaborationTaskOutDto, LocaleValue } from "../../../../contracts/system/desktop/index";
import { collaborationTaskStateLabel } from "../../collaboration";
import { MarkdownMessage } from "./MarkdownMessage";

export function CollaborationStatusChain({ task, locale, onRetry }: { task: CollaborationTaskOutDto; locale: LocaleValue; onRetry(taskId: string): Promise<void> }) {
  const stages = ["analysis", "execution", "recovery", "integration"] as const;
  const stageLabels = { analysis: fixedUiText(locale, "conversationStageAnalysis"), execution: fixedUiText(locale, "conversationStageExecution"), recovery: fixedUiText(locale, "conversationStageRecovery"), integration: fixedUiText(locale, "conversationStageIntegration") };
  const latestByStage = new Map(stages.map((stage) => [stage, [...task.flowEvents].reverse().find((event) => event.stage === stage)]));
  const handler = task.currentHandler?.displayName || task.originalExecutor?.displayName || task.initiator?.displayName || fixedUiText(locale, "conversationSystem");
  const retryLabel = task.state === "test-failed" ? fixedUiText(locale, "conversationRetryTest") : fixedUiText(locale, "conversationContinue");
  const retryable = ["test-failed", "blocked", "recovering"].includes(task.state);
  return <section className={`collaboration-status-chain ${task.blockingReason ? "has-blocker" : ""}`} aria-live="polite">
    <header><strong>{fixedUiText(locale, "conversationCollaborationStatus")}</strong><span>{handler} · {collaborationTaskStateLabel(task.state, locale)}</span></header>
    <ol>{stages.map((stage) => { const event = latestByStage.get(stage); if (!event && stage !== "analysis") return null; return <li key={stage} className={event?.error ? "failed" : event?.status === "completed" ? "completed" : "active"}><i /><span><strong>{stageLabels[stage]}</strong><small>{event?.summary || fixedUiText(locale, "conversationWaitingHandler")}</small></span></li>; })}</ol>
    {task.blockingReason && <p role="status"><strong>{fixedUiText(locale, "conversationBlockedReason")}</strong>{task.blockingReason}</p>}
    <details className="collaboration-status-task-details"><summary>{fixedUiText(locale, "conversationTaskDetails").replace("{name}", task.initiator?.displayName || fixedUiText(locale, "conversationSystem"))}</summary><div><MarkdownMessage text={task.snapshot.confirmedIntent} /></div></details>
    <footer><span>{fixedUiText(locale, "conversationCurrentHandler")}：<strong>{handler}</strong></span>{retryable && <button type="button" onClick={() => void onRetry(task.taskId)}><ArrowClockwise24Regular />{retryLabel}</button>}</footer>
  </section>;
}
