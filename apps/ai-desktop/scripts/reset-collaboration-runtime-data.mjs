import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const userDataArgument = process.argv.find((value) => value.startsWith("--user-data-dir="));
const databaseArgument = process.argv.find((value) => value.startsWith("--database-file="));
if (!userDataArgument || !databaseArgument || !process.argv.includes("--preserve-conversations")) {
  throw new Error("必须显式提供 --user-data-dir=<目录>、--database-file=<文件> 和 --preserve-conversations。");
}
const userDataRoot = path.resolve(userDataArgument.slice("--user-data-dir=".length));
if (path.basename(userDataRoot) !== "ai-desktop") throw new Error("只允许清理名称为 ai-desktop 的 userData 目录。");
const databasePath = path.resolve(databaseArgument.slice("--database-file=".length));
if (path.basename(databasePath) !== "events.sqlite3" || path.basename(path.dirname(databasePath)) !== "db") throw new Error("只允许清理 db/events.sqlite3。");
const collaborationRoot = path.join(userDataRoot, "collaboration");
const now = new Date().toISOString();

const collaborationPath = path.join(collaborationRoot, "collaboration-state.json");
const collaboration = readJson(collaborationPath);
collaboration.tasks = [];
collaboration.integrationBatches = [];
collaboration.nextIntegrationGeneration = 1;
collaboration.updatedAt = now;
for (const member of collaboration.members) {
  member.state = member.kind === "conversation-owner" ? "conversation" : "idle";
  member.role = member.kind === "conversation-owner" ? "conversation" : null;
  member.phase = null;
  member.currentTaskId = null;
  member.blockingReason = null;
  member.lastHeartbeatAt = null;
  member.lastProtocolProgressAt = null;
  member.updatedAt = now;
}
writeJson(collaborationPath, collaboration);

const nangongPath = path.join(collaborationRoot, "nangong-evolution.json");
const nangong = readJson(nangongPath);
const preservedConversation = structuredClone(nangong.conversation);
nangong.version = 8;
nangong.preferenceSnapshotVersion = 0;
nangong.activeTopicId = null;
nangong.topics = [];
nangong.proposals = [];
nangong.deliberations = [];
nangong.archiveRecords = [];
nangong.automationRuntime = { status: "idle", completedRounds: 0, correctionRounds: 0, stopReason: null, startedAt: null, pausedAt: null };
nangong.conversation = preservedConversation;
nangong.updatedAt = now;
writeJson(nangongPath, nangong);

const linghuPath = path.join(collaborationRoot, "linghu-automation.json");
const linghu = readJson(linghuPath);
Object.assign(linghu, {
  cycle: 1, currentModule: "flow-completion", activeTaskId: null, pendingRepairProposalId: null,
  recoveryAttemptCount: 0, currentFaultFingerprint: null, recoveryAttemptsByFingerprint: {},
  detectionCursor: null, flowSnapshots: [], testResourceState: null, recoveryCheckpoint: null,
  lastDispatchAt: null, lastCompletedAt: null, lastCheckedAt: null,
  blockingReason: linghu.enabled ? null : "自动执行已关闭", lastFeedback: null, lastModuleReport: null, updatedAt: now,
});
writeJson(linghuPath, linghu);
copyFileSync(linghuPath, `${linghuPath}.bak`);

for (const disposable of [path.join(collaborationRoot, "sessions"), path.join(collaborationRoot, "releases")]) {
  if (existsSync(disposable)) rmSync(disposable, { recursive: true, force: true });
  mkdirSync(disposable, { recursive: true });
}

// 会话原文、主题和 Codex 页面归档是用户长期记忆；其余运行投影清空后由新任务重新建立。
const database = new DatabaseSync(databasePath);
database.exec("PRAGMA foreign_keys = ON");
database.exec("BEGIN IMMEDIATE");
try {
  for (const table of [
    "AiDesktopEvolutionRoundTask", "AiDesktopEvolutionRound", "AiDesktopEvolutionArchiveRecord",
    "AiDesktopEvolutionSourceSnapshot", "AiDesktopEvolutionDeliberation", "AiDesktopApprovalGovernance",
    "AiDesktopApprovalRecord", "AiDesktopTaskExecution", "AiDesktopWorkflowRun", "AiDesktopMemberRuntime",
    "AiDesktopRuntimeSession", "AiDesktopEvent",
  ]) database.exec(`DELETE FROM ${table}`);
  database.exec("COMMIT");
} catch (error) {
  database.exec("ROLLBACK");
  database.close();
  throw error;
}
database.close();
process.stdout.write(JSON.stringify({ resetAt: now, preservedConversationMessages: preservedConversation.messages.length, linghuEnabled: linghu.enabled, operationalDatabaseReset: true }));

function readJson(filePath) {
  const value = JSON.parse(readFileSync(filePath, "utf8"));
  if (!value || typeof value !== "object") throw new Error(`运行状态格式无效：${path.basename(filePath)}`);
  return value;
}

function writeJson(filePath, value) {
  const temporary = `${filePath}.reset.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(temporary, filePath);
}
