import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { ConversationDispatchStore } from "../../../../../../build/ai-desktop/electron/electron/services/support/capabilities/conversation/internal/conversation-dispatch.store.js";
import { controlledTestRoot } from "#test-paths";

const controlledTempRoot = controlledTestRoot;
mkdirSync(controlledTempRoot, { recursive: true });

const request = {
  message: "后续问题",
  locale: "zh-CN",
  sandboxMode: "workspace-write",
  attachmentIds: [],
  executionMode: "task-managed",
};

test("调度状态持久化 FIFO 队列并把进程退出时的运行项恢复为待确认", () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "conversation-dispatch-"));
  const filePath = path.join(directory, "state.json");
  const events = [];
  try {
    const first = new ConversationDispatchStore(filePath, (type, details) => events.push({ type, details }));
    const activeId = first.begin({ ...request, message: "正在执行" }, "active-1");
    const queuedA = first.enqueue({ ...request, message: "排队一" }, "排队一");
    const queuedB = first.enqueue({ ...request, message: "排队二" }, "排队二");
    assert.equal(activeId, "active-1");
    assert.deepEqual(first.state().queue.map((item) => item.id), [queuedA.id, queuedB.id]);

    const restored = new ConversationDispatchStore(filePath, (type, details) => events.push({ type, details }));
    assert.equal(restored.state().activeTask?.status, "recoverable");
    const recovered = restored.recover();
    assert.equal(restored.state().activeTask, null);
    assert.equal(restored.state().queue[0]?.id, recovered.id);
    assert.match(restored.state().queue[0]?.request.message || "", /继续执行上次未完成的任务/);
    assert.ok(events.some((event) => event.type === "dispatch.recovery_detected"));
    assert.ok(events.some((event) => event.type === "dispatch.recovery_queued"));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("补充或移除只消费指定队列项，不改变其余 FIFO 顺序", () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "conversation-dispatch-"));
  try {
    const store = new ConversationDispatchStore(path.join(directory, "state.json"));
    const first = store.enqueue({ ...request, message: "一" }, "一");
    const second = store.enqueue({ ...request, message: "二" }, "二");
    store.removeQueued(first.id, "supplemented");
    assert.deepEqual(store.state().queue.map((item) => item.id), [second.id]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
