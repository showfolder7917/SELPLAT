import type { LocaleValue, ManagedExecutionModeValue } from "../../../../contracts/system/desktop/index";
import type { Message } from "../model/chat-message";

export function managedModeLabel(mode: ManagedExecutionModeValue, locale: LocaleValue): string {
  const labelsByMode: Record<ManagedExecutionModeValue, { ja: string; "zh-CN": string }> = {
    "conversation-managed": { ja: "会話管理", "zh-CN": "会话托管" },
    "requirement-managed": { ja: "要件管理", "zh-CN": "需求托管" },
    "task-managed": { ja: "タスク管理", "zh-CN": "任务托管" },
    "test-managed": { ja: "テスト管理", "zh-CN": "测试托管" },
  };
  return labelsByMode[mode][locale];
}

export function StreamDetails({ message, locale }: { message: Message; locale: LocaleValue }) {
  const plan = message.plan || [];
  const activities = message.activities || [];
  const changedFiles = message.changedFiles || [];
  if (!message.streaming && !message.streamError && plan.length === 0 && activities.length === 0 && changedFiles.length === 0) return null;
  return <div className="stream-details">
    {message.reasoningSummary && <p className="stream-reasoning">{message.reasoningSummary}</p>}
    {message.managedExecution && <div className={`managed-execution-status ${message.managedExecution.status}`}><strong>{managedModeLabel(message.managedExecution.mode, locale)}</strong><span>{message.managedExecution.message}</span><small>{message.managedExecution.round}/{message.managedExecution.maximumRounds}</small></div>}
    {plan.length > 0 && <ol className="stream-plan">{plan.map((entry, index) => <li className={entry.status} key={`${index}:${entry.step}`}><i />{entry.step}</li>)}</ol>}
    {activities.length > 0 && <details className="stream-activity-details">
      <summary><span>{locale === "ja" ? "実行プロセス" : "执行过程"}</span><small>{activities.length} {locale === "ja" ? "件" : "项"} · {activityLabel(activities.at(-1)?.itemType || "", locale)}</small></summary>
      <div className="stream-activities">{activities.map((activity) => <div className={activity.phase} key={activity.id}><i /><span><strong>{activityLabel(activity.itemType, locale)}</strong>{activity.summary && <small>{activity.summary}</small>}</span></div>)}</div>
    </details>}
    {changedFiles.length > 0 && <details className="stream-files" open><summary>{locale === "ja" ? `変更ファイル ${changedFiles.length}` : `已涉及 ${changedFiles.length} 个文件`}</summary>{changedFiles.map((file) => <code key={file}>{file}</code>)}</details>}
    {!message.collaborationTaskId && (message.streaming || message.streamTerminal || message.streamError || message.managedExecution) && <div className={`stream-current ${message.streamError || message.streamStatus === "failed" ? "failed" : message.streaming ? "running" : "completed"}`}><i /><span>{message.streamError || (message.streaming ? streamStatusLabel(message.streamStatus, locale) : completedStatusLabel(message, locale))}</span></div>}
  </div>;
}

function activityLabel(itemType: string, locale: LocaleValue): string {
  const japanese: Record<string, string> = { reasoning: "分析中", commandExecution: "コマンド実行", commandPolicy: "実行ポリシー", fileChange: "ファイル変更", mcpToolCall: "ツール呼び出し", dynamicToolCall: "ツール実行", collabToolCall: "エージェント連携", webSearch: "Web 検索", imageView: "画像確認", contextCompaction: "会話整理", agentMessage: "回答作成" };
  const chinese: Record<string, string> = { reasoning: "正在分析", commandExecution: "执行命令", commandPolicy: "执行策略", fileChange: "修改文件", mcpToolCall: "调用工具", dynamicToolCall: "执行工具", collabToolCall: "协作处理", webSearch: "搜索网页", imageView: "查看图片", contextCompaction: "整理会话", agentMessage: "生成回答" };
  return (locale === "ja" ? japanese : chinese)[itemType] || itemType;
}

function streamStatusLabel(status: string | undefined, locale: LocaleValue): string {
  if (locale === "ja") {
    const labelsByStatus: Record<string, string> = { starting: "Codex を開始しています…", inProgress: "Codex が処理中…", planning: "計画を更新しています…", reasoning: "分析中…", responding: "回答を生成しています…", commandExecution: "コマンドを実行しています…", fileChange: "ファイルを変更しています…" };
    return labelsByStatus[status || ""] || "Codex が処理中…";
  }
  const labelsByStatus: Record<string, string> = { starting: "正在启动 Codex…", inProgress: "Codex 正在处理…", planning: "正在更新计划…", reasoning: "正在分析…", responding: "正在生成回答…", commandExecution: "正在执行命令…", fileChange: "正在修改文件…" };
  return labelsByStatus[status || ""] || "Codex 正在处理…";
}

function completedStatusLabel(message: Message, locale: LocaleValue): string {
  if (message.streamStatus === "interrupted") return locale === "ja" ? "中断しました" : "已中断";
  if (message.streamStatus === "failed") return locale === "ja" ? "失敗しました" : "执行失败";
  const mode = message.managedExecution?.mode || message.managedMode;
  if (locale === "ja") {
    if (mode === "conversation-managed") return "意図の分析が完了しました";
    if (mode === "requirement-managed") return "要件分析が完了しました";
    if (mode === "task-managed") return "実行とコード検証が完了しました";
    if (mode === "test-managed") return "テストが完了しました";
    return "完了しました";
  }
  if (mode === "conversation-managed") return "意图分析完成";
  if (mode === "requirement-managed") return "需求分析完成";
  if (mode === "task-managed") return "执行与代码验证完成";
  if (mode === "test-managed") return "测试完成";
  return "已完成";
}
