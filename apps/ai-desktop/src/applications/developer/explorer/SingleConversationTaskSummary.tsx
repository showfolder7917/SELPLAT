/**
 * Developer 左侧栏的单会话任务摘要。
 *
 * 这里只显示最近一次普通任务，不负责渲染右侧 Codex 会话页面。
 */

import type {
  // 最近任务摘要由诊断控制器读取，本组件只显示请求标题和状态。
  AuditTaskSummaryOutDto,
  // 界面语言决定空状态和任务状态使用中文还是日文。
  LocaleValue,
} from "../../../../contracts/system/desktop/index";
import {
  // 审计状态转换器把后端状态码转换为客户可读文字。
  auditStatusText,
} from "../../../features/settings";

type SingleConversationTaskSummaryProps = {
  /** 单会话模式最近一次完成或执行中的任务；尚无记录时为 null。 */
  auditTask: AuditTaskSummaryOutDto | null;
  /** 当前界面语言。 */
  locale: LocaleValue;
};

/** 单会话导航内容只展示最近任务；没有历史时给出明确空状态。 */
export function SingleConversationTaskSummary({
  auditTask,
  locale,
}: SingleConversationTaskSummaryProps) {
  if (!auditTask) {
    const emptyText = locale === "ja" ? "タスク履歴はまだありません" : "暂无任务记录";
    return <span className="task-empty">{emptyText}</span>;
  }

  const fallbackTitle = locale === "ja" ? "新しいタスク" : "新建任务";
  const taskTitle = auditTask.request || fallbackTitle;
  const taskStatus = auditStatusText(auditTask.status, locale);

  return (
    <div className="task-summary" title={auditTask.request}>
      <strong>{taskTitle}</strong>
      <span>{taskStatus}</span>
    </div>
  );
}
