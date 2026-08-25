import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const applicationRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = path.resolve(applicationRoot, "../..");
const rolloutPath = path.resolve(process.argv[2] || "");
if (!process.argv[2] || !existsSync(rolloutPath)) throw new Error("请传入存在的 Codex rollout JSONL 文件。");

const records = readFileSync(rolloutPath, "utf8").split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line));
const session = records.find((record) => record.type === "session_meta")?.payload;
const threadId = String(session?.session_id || session?.id || "").trim();
if (!threadId) throw new Error("Codex 记录缺少稳定任务 ID。");

const configuration = JSON.parse(readFileSync(path.join(applicationRoot, "db", "ai-memory-paths.json"), "utf8"));
const databaseRoot = path.resolve(String(configuration.databaseRoot));
const databasePath = path.join(databaseRoot, String(configuration.databaseFile));
if (!databasePath.startsWith(`${applicationRoot}${path.sep}`)) throw new Error("回填只允许写入 AI Desktop 已登记数据库目录。");

const databaseModuleUrl = pathToFileURL(path.join(projectRoot, "build", "ai-desktop", "electron", "electron", "services", "event-center", "persistence", "sqlite-database.js")).href;
const { SqliteDatabase } = await import(databaseModuleUrl);
const database = SqliteDatabase.open(databasePath, path.join(databaseRoot, "sql"), !existsSync(databasePath));

try {
  const messages = collectVisibleMessages(records, threadId);
  database.transaction((connection) => {
    const upsert = connection.prepare(`
      INSERT INTO AiDesktopConversationArchiveMessage
        (messageId, threadId, sequenceNumber, sourceRole, responsePhase, content, contentRetention,
         inferredIntent, topicTitle, topicType, createdAt, recordedAt)
      VALUES ($messageId, $threadId, $sequenceNumber, $sourceRole, $responsePhase, $content,
        $contentRetention, $inferredIntent, $topicTitle, $topicType, $createdAt, $recordedAt)
      ON CONFLICT(messageId) DO UPDATE SET
        sequenceNumber=excluded.sequenceNumber, responsePhase=excluded.responsePhase,
        content=excluded.content, contentRetention=excluded.contentRetention,
        inferredIntent=excluded.inferredIntent, topicTitle=excluded.topicTitle,
        topicType=excluded.topicType, createdAt=excluded.createdAt, recordedAt=excluded.recordedAt
    `);
    messages.forEach((message, sequenceNumber) => upsert.run({
      $messageId: message.messageId,
      $threadId: threadId,
      $sequenceNumber: sequenceNumber,
      $sourceRole: message.sourceRole,
      $responsePhase: message.responsePhase,
      $content: message.content,
      $contentRetention: message.contentRetention,
      $inferredIntent: message.inferredIntent,
      $topicTitle: message.topic.title,
      $topicType: message.topic.type,
      $createdAt: message.createdAt,
      $recordedAt: new Date().toISOString(),
    }));
  });
  const userCount = messages.filter((message) => message.sourceRole === "user").length;
  console.log(JSON.stringify({ threadId, databasePath, userCount, codexPreviewCount: messages.length - userCount, total: messages.length, assistantLimit: 80 }));
} finally {
  database.close();
}

/** 只归档页面可见的用户和助手消息；系统规则、环境上下文、工具输出与内部推理全部排除。 */
function collectVisibleMessages(records, threadId) {
  const messages = [];
  let currentTopic = { title: "任务流程记录", type: "协作过程", intent: null };
  for (const record of records) {
    if (record.type !== "response_item" || record.payload?.type !== "message") continue;
    const role = record.payload.role;
    if (role !== "user" && role !== "assistant") continue;
    const rawContent = (record.payload.content || []).map((item) => typeof item.text === "string" ? item.text : "").join("").trim();
    if (!rawContent || (role === "user" && isPlatformContext(rawContent))) continue;
    if (role === "assistant" && !["commentary", "final_answer"].includes(record.payload.phase)) continue;
    if (role === "user") currentTopic = classifyUserMessage(rawContent);
    messages.push({
      messageId: `codex-${threadId}-${record.ordinal}`,
      sourceRole: role === "user" ? "user" : "codex",
      responsePhase: role === "assistant" ? record.payload.phase : null,
      content: role === "user" ? rawContent : preview(rawContent),
      contentRetention: role === "user" ? "exact" : "preview-80",
      inferredIntent: role === "user" ? currentTopic.intent : null,
      topic: currentTopic,
      createdAt: record.timestamp,
    });
  }
  return messages;
}

function classifyUserMessage(content) {
  const rules = [
    [/聊天|对话|意图|话题|主题|回填/u, "对话记忆与用户意图", "记忆演进", "完整登记用户原话、AI 短预览、主题类型和真实意图，形成可供后续演化与审批使用的过程记忆。"],
    [/SELUI|SEL|CSS|tooltip|confirm|prompt|dialog|样式|排版/u, "SELUI 统一承载与友好页面", "界面架构优化", "将可复用视觉和交互归并到 SELUI，并保持页面布局极度用户友好，避免重复维护。"],
    [/SQLite|数据库|H2|DB|表|SQL|dao|service|资料|文件/u, "SQLite 数据与资料架构", "数据架构演进", "建立固定、可恢复且分层清晰的 SQLite 与资料存储架构，并明确分阶段接入范围。"],
    [/异常|日志|卡住|令狐|bug|修正|审计/u, "统一异常入口与令狐持续保障", "稳定性治理", "把异常、日志和卡住状态收敛到统一解耦入口，让令狐持续发现、修正、优化并完成审计闭环。"],
    [/按钮|下拉|刷新|新建对话|删除|页面消息/u, "南宫婉页面交互修正", "交互优化", "让南宫婉页面动作名称、位置、反馈和失败处理清楚一致，避免用户无法判断实际行为。"],
    [/南宫婉|韩立|审批|演化|宗门|启动器|成员/u, "南宫婉专项演化审批闭环", "流程演进", "建立用户、南宫婉、韩立、宗门成员、令狐和演化启动器之间可审批、可分发、可恢复的完整流程。"],
    [/统一测试|测试|接下来|开始|持续做/u, "持续实施与统一验收", "实施推进", "持续推进当前已确认方案，并通过统一测试和失败修正完成最终验收。"],
  ];
  const matched = rules.find(([pattern]) => pattern.test(content));
  if (matched) return { title: matched[1], type: matched[2], intent: matched[3] };
  return { title: "AI Desktop 演化过程", type: "需求确认", intent: `保留本轮原始要求并据此继续调查和推进：${preview(content)}` };
}

function isPlatformContext(content) {
  return content.startsWith("<recommended_plugins>") || content.startsWith("<environment_context>");
}

function preview(content) {
  const normalized = content.replaceAll(/\s+/gu, " ").trim();
  const characters = Array.from(normalized);
  return characters.length <= 80 ? normalized : `${characters.slice(0, 80).join("")}…`;
}
