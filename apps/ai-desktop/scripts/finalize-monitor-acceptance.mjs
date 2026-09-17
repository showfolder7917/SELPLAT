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
      if (!newTopic || !newProposal) throw new Error("监控者验收归档没有形成完整专题和提案。");
      const oldGroupId = previousRun?.topicId ? `topic:${previousRun.topicId}` : null;
      if (oldGroupId) {
        database.prepare(`UPDATE AiDesktopTaskTimelineTopic SET status='cancelled', summary=$summary, updatedAt=$updatedAt WHERE groupId=$groupId`).run({
          $summary: retiredReason, $updatedAt: next.updatedAt, $groupId: oldGroupId,
        });
      }
      const groupId = `topic:${newTopic.topicId}`;
      database.prepare(`INSERT INTO AiDesktopTaskTimelineTopic
        (groupId, topicId, proposalId, title, status, summary, startedAt, updatedAt, createdAt)
        VALUES ($groupId,$topicId,$proposalId,$title,'completed',$summary,$startedAt,$updatedAt,$createdAt)
        ON CONFLICT(groupId) DO UPDATE SET proposalId=excluded.proposalId,title=excluded.title,status='completed',summary=excluded.summary,updatedAt=excluded.updatedAt`).run({
          $groupId: groupId, $topicId: newTopic.topicId, $proposalId: newProposal.proposalId, $title: newTopic.title,
          $summary: resultSummary, $startedAt: newTopic.createdAt, $updatedAt: newTopic.updatedAt, $createdAt: newTopic.createdAt,
        });
      const sourceFactKey = `monitor-acceptance:${newProposal.proposalId}:passed`;
      if (!database.prepare("SELECT 1 FROM AiDesktopTaskTimelineEvent WHERE sourceFactKey=$sourceFactKey").get({ $sourceFactKey: sourceFactKey })) {
        const sequence = Number(database.prepare("SELECT COALESCE(MAX(sequenceNumber),0)+1 AS value FROM AiDesktopTaskTimelineEvent WHERE groupId=$groupId").get({ $groupId: groupId }).value);
        database.prepare(`INSERT INTO AiDesktopTaskTimelineEvent
          (factId,groupId,proposalId,taskId,nodeId,sourceFactKey,sequenceNumber,eventType,contentRole,detailRole,schemaVersion,kind,
           actorMemberId,actorDisplayName,recipientsJson,status,action,summary,content,detail,startedAt,completedAt,automaticOpen,manualApprovalProposalId,occurredAt,committedAt)
          VALUES ($factId,$groupId,$proposalId,NULL,$nodeId,$sourceFactKey,$sequenceNumber,'acceptance.passed','analysis-output','result-evidence',2,'verification',
           'han-li','韩立','[{"memberId":"user","displayName":"用户"}]','completed','验收通过，结果已归档',$summary,$content,$detail,$occurredAt,$occurredAt,0,NULL,$occurredAt,$occurredAt)`).run({
            $factId: `timeline-fact-${randomUUID()}`, $groupId: groupId, $proposalId: newProposal.proposalId,
            $nodeId: `acceptance:${newProposal.proposalId}:monitor:passed`, $sourceFactKey: sourceFactKey, $sequenceNumber: sequence,
            $summary: resultSummary, $content: resultSummary, $detail: evidence.join("\n"), $occurredAt: next.updatedAt,
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
  const state = new EvolutionStateStore(repository).completeMonitorAcceptance({
    title,
    goal: `归档正式版本“${title}”已经完成的客户可见验收。`,
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
