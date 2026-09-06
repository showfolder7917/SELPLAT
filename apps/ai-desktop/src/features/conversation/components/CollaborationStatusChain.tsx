import { ArrowClockwise24Regular } from "@fluentui/react-icons";

import type { CollaborationTaskOutDto, LocaleValue } from "../../../../contracts/system/desktop/index";
import { collaborationTaskStateLabel } from "../../collaboration";
import { MarkdownMessage } from "./MarkdownMessage";

export function CollaborationStatusChain({ task, locale, onRetry }: { task: CollaborationTaskOutDto; locale: LocaleValue; onRetry(taskId: string): Promise<void> }) {
  const stages = ["analysis", "execution", "recovery", "integration"] as const;
  const stageLabels = locale === "ja"
    ? { analysis: "技術分析", execution: "実行", recovery: "修復", integration: "統合テスト" }
    : { analysis: "技术分析", execution: "执行", recovery: "令狐修复", integration: "统一测试" };
  const latestByStage = new Map(stages.map((stage) => [stage, [...task.flowEvents].reverse().find((event) => event.stage === stage)]));
  const handler = task.currentHandler?.displayName || task.originalExecutor?.displayName || task.initiator?.displayName || (locale === "ja" ? "システム" : "系统");
  const retryLabel = task.state === "test-failed" ? (locale === "ja" ? "再テスト" : "重新测试") : (locale === "ja" ? "続行" : "继续执行");
  const retryable = ["test-failed", "blocked", "recovering"].includes(task.state);
  return <section className={`collaboration-status-chain ${task.blockingReason ? "has-blocker" : ""}`} aria-live="polite">
    <header><strong>{locale === "ja" ? "協同タスク" : "协作任务状态"}</strong><span>{handler} · {collaborationTaskStateLabel(task.state, locale)}</span></header>
    <ol>{stages.map((stage) => { const event = latestByStage.get(stage); if (!event && stage !== "analysis") return null; return <li key={stage} className={event?.error ? "failed" : event?.status === "completed" ? "completed" : "active"}><i /><span><strong>{stageLabels[stage]}</strong><small>{event?.summary || (locale === "ja" ? "担当者待ち" : "等待分配负责人")}</small></span></li>; })}</ol>
    {task.blockingReason && <p role="status"><strong>{locale === "ja" ? "停止理由" : "当前卡点"}</strong>{task.blockingReason}</p>}
    <details className="collaboration-status-task-details"><summary>{locale === "ja" ? `タスク詳細 · ${task.initiator?.displayName || "システム"}` : `任务详细 · ${task.initiator?.displayName || "系统"}`}</summary><div><MarkdownMessage text={task.snapshot.confirmedIntent} /></div></details>
    <footer><span>{locale === "ja" ? "現在の担当" : "当前负责人"}：<strong>{handler}</strong></span>{retryable && <button type="button" onClick={() => void onRetry(task.taskId)}><ArrowClockwise24Regular />{retryLabel}</button>}</footer>
  </section>;
}
