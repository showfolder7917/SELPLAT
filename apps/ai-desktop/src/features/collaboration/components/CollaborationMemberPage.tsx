import type { Dispatch, SetStateAction } from "react";
import { Code24Regular } from "@fluentui/react-icons";

import type { CollaborationMemberOutDto, CollaborationStateOutDto, EvolutionStateOutDto, LinghuAutomationStateOutDto, LocaleValue, WorkspaceStateOutDto } from "../../../../contracts/system/desktop/index";
import type { ComposerAttachment } from "../../conversation/model/chat-message";
import { MarkdownMessage } from "../../conversation/components/MarkdownMessage";
import { MemberSelfUpgradePanel } from "../../evolution/components/EvolutionRevisionPanels";
import { LinghuAutomationPanel, LinghuRepairProposalPanel } from "../../linghu";
import type { CollaborationLiveOutput } from "../model/collaboration-live-output";
import { collaborationMemberStateLabel, collaborationTaskStateLabel } from "../model/collaboration-formatters";
import { CollaborationTaskProgressView } from "./CollaborationTaskProgressView";

export function CollaborationMemberPage({ member, tasks, streams, locale, linghuAutomation, nangongEvolution, nangongAttachments, workspaces, onLinghuState, onNangongState, onNangongAttachments, onNangongScreenshot, onNangongPaste, onError, onRename, onDelete, onContinue, onCancel, onOpen }: {
  member: CollaborationMemberOutDto | null;
  tasks: CollaborationStateOutDto["tasks"];
  streams: Record<string, CollaborationLiveOutput>;
  locale: LocaleValue;
  linghuAutomation: LinghuAutomationStateOutDto | null;
  nangongEvolution: EvolutionStateOutDto | null;
  nangongAttachments: ComposerAttachment[];
  workspaces: WorkspaceStateOutDto | null;
  onLinghuState(state: LinghuAutomationStateOutDto): void;
  onNangongState(state: EvolutionStateOutDto): void;
  onNangongAttachments: Dispatch<SetStateAction<ComposerAttachment[]>>;
  onNangongScreenshot(hidden: boolean): void;
  onNangongPaste(files: File[]): void;
  onError(message: string): void;
  onRename(member: CollaborationMemberOutDto): void;
  onDelete(member: CollaborationMemberOutDto): void;
  onContinue(taskId: string): void;
  onCancel(taskId: string): void;
  onOpen(taskId: string): void;
}) {
  if (!member) return <section className="collaboration-member-page"><p>{locale === "ja" ? "メンバーを選択してください。" : "请选择人物。"}</p></section>;
  const orderedTasks = [...tasks].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const currentTask = orderedTasks.find((task) => !["integrated", "cancelled"].includes(task.state)) || orderedTasks[0] || null;
  const liveOutput = currentTask ? streams[currentTask.taskId] : null;
  const taskInitiatorName = currentTask?.initiator?.displayName || (locale === "ja" ? "履歴なし" : "历史未记录");
  return <section className="collaboration-member-page" aria-label={member.displayName}>
    <header><div><span className={`member-presence ${member.state}`} /><div><h1>{member.displayName}</h1><p>{collaborationMemberStateLabel(member, locale)}</p></div></div>{!member.protected && <nav><button type="button" onClick={() => onRename(member)}>{locale === "ja" ? "名前変更" : "重命名"}</button><button type="button" className="danger" onClick={() => onDelete(member)}>{member.state === "idle" ? (locale === "ja" ? "削除" : "删除") : (locale === "ja" ? "終了後に削除" : "完成后删除")}</button></nav>}</header>
    {member.memberId === "linghu-ancestor" && linghuAutomation && <LinghuAutomationPanel state={linghuAutomation} locale={locale} onState={onLinghuState} />}
    {member.memberId === "linghu-ancestor" && nangongEvolution && <LinghuRepairProposalPanel state={nangongEvolution} workspaces={workspaces} locale={locale} onState={onNangongState} onError={onError} />}
    {nangongEvolution && <MemberSelfUpgradePanel member={member} state={nangongEvolution} onState={onNangongState} onError={onError} />}
    {(currentTask?.blockingReason || member.blockingReason) && <div className="member-blocking-reason" role="status">{currentTask?.blockingReason || member.blockingReason}</div>}
    {currentTask ? <article className="member-current-task">
      <details key={currentTask.taskId} className="member-task-detail">
        <summary>{locale === "ja" ? `タスク詳細 · ${taskInitiatorName}` : `任务详细 · ${taskInitiatorName}`}</summary>
        <div><MarkdownMessage text={currentTask.snapshot.confirmedIntent} /></div>
      </details>
      <CollaborationTaskProgressView task={currentTask} member={member} liveOutput={liveOutput} automation={linghuAutomation} locale={locale} />
      <div className="member-task-actions"><button type="button" onClick={() => onOpen(currentTask.taskId)}>{locale === "ja" ? "詳細を見る" : "查看任务详情"}</button>{["recovering", "blocked", "test-failed"].includes(currentTask.state) && <button type="button" onClick={() => onContinue(currentTask.taskId)}>{currentTask.state === "test-failed" ? (locale === "ja" ? "再テスト" : "重新测试") : (locale === "ja" ? "続行" : "继续执行")}</button>}{!["integrated", "cancelled"].includes(currentTask.state) && <button type="button" className="danger" onClick={() => onCancel(currentTask.taskId)}>{locale === "ja" ? "キャンセル" : "取消任务"}</button>}</div>
    </article> : <div className="member-empty-task"><Code24Regular /><strong>{locale === "ja" ? "待機中" : "当前空闲"}</strong><span>{locale === "ja" ? "割り当て時に新しい Codex を作成します。" : "收到任务时才会创建新的 Codex。"}</span></div>}
    {orderedTasks.length > 1 && <section className="member-task-history"><h2>{locale === "ja" ? "過去のタスク" : "历史任务"}</h2>{orderedTasks.slice(1).map((task) => <div key={task.taskId}><strong>{task.snapshot.title}</strong><span>{collaborationTaskStateLabel(task.state, locale)}</span></div>)}</section>}
  </section>;
}
