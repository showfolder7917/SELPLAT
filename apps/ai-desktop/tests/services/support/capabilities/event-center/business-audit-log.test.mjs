import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { BusinessAuditLog } from "../../../../../../../build/ai-desktop/electron/electron/services/support/capabilities/event-center/internal/audit/business-audit-log.js";
import { controlledTestRoot } from "#test-paths";

const controlledTempRoot = controlledTestRoot;
mkdirSync(controlledTempRoot, { recursive: true });

test("业务日志把代码级验证缺失标记为部分完成，而不把待构建误判为失败", () => {
  const appRoot = mkdtempSync(path.join(controlledTempRoot, "audit-log-test-"));
  try {
    const sourceFile = path.join(appRoot, "src", "example.tsx");
    const buildRoot = path.join(appRoot, "build-output");
    const logRoot = path.join(appRoot, "audit-output");
    const bundleFile = path.join(buildRoot, "renderer", "developer", "index.html");
    mkdirSync(path.dirname(sourceFile), { recursive: true });
    mkdirSync(path.dirname(bundleFile), { recursive: true });
    writeFileSync(bundleFile, "old bundle", "utf8");
    writeFileSync(sourceFile, "new source", "utf8");
    const oldTime = new Date(Date.now() - 60_000);
    utimesSync(bundleFile, oldTime, oldTime);

    const audit = new BusinessAuditLog(appRoot, buildRoot, logRoot);
    const taskId = audit.startTask({
      message: "修改资源管理区折叠",
      locale: "zh-CN",
      sandboxMode: "workspace-write",
      workspaces: { primaryId: "root", roots: [{ id: "root", name: "SELPLAT", path: appRoot, permission: "workspace-write" }] },
      attachmentCount: 0,
      managedMode: "task-managed",
    });
    audit.recordStreamEvent(taskId, {
      type: "diff-updated",
      turnId: "turn-1",
      changedFiles: ["apps/ai-desktop/src/applications/developer/DeveloperApplication.tsx"],
    });
    audit.finishTask(taskId, "completed");

    const info = audit.info();
    assert.equal(info.latestTask?.status, "partial");
    assert.deepEqual(info.latestTask?.changedFiles, ["apps/ai-desktop/src/applications/developer/DeveloperApplication.tsx"]);
    const codes = info.latestTask?.reasons.map((reason) => reason.code) || [];
    assert.ok(codes.includes("static_check_not_observed"));
    assert.ok(codes.includes("targeted_test_not_observed"));
    assert.ok(!codes.includes("ai_desktop_source_changed_without_build"));
    const timeline = readFileSync(path.join(info.path, "诊断归档", new Date().toISOString().slice(0, 7), "运行诊断.jsonl"), "utf8");
    assert.match(timeline, /"type":"task\.started"/);
    assert.match(timeline, /"type":"task\.finished"/);
  } finally {
    rmSync(appRoot, { recursive: true, force: true });
  }
});

test("SQLite 事件投影失败不会吞掉 JSONL 原始事实并留下统一持久化失败事件", () => {
  const appRoot = mkdtempSync(path.join(controlledTempRoot, "audit-sink-failure-"));
  try {
    const audit = new BusinessAuditLog(appRoot, path.join(appRoot, "build"), path.join(appRoot, "audit"));
    audit.setEventSink(() => { throw new Error("sqlite unavailable"); });
    assert.doesNotThrow(() => audit.recordEvent("nangong.intent.recorded", { messageId: "message-1" }));
    const timeline = readFileSync(path.join(audit.info().path, "诊断归档", new Date().toISOString().slice(0, 7), "运行诊断.jsonl"), "utf8");
    assert.match(timeline, /"type":"nangong\.intent\.recorded"/);
    assert.match(timeline, /"type":"event-center\.persistence_failed"/);
    assert.match(timeline, /sqlite unavailable/);
  } finally {
    rmSync(appRoot, { recursive: true, force: true });
  }
});
