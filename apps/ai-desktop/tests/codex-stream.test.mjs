import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { createCodexChildEnvironment } from "../../../build/ai-desktop/electron/electron/services/platform/codex/codex.facade.js";
import { toCodexStreamEvent } from "../../../build/ai-desktop/electron/electron/services/platform/codex/internal/codex-stream-event.mapper.js";
import { CodexSessionStore } from "../../../build/ai-desktop/electron/electron/services/platform/codex/internal/codex-session.repository.js";

const turnId = "turn-stream-test";

test("Codex 子进程使用 AI Desktop 专属数据域且不继承宿主来源覆盖", () => {
  const environment = createCodexChildEnvironment({
    PATH: "/runtime/bin",
    CODEX_HOME: "/shared/codex-home",
    CODEX_INTERNAL_ORIGINATOR_OVERRIDE: "Codex Desktop",
    AI_DESKTOP_DEPENDENCY_LEASE_ID: "stale-lease",
  }, "/ai-desktop/codex-home", "task-lease-1");
  assert.equal(environment.CODEX_HOME, "/ai-desktop/codex-home");
  assert.equal(environment.CODEX_INTERNAL_ORIGINATOR_OVERRIDE, undefined);
  assert.equal(environment.PATH, "/runtime/bin");
  assert.equal(environment.AI_DESKTOP_DEPENDENCY_LEASE_ID, "task-lease-1");

  const legacyEnvironment = createCodexChildEnvironment(environment, null);
  assert.equal(legacyEnvironment.CODEX_HOME, undefined);
  assert.equal(legacyEnvironment.CODEX_INTERNAL_ORIGINATOR_OVERRIDE, undefined);
  assert.equal(legacyEnvironment.AI_DESKTOP_DEPENDENCY_LEASE_ID, undefined);
});

test("活动线程存储识别旧默认域记录并只写 AI Desktop 域版本", () => {
  const controlledTempRoot = path.resolve(process.cwd(), "temp", "tests");
  mkdirSync(controlledTempRoot, { recursive: true });
  const fixture = mkdtempSync(path.join(controlledTempRoot, "codex-session-isolation-"));
  const filePath = path.join(fixture, "active-codex-session.json");
  try {
    writeFileSync(filePath, JSON.stringify({ version: 1, threadId: "legacy-thread", workspaceSignature: "legacy-signature" }), "utf8");
    const store = new CodexSessionStore(filePath);
    assert.deepEqual(store.read(), { version: 1, threadId: "legacy-thread", workspaceSignature: "legacy-signature" });

    store.write("isolated-thread", "isolated-signature");
    assert.deepEqual(JSON.parse(readFileSync(filePath, "utf8")), {
      version: 2,
      storageDomain: "ai-desktop",
      threadId: "isolated-thread",
      workspaceSignature: "isolated-signature",
    });
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("官方文字、计划和文件差异通知转换为稳定的渲染事件", () => {
  assert.deepEqual(toCodexStreamEvent("item/agentMessage/delta", {
    turnId,
    itemId: "message-1",
    delta: "正在处理",
  }, turnId), {
    type: "message-delta",
    turnId,
    segmentId: `${turnId}:message-1`,
    itemId: "message-1",
    delta: "正在处理",
  });

  assert.deepEqual(toCodexStreamEvent("turn/plan/updated", {
    turnId,
    plan: [
      { step: "读取文件", status: "completed" },
      { step: "修改代码", status: "inProgress" },
    ],
  }, turnId), {
    type: "plan-updated",
    turnId,
    plan: [
      { step: "读取文件", status: "completed" },
      { step: "修改代码", status: "inProgress" },
    ],
  });

  assert.deepEqual(toCodexStreamEvent("turn/diff/updated", {
    turnId,
    diff: "diff --git a/src/a.ts b/src/a.ts\n+++ b/src/a.ts\ndiff --git a/src/b.ts b/src/b.ts\n+++ b/src/b.ts",
  }, turnId), {
    type: "diff-updated",
    turnId,
    changedFiles: ["src/a.ts", "src/b.ts"],
  });
});

test("命令和文件生命周期可见，但原始推理正文不会暴露给界面", () => {
  const command = toCodexStreamEvent("item/started", {
    turnId,
    item: { id: "command-1", type: "commandExecution", command: ["npm", "test"], status: "inProgress" },
  }, turnId);
  assert.equal(command?.type, "activity");
  assert.equal(command?.activity?.itemType, "commandExecution");
  assert.match(command?.activity?.summary || "", /npm/);

  const fileChange = toCodexStreamEvent("item/completed", {
    turnId,
    item: { id: "files-1", type: "fileChange", status: "completed", changes: [{ path: "src/a.ts", kind: "update" }] },
  }, turnId);
  assert.equal(fileChange?.activity?.phase, "completed");
  assert.equal(fileChange?.activity?.summary, "src/a.ts");

  assert.equal(toCodexStreamEvent("item/reasoning/textDelta", {
    turnId,
    itemId: "reasoning-1",
    delta: "raw reasoning",
  }, turnId), null);
  assert.equal(toCodexStreamEvent("item/reasoning/summaryTextDelta", {
    turnId,
    itemId: "reasoning-1",
    delta: "正在核对接口",
  }, turnId)?.delta, "正在核对接口");
});

test("最终消息和失败状态覆盖增量期间的临时状态", () => {
  assert.deepEqual(toCodexStreamEvent("item/completed", {
    turnId,
    item: { id: "message-1", type: "agentMessage", text: "最终回答" },
  }, turnId), {
    type: "message-completed",
    turnId,
    segmentId: `${turnId}:message-1`,
    itemId: "message-1",
    text: "最终回答",
  });

  assert.deepEqual(toCodexStreamEvent("turn/completed", {
    turnId,
    turn: { id: turnId, status: "failed", error: { message: "测试失败" } },
  }, turnId), {
    type: "turn-completed",
    turnId,
    segmentId: `${turnId}:turn`,
    status: "failed",
    error: "测试失败",
  });
});
