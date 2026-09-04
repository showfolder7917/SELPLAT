import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { controlledTestRoot } from "#test-paths";
import { summarizeValidationFailure } from "../../../../../build/ai-desktop/electron/electron/services/support/capabilities/testing/internal/validation-failure-report.js";

function fixture(run) {
  const root = mkdtempSync(path.join(controlledTestRoot, "failure-report-"));
  try { run(path.join(root, "report.json"), path.join(root, "output.log")); }
  finally { rmSync(root, { recursive: true, force: true }); }
}

test("失败摘要保留断言、定位与附件，不受末尾调试噪音影响", () => fixture((report, log) => {
  writeFileSync(log, "pw:browser noise\n".repeat(10_000));
  writeFileSync(report, JSON.stringify({ suites: [{ title: "会话", specs: [{ title: "新会话隔离", file: "chat.spec.ts", line: 42, column: 3, tests: [{ results: [{ status: "failed", retry: 0, errors: [{ message: "Expected: 0\nReceived: 1" }], attachments: [{ path: "evidence/trace.zip" }] }] }] }] }] }));
  const summary = summarizeValidationFailure(report, log, "尾部噪音");
  for (const text of ["chat.spec.ts:42:3", "Expected: 0", "Received: 1", "evidence/trace.zip", report, log]) assert.ok(summary.includes(text));
  assert.ok(!summary.includes("pw:browser"));
}));

test("没有报告时提取日志前部错误并显式要求继续调查", () => fixture((report, log) => {
  writeFileSync(log, "error TS2322: incompatible\n" + "debug\n".repeat(10_000));
  const summary = summarizeValidationFailure(report, log, "failed");
  assert.match(summary, /TS2322/);
  assert.match(summary, /缺失或不可读/);
  assert.match(summary, /不能据此猜测修改/);
}));

test("大量失败仍有固定上下文预算，保留总数与全文入口", () => fixture((report, log) => {
  writeFileSync(report, JSON.stringify({ errors: Array.from({ length: 5_000 }, () => ({ message: "error ".repeat(1_000) })) }));
  const summary = summarizeValidationFailure(report, log, "failed");
  assert.ok(summary.length < 14_000);
  assert.match(summary, /5000 条/);
  assert.match(summary, /未展开/);
  assert.ok(summary.includes(report));
}));
