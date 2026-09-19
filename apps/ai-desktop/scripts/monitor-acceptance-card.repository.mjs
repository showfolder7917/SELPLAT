import { DatabaseSync } from "node:sqlite";
import { syncMonitorAcceptanceTimeline } from "./monitor-acceptance-card.timeline.mjs";

/** 停机维护入口：Evolution 快照与时间线在同一 SQLite 事务内提交。 */
export function openMonitorAcceptanceRepository(databasePath, { retiredReason, resultSummary, evidence }) {
  const database = new DatabaseSync(databasePath, { enableForeignKeyConstraints: true });
  database.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000");
  try {
    const row = database.prepare("SELECT stateJson FROM AiDesktopEvolutionState WHERE singletonId=1").get();
    if (!row) throw new Error("工作流控制库缺少 Evolution 状态。");
    const before = JSON.parse(row.stateJson);
    before.conversation = {
      ownerPersonaId: "nangong-wan", conversationId: "monitor-acceptance-maintenance",
      createdAt: before.updatedAt, messages: [], updatedAt: before.updatedAt,
    };
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
          const newTopic = next.topics.find((item) => item.topicId === next.oneShotRun?.topicId);
          const newProposal = next.proposals.find((item) => item.proposalId === next.oneShotRun?.proposalId);
          if (!newTopic || !newProposal || newTopic.status !== "pending-acceptance" || newProposal.finalConclusionRecordId !== null) {
            throw new Error("监控者独立验收卡必须等待真实验收，不得预写通过结论。");
          }
          database.prepare("UPDATE AiDesktopEvolutionState SET stateVersion=$version, stateJson=$stateJson, updatedAt=$updatedAt WHERE singletonId=1").run({
            $version: next.version, $stateJson: JSON.stringify(persisted), $updatedAt: next.updatedAt,
          });
          syncMonitorAcceptanceTimeline(database, { previousRun, retiredRunIds, retiredReason, resultSummary, evidence, next, newTopic, newProposal });
          database.exec("COMMIT");
        } catch (error) {
          database.exec("ROLLBACK");
          throw error;
        }
      },
    };
    return { repository, close: () => database.close() };
  } catch (error) {
    database.close();
    throw error;
  }
}
