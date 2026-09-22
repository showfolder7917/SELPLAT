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

test("unknown-turn 与未核验内容不被伪装成恢复成功", () => {
  assert.match(source, /unknown\[\\s-\]\*turn/);
  assert.match(source, /status: "unknown-turn"/);
  assert.match(source, /status: "verification-incomplete"/);
  assert.match(source, /未将空结果显示为已恢复/);
});
