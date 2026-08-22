import assert from "node:assert/strict";
import test from "node:test";

import { toCodexStreamEvent } from "../dist-electron/electron/services/codex-service.js";

const turnId = "turn-stream-test";

test("官方文字、计划和文件差异通知转换为稳定的渲染事件", () => {
  assert.deepEqual(toCodexStreamEvent("item/agentMessage/delta", {
    turnId,
    itemId: "message-1",
    delta: "正在处理",
  }, turnId), {
    type: "message-delta",
    turnId,
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
    itemId: "message-1",
    text: "最终回答",
  });

  assert.deepEqual(toCodexStreamEvent("turn/completed", {
    turnId,
    turn: { id: turnId, status: "failed", error: { message: "测试失败" } },
  }, turnId), {
    type: "turn-completed",
    turnId,
    status: "failed",
    error: "测试失败",
  });
});
