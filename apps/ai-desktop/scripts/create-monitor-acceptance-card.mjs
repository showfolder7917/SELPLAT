import { randomUUID } from "node:crypto";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { build } from "esbuild";

const projectRoot = path.resolve(import.meta.dirname, "../../..");
const requestedDatabasePath = process.argv.find((item) => item.startsWith("--database-path="))?.slice("--database-path=".length).trim();
const databasePath = requestedDatabasePath ? path.resolve(requestedDatabasePath) : path.join(projectRoot, "apps/ai-desktop/db/workflow-control.sqlite3");
const sourcePath = path.join(projectRoot, "apps/ai-desktop/electron/services/evolution/internal/evolution-state.store.ts");

function requiredOption(name) {
  const marker = `--${name}=`;
  const value = process.argv.find((item) => item.startsWith(marker))?.slice(marker.length).trim();
  if (!value) throw new Error(`缺少 ${marker}<值>`);
  return value;
}

const title = requiredOption("title");
const resultSummary = requiredOption("summary");
const evidence = requiredOption("evidence").split("|").map((item) => item.trim()).filter(Boolean);
const acceptanceCriteria = requiredOption("criteria").split("|").map((item) => item.trim()).filter(Boolean);
const sourceRequestId = process.argv.find((item) => item.startsWith("--source-request-id="))?.split("=").slice(1).join("=").trim() || null;
const retiredReason = requiredOption("retired-reason");

const bundled = await build({ entryPoints: [sourcePath], bundle: true, format: "esm", platform: "node", target: "es2022", write: false });
const { EvolutionStateStore } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
const database = new DatabaseSync(databasePath, { enableForeignKeyConstraints: true });
database.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000");

function loadState() {
  const row = database.prepare("SELECT stateJson FROM AiDesktopEvolutionState WHERE singletonId=1").get();
  if (!row) throw new Error("工作流控制库缺少 Evolution 状态。");
  const state = JSON.parse(row.stateJson);
  state.conversation = { ownerPersonaId: "nangong-wan", conversationId: "monitor-acceptance-maintenance", createdAt: state.updatedAt, messages: [], updatedAt: state.updatedAt };
  return state;
}

const before = loadState();
const previousRun = before.oneShotRun ? structuredClone(before.oneShotRun) : null;
const retiredRunIds = new Set(before.archiveRecords
  .filter((record) => record.eventType === "one-shot.topic-switch-retired")
  .map((record) => record.payload?.oneShotRun?.runId)
  .filter((runId) => typeof runId === "string"));
if (previousRun?.runId) retiredRunIds.add(previousRun.runId);
const repository = {
  load: () => structuredClone(before),
  loadLatestConversation: () => before.conversation,
  save: (next) => {
    const { conversation: _conversation, ...persisted } = next;
    database.exec("BEGIN IMMEDIATE");
    try {
      database.prepare(`UPDATE AiDesktopEvolutionState SET stateVersion=$version, stateJson=$stateJson, updatedAt=$updatedAt WHERE singletonId=1`).run({
        $version: next.version, $stateJson: JSON.stringify(persisted), $updatedAt: next.updatedAt,
      });
      const newTopic = next.topics.find((item) => item.topicId === next.oneShotRun?.topicId);
      const newProposal = next.proposals.find((item) => item.proposalId === next.oneShotRun?.proposalId);
      if (!newTopic || !newProposal || newTopic.status !== "pending-acceptance" || newProposal.finalConclusionRecordId !== null) {
        throw new Error("监控者独立验收卡必须等待真实验收，不得预写通过结论。");
      }
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
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  },
};

try {
  const state = new EvolutionStateStore(repository).createMonitorAcceptanceCard({
    title,
    goal: `对正式版本“${title}”建立独立页面验收记录。`,
    evidence,
    acceptanceCriteria,
    resultSummary,
    sourceRequestId,
    retiredReason,
  });
  process.stdout.write(`${JSON.stringify({ topicId: state.oneShotRun.topicId, proposalId: state.oneShotRun.proposalId, status: state.oneShotRun.status, title }, null, 2)}\n`);
} finally {
  database.close();
}
