import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { syncMonitorAcceptanceTimeline } from "../../scripts/monitor-acceptance-card.timeline.mjs";

test("监控验收时间线原子封存原运行，保留无关卡点并只建立待验收事实", () => {
  const database = new DatabaseSync(":memory:");
  try {
    database.exec(`CREATE TABLE AiDesktopTaskTimelineTopic (
      groupId TEXT PRIMARY KEY, topicId TEXT, proposalId TEXT, title TEXT, status TEXT, summary TEXT,
      revision INTEGER DEFAULT 0, startedAt TEXT, updatedAt TEXT, createdAt TEXT);
      CREATE TABLE AiDesktopTaskTimelineEvent (
      factId TEXT PRIMARY KEY, groupId TEXT, proposalId TEXT, taskId TEXT, nodeId TEXT,
      sourceFactKey TEXT UNIQUE, sequenceNumber INTEGER, eventType TEXT, contentRole TEXT,
      detailRole TEXT, schemaVersion INTEGER, kind TEXT, actorMemberId TEXT, actorDisplayName TEXT,
      recipientsJson TEXT, status TEXT, action TEXT, summary TEXT, content TEXT, detail TEXT,
      startedAt TEXT, completedAt TEXT, automaticOpen INTEGER, manualApprovalProposalId TEXT,
      occurredAt TEXT, committedAt TEXT);`);
    const oldRunId = randomUUID();
    const now = "2026-09-19T07:00:00.000Z";
    database.prepare("INSERT INTO AiDesktopTaskTimelineTopic(groupId,status) VALUES (?,?)").run("topic:old", "blocked");
    database.prepare("INSERT INTO AiDesktopTaskTimelineTopic(groupId,status) VALUES (?,?)").run("checkpoint:old", "blocked");
    database.prepare("INSERT INTO AiDesktopTaskTimelineTopic(groupId,status) VALUES (?,?)").run("checkpoint:unrelated", "blocked");
    database.prepare("INSERT INTO AiDesktopTaskTimelineEvent(factId,groupId,detail,sequenceNumber) VALUES (?,?,?,1)")
      .run("old-fact", "checkpoint:old", `原运行：${oldRunId}`);
    database.prepare("INSERT INTO AiDesktopTaskTimelineEvent(factId,groupId,detail,sequenceNumber) VALUES (?,?,?,1)")
      .run("unrelated-fact", "checkpoint:unrelated", "原运行：different-run");
    const input = {
      previousRun: { runId: oldRunId, topicId: "old" }, retiredRunIds: new Set([oldRunId]),
      retiredReason: "原运行已封存", resultSummary: "等待真实验收", evidence: ["签名包已发布"],
      next: { updatedAt: now }, newTopic: { topicId: "new", title: "独立验收", createdAt: now, updatedAt: now },
      newProposal: { proposalId: "new-proposal" },
    };
    database.exec("BEGIN IMMEDIATE");
    syncMonitorAcceptanceTimeline(database, input);
    database.exec("COMMIT");
    assert.equal(database.prepare("SELECT status FROM AiDesktopTaskTimelineTopic WHERE groupId='topic:old'").get().status, "cancelled");
    assert.equal(database.prepare("SELECT status FROM AiDesktopTaskTimelineTopic WHERE groupId='checkpoint:old'").get().status, "cancelled");
    assert.equal(database.prepare("SELECT status FROM AiDesktopTaskTimelineTopic WHERE groupId='checkpoint:unrelated'").get().status, "blocked");
    assert.equal(database.prepare("SELECT status FROM AiDesktopTaskTimelineTopic WHERE groupId='topic:new'").get().status, "verifying");
    const event = database.prepare("SELECT eventType,status,content,detail FROM AiDesktopTaskTimelineEvent WHERE groupId='topic:new'").get();
    assert.deepEqual({ ...event }, { eventType: "acceptance.received", status: "waiting", content: "等待真实验收", detail: "签名包已发布" });
    database.exec("BEGIN IMMEDIATE");
    syncMonitorAcceptanceTimeline(database, input);
    database.exec("COMMIT");
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM AiDesktopTaskTimelineEvent WHERE groupId='topic:new'").get().count, 1);
  } finally {
    database.close();
  }
});
