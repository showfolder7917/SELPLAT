import { ArrowReply24Regular } from "@fluentui/react-icons";

import type { CollaborationMemberOutDto, CollaborationTaskOutDto, LinghuAutomationStateOutDto, LocaleValue } from "../../../../contracts/system/desktop/index";
import type { CollaborationLiveOutput } from "../model/collaboration-live-output";
import { collaborationExecutorNames, collaborationTaskStateLabel, formatCollaborationDuration, formatCollaborationTime } from "../model/collaboration-formatters";
import { CollaborationTaskProgressView } from "./CollaborationTaskProgressView";

export function CollaborationTaskDetail({ task, member, liveOutput, automation, locale, onBack }: { task: CollaborationTaskOutDto; member: CollaborationMemberOutDto; liveOutput: CollaborationLiveOutput | null; automation: LinghuAutomationStateOutDto | null; locale: LocaleValue; onBack(): void }) {
  const summary = task.resultSummary;
  return <section className="collaboration-task-detail" aria-label={task.snapshot.title}>
    <header><button type="button" onClick={onBack}><ArrowReply24Regular />{locale === "ja" ? "戻る" : "返回"}</button><div><h1>{task.snapshot.title}</h1><p>{collaborationTaskStateLabel(task.state, locale)}</p></div></header>
    {task.historyCompleteness === "legacy-partial" && <div className="history-incomplete-note">{locale === "ja" ? "旧版の記録には完全な参加者・引継ぎ履歴がありません。" : "历史版本未记录完整参与者与转交流程，以下仅展示可确认事实。"}</div>}
    <section className={`task-result-hero ${summary?.success ? "success" : "incomplete"}`}>
      <div><span>{locale === "ja" ? "タスク結果" : "任务结果"}</span><strong>{summary?.success ? (locale === "ja" ? "正常完了" : "成功完成") : (locale === "ja" ? "未完了・要確認" : "未完成或仍有遗留")}</strong></div>
      <dl><div><dt>{locale === "ja" ? "最終結果" : "最终执行结果"}</dt><dd>{summary?.finalResult || task.finalResult || "—"}</dd></div><div><dt>{locale === "ja" ? "元の問題" : "原来存在的问题"}</dt><dd>{summary?.originalProblem || task.snapshot.problemStatement}</dd></div><div><dt>{locale === "ja" ? "解決した問題" : "本次解决的问题"}</dt><dd>{summary?.solvedProblem || "—"}</dd></div><div><dt>{locale === "ja" ? "変更内容" : "具体修正或改变"}</dt><dd>{summary?.changes || "—"}</dd></div><div><dt>{locale === "ja" ? "残件" : "失败或遗留内容"}</dt><dd>{summary?.remaining || (summary?.success ? (locale === "ja" ? "なし" : "无") : task.blockingReason || "—")}</dd></div></dl>
    </section>
    <section className="task-fact-strip"><span>{locale === "ja" ? "起案者" : "发起人"}<strong>{task.initiator?.displayName || (locale === "ja" ? "履歴なし" : "历史未记录")}</strong></span><span>{locale === "ja" ? "実行者" : "执行人"}<strong>{collaborationExecutorNames(task).join("、") || "—"}</strong></span><span>{locale === "ja" ? "開始" : "开始"}<strong>{formatCollaborationTime(task.startedAt, locale)}</strong></span><span>{locale === "ja" ? "完了" : "完成"}<strong>{formatCollaborationTime(task.completedAt, locale)}</strong></span><span>{locale === "ja" ? "所要時間" : "总耗时"}<strong>{formatCollaborationDuration(task.startedAt, task.completedAt, locale)}</strong></span></section>
    <CollaborationTaskProgressView task={task} member={member} liveOutput={liveOutput} automation={automation} locale={locale} />
  </section>;
}
