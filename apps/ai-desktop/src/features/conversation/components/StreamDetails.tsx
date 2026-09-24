import { fixedUiText, type FixedUiTextKey } from "../../../../contracts/foundation/index";
import type { LocaleValue, ManagedExecutionModeValue } from "../../../../contracts/system/desktop/index";
import type { Message } from "../model/chat-message";

export function managedModeLabel(mode: ManagedExecutionModeValue, locale: LocaleValue): string {
  const labelsByMode: Record<ManagedExecutionModeValue, FixedUiTextKey> = {
    "conversation-managed": "managedModeConversation",
    "requirement-managed": "managedModeRequirement",
    "task-managed": "managedModeTask",
    "test-managed": "managedModeTest",
  };
  return fixedUiText(locale, labelsByMode[mode]);
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
      <summary><span>{fixedUiText(locale, "streamProcess")}</span><small>{formatFixedUiText(locale, "streamActivityCount", activities.length)} · {activityLabel(activities.at(-1)?.itemType || "", locale)}</small></summary>
      <div className="stream-activities">{activities.map((activity) => <div className={activity.phase} key={activity.id}><i /><span><strong>{activityLabel(activity.itemType, locale)}</strong>{activity.summary && <small>{activity.summary}</small>}</span></div>)}</div>
    </details>}
    {changedFiles.length > 0 && <details className="stream-files" open><summary>{formatFixedUiText(locale, "streamChangedFiles", changedFiles.length)}</summary>{changedFiles.map((file) => <code key={file}>{file}</code>)}</details>}
    {!message.collaborationTaskId && (message.streaming || message.streamTerminal || message.streamError || message.managedExecution) && <div className={`stream-current ${message.streamError || message.streamStatus === "failed" ? "failed" : message.streaming ? "running" : "completed"}`}><i /><span>{message.streamError || (message.streaming ? streamStatusLabel(message.streamStatus, locale) : completedStatusLabel(message, locale))}</span></div>}
  </div>;
}

function activityLabel(itemType: string, locale: LocaleValue): string {
  const labelsByItemType: Record<string, FixedUiTextKey> = {
    reasoning: "streamActivityReasoning", commandExecution: "streamActivityCommandExecution", commandPolicy: "streamActivityCommandPolicy",
    fileChange: "streamActivityFileChange", mcpToolCall: "streamActivityMcpToolCall", dynamicToolCall: "streamActivityDynamicToolCall",
    collabToolCall: "streamActivityCollabToolCall", webSearch: "streamActivityWebSearch", imageView: "streamActivityImageView",
    contextCompaction: "streamActivityContextCompaction", agentMessage: "streamActivityAgentMessage",
  };
  return fixedUiText(locale, labelsByItemType[itemType] || "streamUnknownActivity");
}

function streamStatusLabel(status: string | undefined, locale: LocaleValue): string {
  const labelsByStatus: Record<string, FixedUiTextKey> = {
    starting: "streamStarting", inProgress: "streamInProgress", planning: "streamPlanning", reasoning: "streamReasoning",
    responding: "streamResponding", commandExecution: "streamCommandExecution", fileChange: "streamFileChange",
  };
  return fixedUiText(locale, labelsByStatus[status || ""] || "streamInProgress");
}

function completedStatusLabel(message: Message, locale: LocaleValue): string {
  if (message.streamStatus === "interrupted") return fixedUiText(locale, "streamInterrupted");
  if (message.streamStatus === "failed") return fixedUiText(locale, "streamFailed");
  const mode = message.managedExecution?.mode || message.managedMode;
  const labelsByMode: Partial<Record<ManagedExecutionModeValue, FixedUiTextKey>> = {
    "conversation-managed": "streamConversationCompleted", "requirement-managed": "streamRequirementCompleted",
    "task-managed": "streamTaskCompleted", "test-managed": "streamTestCompleted",
  };
  return fixedUiText(locale, mode ? labelsByMode[mode] || "streamCompleted" : "streamCompleted");
}

function formatFixedUiText(locale: LocaleValue, key: FixedUiTextKey, count: number): string {
  return fixedUiText(locale, key).replace("{count}", String(count));
}
