import { Document24Regular } from "@fluentui/react-icons";

import type { CollaborationTaskOutDto, LocaleValue } from "../../../../contracts/system/desktop/index";
import { collaborationExecutorNames, formatCollaborationDuration, formatCollaborationTime } from "../model/collaboration-formatters";

export function CollaborationExecutionList({ tasks, locale, onOpen }: { tasks: CollaborationTaskOutDto[]; locale: LocaleValue; onOpen(taskId: string): void }) {
  if (tasks.length === 0) return <section className="collaboration-execution-page"><div className="execution-list-empty"><Document24Regular /><strong>{locale === "ja" ? "実行履歴はまだありません" : "暂无执行记录"}</strong><span>{locale === "ja" ? "完了した協同タスクはここに保存されます。" : "协同任务完成后会统一归档到这里。"}</span></div></section>;
  return <section className="collaboration-execution-page" aria-label={locale === "ja" ? "実行一覧" : "执行列表"}>
    <header><div><h1>{locale === "ja" ? "実行一覧" : "执行列表"}</h1><p>{locale === "ja" ? "完了した協同タスクを結果からすばやく確認できます。" : "按任务结果快速查看全部协同归档。"}</p></div><strong>{tasks.length}</strong></header>
    <div className="execution-record-list">{tasks.map((task) => {
      const executors = collaborationExecutorNames(task);
      return <details className="execution-record" key={task.taskId}>
        <summary>
          <span className={`execution-outcome ${task.resultSummary?.success ? "success" : "failed"}`}>{task.resultSummary?.success ? (locale === "ja" ? "完了" : "成功") : (locale === "ja" ? "未完了" : "未完成")}</span>
          <strong>{task.snapshot.title}</strong>
          <span className="execution-record-facts"><span><small>{locale === "ja" ? "起案者" : "发起人"}</small><b>{task.initiator?.displayName || (locale === "ja" ? "履歴なし" : "历史未记录")}</b></span><span><small>{locale === "ja" ? "実行者" : "执行人"}</small><b>{executors.join("、") || (locale === "ja" ? "未割当" : "未分配")}</b></span><span><small>{locale === "ja" ? "開始" : "开始时间"}</small><b>{formatCollaborationTime(task.startedAt, locale)}</b></span><span><small>{locale === "ja" ? "完了" : "完成时间"}</small><b>{formatCollaborationTime(task.completedAt, locale)}</b></span><span><small>{locale === "ja" ? "所要時間" : "总耗时"}</small><b>{formatCollaborationDuration(task.startedAt, task.completedAt, locale)}</b></span></span>
        </summary>
        <div className="execution-record-preview"><strong>{locale === "ja" ? "結果概要" : "任务结果摘要"}</strong><p>{task.resultSummary?.finalResult || task.finalResult || (locale === "ja" ? "結果概要はありません。" : "暂无结果摘要。")}</p><button type="button" onClick={() => onOpen(task.taskId)}>{locale === "ja" ? "完全な記録を開く" : "打开完整记录"}</button></div>
      </details>;
    })}</div>
  </section>;
}
