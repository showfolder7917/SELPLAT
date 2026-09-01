import { useEffect, useMemo, useRef, useState } from "react";

import type { CollaborationMemberOutDto, CollaborationTaskOutDto, LinghuAutomationStateOutDto, LocaleValue } from "../../../../contracts/system/desktop/index";
import type { Message } from "../../conversation/model/chat-message";
import { MarkdownMessage } from "../../conversation/components/MarkdownMessage";
import { StreamDetails } from "../../conversation/components/StreamDetails";
import { deriveCollaborationTaskProgress, type CollaborationProgressStageId } from "../model/collaboration-task-progress";
import type { CollaborationLiveOutput } from "../model/collaboration-live-output";
import { collaborationExecutionStatusLabel, collaborationPlanStatusLabel, formatCollaborationTime } from "../model/collaboration-formatters";

/** 当前任务只展开真实卡点，报告、证据和评分留在所属流程环节内。 */
export function CollaborationTaskProgressView({ task, member, liveOutput, automation, locale }: {
  task: CollaborationTaskOutDto;
  member: CollaborationMemberOutDto;
  liveOutput: CollaborationLiveOutput | null;
  automation: LinghuAutomationStateOutDto | null;
  locale: LocaleValue;
}) {
  const progress = useMemo(() => deriveCollaborationTaskProgress(task, member, automation, locale), [task, member, automation, locale]);
  const [openStages, setOpenStages] = useState<Set<CollaborationProgressStageId>>(() => new Set([progress.currentStageId]));
  const currentStageRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    setOpenStages(new Set([progress.currentStageId]));
    window.requestAnimationFrame(() => currentStageRef.current?.scrollIntoView({ block: "nearest" }));
  }, [task.taskId, progress.currentStageId]);

  const toggleStage = (stageId: CollaborationProgressStageId, open: boolean) => {
    setOpenStages((current) => {
      const next = new Set(current);
      if (open) next.add(stageId); else next.delete(stageId);
      return next;
    });
  };

  return <>
    <section className="task-progress-card" aria-label={locale === "ja" ? "現在の進捗" : "当前进度"}>
      <div className="task-progress-primary"><span>{progress.currentOwner}</span><strong>{progress.currentAction}</strong></div>
      <div className="task-progress-facts">
        <span>{locale === "ja" ? "現在の手順" : "当前步骤"}<strong>{locale === "ja" ? `${progress.currentStep}/${progress.totalSteps}` : `第 ${progress.currentStep}/${progress.totalSteps} 步`}</strong></span>
        <span>{locale === "ja" ? "更新" : "最近更新"}<strong>{formatCollaborationTime(progress.updatedAt, locale)}</strong></span>
        <span>{locale === "ja" ? "次の担当" : "下一步去向"}<strong>{progress.nextOwner} · {progress.nextAction}</strong></span>
      </div>
    </section>
    <div className="task-progress-stages">
      {progress.stages.map((stage) => <details
        key={stage.id}
        ref={stage.id === progress.currentStageId ? currentStageRef : undefined}
        className={`task-progress-stage ${stage.status}`}
        open={openStages.has(stage.id)}
        onToggle={(event) => toggleStage(stage.id, event.currentTarget.open)}
      >
        <summary><span><strong>{stage.label}</strong><b>{stage.owner}</b></span><small>{stage.statusLabel}</small></summary>
        <div className="task-progress-stage-content">
          {stage.waitingFor && stage.status !== "current" && <p className="task-stage-waiting">{stage.waitingFor}</p>}
          <CollaborationStageContent stageId={stage.id} task={task} liveMessage={stage.id === liveOutput?.stageId ? liveOutput.message : null} automation={automation} locale={locale} />
        </div>
      </details>)}
    </div>
  </>;
}
function CollaborationStageContent({ stageId, task, liveMessage, automation, locale }: {
  stageId: CollaborationProgressStageId;
  task: CollaborationTaskOutDto;
  liveMessage: Message | null;
  automation: LinghuAutomationStateOutDto | null;
  locale: LocaleValue;
}) {
  const relevantEvents = task.flowEvents.filter((event) => stageId === "repair"
    ? event.stage === "recovery" || event.error
    : stageId === "unified-test"
      ? /test|测试|restart|重启|verif/i.test(`${event.type} ${event.summary}`)
      : false);
  return <>
    {stageId === "intent" && <>
      <MarkdownMessage text={task.snapshot.confirmedIntent} />
      {task.plans.map((plan) => <article key={plan.version} className="task-stage-record"><header><strong>{plan.ownerDisplayName}</strong><span>v{plan.version} · {collaborationPlanStatusLabel(plan.status, locale)}</span></header><MarkdownMessage text={plan.text} /></article>)}
    </>}
    {stageId === "execution" && <>
      {task.executionRecords.length === 0 && <p className="task-stage-empty">{locale === "ja" ? "実行記録はまだありません。" : "暂时没有执行记录。"}</p>}
      {task.executionRecords.map((record) => <article key={record.assignmentId} className="task-stage-record"><header><strong>{record.executor.displayName}</strong><span>{collaborationExecutionStatusLabel(record.status, locale)}</span></header>{record.changedFiles?.length ? <ChangedFileList files={record.changedFiles} locale={locale} /> : null}{record.result && <MarkdownMessage text={record.result} />}{record.blockingReason && <p className="task-detail-error">{record.blockingReason}</p>}</article>)}
    </>}
    {stageId === "repair" && <>
      {task.blockingReason && <p className="task-detail-error">{task.blockingReason}</p>}
      {relevantEvents.length === 0 && <p className="task-stage-empty">{locale === "ja" ? "修正が必要な問題はまだ記録されていません。" : "暂未记录需要修复的问题。"}</p>}
      {relevantEvents.map((event) => <article key={event.eventId} className="task-stage-record"><header><strong>{event.actor?.displayName || (locale === "ja" ? "システム" : "系统")}</strong><span>{formatCollaborationTime(event.occurredAt, locale)}</span></header><p className={event.error ? "task-detail-error" : ""}>{event.summary}</p></article>)}
    </>}
    {stageId === "unified-test" && <>
      {automation?.activeTaskId === task.taskId && automation.currentModule === "test-coverage" && <p>{locale === "ja" ? "テスト漏れ、競合、実行性能を確認しています。" : "正在检查测试漏点、资源竞争与执行性能。"}</p>}
      {relevantEvents.length === 0 && <p className="task-stage-empty">{locale === "ja" ? "統合テスト結果はまだありません。" : "暂时没有统一测试结果。"}</p>}
      {relevantEvents.map((event) => <article key={event.eventId} className="task-stage-record"><header><strong>{event.actor?.displayName || (locale === "ja" ? "システム" : "系统")}</strong><span>{formatCollaborationTime(event.occurredAt, locale)}</span></header><p className={event.error ? "task-detail-error" : ""}>{event.summary}</p></article>)}
      {automation?.lastFeedback?.taskId === task.taskId && <article className="task-stage-record"><MarkdownMessage text={automation.lastFeedback.summary} /></article>}
    </>}
    {liveMessage && <div className="member-live-result"><MarkdownMessage text={liveMessage.text} /><StreamDetails message={liveMessage} locale={locale} /></div>}
  </>;
}

function ChangedFileList({ files, locale }: { files: string[]; locale: LocaleValue }) {
  return <div className="collaboration-changed-files"><strong>{locale === "ja" ? "ソース変更" : "源码变化"}</strong><ul>{files.map((file) => <li key={file}>{file}</li>)}</ul></div>;
}
