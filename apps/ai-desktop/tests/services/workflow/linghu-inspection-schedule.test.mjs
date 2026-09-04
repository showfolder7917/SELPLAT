import assert from "node:assert/strict";
import test from "node:test";
import { LinghuAutomationStore } from "../../../../../build/ai-desktop/electron/electron/services/personas/linghu/internal/linghu-automation.store.js";
import { LinghuAutomationFacade } from "../../../../../build/ai-desktop/electron/electron/services/personas/linghu/linghu-automation.facade.js";

function fixture() {
  let saved;
  const persistence = { primaryExists: () => Boolean(saved), read: () => structuredClone(saved), readBackup: () => null, write: (value) => { saved = structuredClone(value); } };
  const store = new LinghuAutomationStore(persistence);
  const facade = new LinghuAutomationFacade({ store,
    collaboration: { state: () => ({ mode: "collaboration", tasks: [], members: [] }), setMode() {}, submitTask() { throw Error("巡检不能无证据创建任务"); } },
    locale: () => "zh-CN", readWorkspaceState: () => ({ roots: [] }), recordEvent() {},
    readTestResourceState: () => ({ holder: null, waiters: [], localQueueDepth: 0, lastEvent: null }), runUnifiedTestAndRestart: async () => {},
  });
  return { facade, store, persistence };
}

test("巡检完成后发布真实一分钟时间，关闭取消计划且保留任务恢复点", async () => {
  const { facade, store, persistence } = fixture();
  try {
    store.setEnabled(true);
    await facade.checkNow();
    const state = facade.state();
    assert.equal(state.checking, false);
    assert.equal(state.pollIntervalMs, 60_000);
    assert.ok(Date.parse(state.nextCheckAt) - Date.now() > 59_000);
    assert.ok(Date.parse(state.nextCheckAt) - Date.now() <= 60_000);
    const recovery = state.recoveryCheckpoint;
    facade.setEnabled(false);
    assert.equal(facade.state().nextCheckAt, null);
    assert.equal(facade.state().recoveryCheckpoint, recovery);
    const restored = new LinghuAutomationStore(persistence).state();
    assert.equal(restored.pollIntervalMs, 60_000);
    assert.equal(restored.checking, false);
    assert.equal(restored.nextCheckAt, null);
  } finally { facade.stop(); }
});

test("令狐新建展示会话只改变显示边界，任务和倒计时不变且重启保持", async () => {
  const { facade, store, persistence } = fixture();
  try {
    store.setEnabled(true);
    await facade.checkNow();
    const before = facade.state();
    const after = facade.newDisplayConversation();
    assert.ok(after.displayConversationStartedAt);
    for (const key of Object.keys(before).filter((key) => !["updatedAt", "displayConversationStartedAt"].includes(key))) assert.deepEqual(after[key], before[key], key);
    assert.equal(new LinghuAutomationStore(persistence).state().displayConversationStartedAt, after.displayConversationStartedAt);
  } finally { facade.stop(); }
});
