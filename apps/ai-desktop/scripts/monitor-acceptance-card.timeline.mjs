import { randomUUID } from "node:crypto";

/** 与 Evolution 状态写入共用调用方事务，封存旧时间线并建立待验收节点。 */
export function syncMonitorAcceptanceTimeline(database, { previousRun, retiredRunIds, retiredReason, resultSummary, evidence, next, newTopic, newProposal }) {
  const oldGroupId = previousRun?.topicId ? `topic:${previousRun.topicId}` : null;
  if (oldGroupId) {
    database.prepare(`UPDATE AiDesktopTaskTimelineTopic SET status='cancelled', summary=$summary, updatedAt=$updatedAt WHERE groupId=$groupId`).run({
      $summary: retiredReason, $updatedAt: next.updatedAt, $groupId: oldGroupId,
    });
  }
  // 没有专题、提案或任务身份的卡点树只能依靠“原运行”归属。若原运行已明确退役，
  // 它必须和旧专题在同一事务中退出活动状态，既保留审计，也不能继续显示为待处理。
  const orphanGroups = database.prepare(`SELECT groupId FROM AiDesktopTaskTimelineTopic
    WHERE groupId LIKE 'checkpoint:%' AND status IN ('running','blocked','waiting')`).all();
  const readCheckpointFacts = database.prepare(`SELECT taskId,proposalId,detail FROM AiDesktopTaskTimelineEvent
    WHERE groupId=$groupId ORDER BY sequenceNumber`);
  const retireCheckpointGroup = database.prepare(`UPDATE AiDesktopTaskTimelineTopic
    SET status='cancelled',summary=$summary,revision=revision+1,updatedAt=$updatedAt WHERE groupId=$groupId`);
  for (const group of orphanGroups) {
    const facts = readCheckpointFacts.all({ $groupId: group.groupId });
    if (!facts.length || facts.some((fact) => fact.taskId || fact.proposalId)) continue;
    const belongsToRetiredRun = facts.some((fact) => retiredRunIds.has(String(fact.detail || "").match(/原运行：([^\s]+)/)?.[1] || ""));
    if (!belongsToRetiredRun) continue;
    retireCheckpointGroup.run({
      $summary: "原运行已由监控者封存；孤立卡点树仅保留审计，不再等待处理。",
      $updatedAt: next.updatedAt,
      $groupId: group.groupId,
    });
  }
  const groupId = `topic:${newTopic.topicId}`;
  database.prepare(`INSERT INTO AiDesktopTaskTimelineTopic
    (groupId, topicId, proposalId, title, status, summary, startedAt, updatedAt, createdAt)
    VALUES ($groupId,$topicId,$proposalId,$title,'verifying',$summary,$startedAt,$updatedAt,$createdAt)
    ON CONFLICT(groupId) DO UPDATE SET proposalId=excluded.proposalId,title=excluded.title,status='verifying',summary=excluded.summary,updatedAt=excluded.updatedAt`).run({
      $groupId: groupId, $topicId: newTopic.topicId, $proposalId: newProposal.proposalId, $title: newTopic.title,
      $summary: "正式版本已交付，等待韩立独立页面验收。", $startedAt: newTopic.createdAt, $updatedAt: newTopic.updatedAt, $createdAt: newTopic.createdAt,
    });
  const sourceFactKey = `monitor-acceptance:${newProposal.proposalId}:received`;
  if (!database.prepare("SELECT 1 FROM AiDesktopTaskTimelineEvent WHERE sourceFactKey=$sourceFactKey").get({ $sourceFactKey: sourceFactKey })) {
    const sequence = Number(database.prepare("SELECT COALESCE(MAX(sequenceNumber),0)+1 AS value FROM AiDesktopTaskTimelineEvent WHERE groupId=$groupId").get({ $groupId: groupId }).value);
    database.prepare(`INSERT INTO AiDesktopTaskTimelineEvent
      (factId,groupId,proposalId,taskId,nodeId,sourceFactKey,sequenceNumber,eventType,contentRole,detailRole,schemaVersion,kind,
       actorMemberId,actorDisplayName,recipientsJson,status,action,summary,content,detail,startedAt,completedAt,automaticOpen,manualApprovalProposalId,occurredAt,committedAt)
      VALUES ($factId,$groupId,$proposalId,NULL,$nodeId,$sourceFactKey,$sequenceNumber,'acceptance.received','analysis-output','acceptance-criteria',2,'verification',
       'system','系统','[{"memberId":"han-li","displayName":"韩立"}]','waiting','独立验收卡已建立',$summary,$content,$detail,$occurredAt,NULL,0,NULL,$occurredAt,$occurredAt)`).run({
        $factId: `timeline-fact-${randomUUID()}`, $groupId: groupId, $proposalId: newProposal.proposalId,
        $nodeId: `acceptance:${newProposal.proposalId}:monitor:received`, $sourceFactKey: sourceFactKey, $sequenceNumber: sequence,
        $summary: "等待独立验收", $content: resultSummary, $detail: evidence.join("\n"), $occurredAt: next.updatedAt,
      });
    database.prepare("UPDATE AiDesktopTaskTimelineTopic SET revision=revision+1 WHERE groupId=$groupId").run({ $groupId: groupId });
  }
}
