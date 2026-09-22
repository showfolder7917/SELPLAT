import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

const scriptPath = new URL("../../scripts/reset-collaboration-runtime-data.mjs", import.meta.url);
const runtimeTables = [
  "AiDesktopTaskTimelineStream", "AiDesktopTaskTimelineEvent", "AiDesktopTaskTimelineTopic",
  "AiDesktopEvolutionRoundTask", "AiDesktopEvolutionRound", "AiDesktopEvolutionArchiveRecord",
  "AiDesktopEvolutionSourceSnapshot", "AiDesktopEvolutionDeliberation", "AiDesktopApprovalGovernance",
  "AiDesktopApprovalRecord", "AiDesktopTaskExecution", "AiDesktopWorkflowRun", "AiDesktopMemberRuntime",
  "AiDesktopRuntimeSession", "AiDesktopEvent",
];

test("离线清理同时重置旧事件库和当前工作流库，并保留人物会话", () => {
  const root = mkdtempSync(path.join(tmpdir(), "ai-desktop-reset-"));
  const userDataRoot = path.join(root, "ai-desktop");
  const collaborationRoot = path.join(userDataRoot, "collaboration");
  const databaseRoot = path.join(root, "db");
  mkdirSync(collaborationRoot, { recursive: true });
  mkdirSync(databaseRoot, { recursive: true });
  writeFileSync(path.join(collaborationRoot, "collaboration-state.json"), JSON.stringify({
    tasks: [{ taskId: "task-old" }], integrationBatches: [{ batchId: "batch-old" }], nextIntegrationGeneration: 7,
    members: [{ kind: "conversation-owner", state: "busy" }, { kind: "worker", state: "busy" }],
  }));
  writeFileSync(path.join(collaborationRoot, "linghu-automation.json"), JSON.stringify({ enabled: true }));

  const eventsPath = path.join(databaseRoot, "events.sqlite3");
  const events = new DatabaseSync(eventsPath);
  for (const table of [...runtimeTables, "AiDesktopEvolutionState"]) events.exec(`CREATE TABLE ${table} (id TEXT)`);
  events.exec("INSERT INTO AiDesktopEvent VALUES ('old-event')");
  events.close();

  const workflowPath = path.join(databaseRoot, "workflow-control.sqlite3");
  const workflow = new DatabaseSync(workflowPath);
  for (const table of runtimeTables) workflow.exec(`CREATE TABLE ${table} (id TEXT)`);
  workflow.exec("CREATE TABLE AiDesktopEvolutionState (singletonId INTEGER PRIMARY KEY, stateVersion INTEGER NOT NULL, stateJson TEXT NOT NULL, updatedAt TEXT NOT NULL)");
  const originalState = {
    version: 10, automationSettings: { maxRoundsPerTopic: 5 }, automationRuntime: { status: "blocked" },
    oneShotConfirmation: { confirmationId: "confirmation-old" }, oneShotRun: { status: "blocked" },
    technicalRecovery: { issueId: "issue-old" }, automationContext: { workspaceState: { dirty: true }, locale: "ja" },
    preferenceSnapshotVersion: 9, activeTopicId: "topic-old", topics: [{ topicId: "topic-old" }],
    proposals: [{ proposalId: "proposal-old" }], deliberations: [{ deliberationId: "deliberation-old" }],
    archiveRecords: [{ archiveId: "archive-old" }], conversation: { messages: [{ messageId: "message-kept" }] },
  };
  workflow.prepare("INSERT INTO AiDesktopEvolutionState VALUES (1, 4, ?, 'old')").run(JSON.stringify(originalState));
  workflow.exec("INSERT INTO AiDesktopTaskExecution VALUES ('task-old')");
  workflow.close();

  const output = JSON.parse(execFileSync(process.execPath, [scriptPath.pathname,
    `--user-data-dir=${userDataRoot}`, `--database-file=${eventsPath}`,
    `--workflow-database-file=${workflowPath}`, "--preserve-conversations",
  ], { encoding: "utf8" }));
  assert.equal(output.workflowDatabaseReset, true);

  const persistedCollaboration = JSON.parse(readFileSync(path.join(collaborationRoot, "collaboration-state.json"), "utf8"));
  assert.deepEqual(persistedCollaboration.tasks, []);
  assert.equal(persistedCollaboration.members[0].state, "conversation");
  assert.equal(persistedCollaboration.members[1].state, "idle");

  const verifiedWorkflow = new DatabaseSync(workflowPath);
  assert.equal(verifiedWorkflow.prepare("SELECT COUNT(*) AS count FROM AiDesktopTaskExecution").get().count, 0);
  const row = verifiedWorkflow.prepare("SELECT stateVersion, stateJson FROM AiDesktopEvolutionState").get();
  const resetState = JSON.parse(row.stateJson);
  assert.equal(row.stateVersion, 5);
  assert.equal(resetState.activeTopicId, null);
  assert.deepEqual(resetState.topics, []);
  assert.deepEqual(resetState.conversation, originalState.conversation);
  assert.equal(resetState.automationContext.locale, "ja");
  verifiedWorkflow.close();
});
