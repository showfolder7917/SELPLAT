import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const source = readFileSync(path.join(appRoot, "electron/services/support/platform/codex/codex.facade.ts"), "utf8");

test("Codex 线程恢复区分已核对、原线程缺失与可重试失败", () => {
  assert.match(source, /action: "resumed"[\s\S]*?status: "verified"/);
  assert.match(source, /action: "missing_on_resume"[\s\S]*?status: "thread-unavailable"/);
  assert.match(source, /action: "resume_failed"[\s\S]*?status: "retryable"/);
  assert.match(source, /原线程不可恢复；既有会话历史仍可阅读/);
});

test("启动恢复只恢复已有线程，不发送消息或创建替代线程", () => {
  assert.match(source, /async recoverExistingSession\([\s\S]*?this\.#request\("thread\/resume"/);
  assert.doesNotMatch(source.match(/async recoverExistingSession\([\s\S]*?\n  }\n\n  \/\*\* 只报告/)?.[0] || "", /thread\/start/);
  assert.doesNotMatch(source.match(/async recoverExistingSession\([\s\S]*?\n  }\n\n  \/\*\* 只报告/)?.[0] || "", /turn\/start/);
  assert.match(source, /status: "thread-unavailable"[\s\S]*?successorThreadId: null/);
  assert.match(source, /status: "retryable"[\s\S]*?return recovery/);
  assert.match(source, /#threadAttached\) \{[\s\S]*?status: "verified"/);
});

test("业务会话恢复只 resume 已关联线程，待业务服务确认后才接管人物当前线程", () => {
  const recovery = source.match(/async recoverConversationSession\([\s\S]*?\n  }\n\n  \/\*\* 业务服务完成会话一致性核对/ )?.[0] || "";
  assert.match(recovery, /this\.#request\("thread\/resume", \{ threadId: session\.threadId \}\)/);
  assert.doesNotMatch(recovery, /thread\/start|turn\/start|#rememberThread/);
  assert.match(source, /activateRecoveredConversationSession\(threadId: string[\s\S]*?this\.#rememberThread/);
  assert.match(source, /status: "verification-incomplete"[\s\S]*?未将其显示为已恢复/);
});

test("unknown-turn 与未核验内容不被伪装成恢复成功", () => {
  assert.match(source, /unknown\[\\s-\]\*turn/);
  assert.match(source, /status: "unknown-turn"/);
  assert.match(source, /status: "verification-incomplete"/);
  assert.match(source, /未将空结果显示为已恢复/);
});

test("结构化 WARN 保留为诊断，不覆盖子进程退出原因", () => {
  assert.match(source, /#lastHarnessDiagnostic/);
  assert.match(source, /action: "harness_diagnostic"/);
  assert.match(source, /codexStderrSeverity\(diagnostic\) !== "warn"/);
  assert.match(source, /const exit = `Codex harness exited/);
  assert.match(source, /function codexStderrSeverity\(message: string\): "warn" \| "error"/);
  assert.match(source, /\.level\)\?\.toUpperCase\(\) === "WARN"/);
});
