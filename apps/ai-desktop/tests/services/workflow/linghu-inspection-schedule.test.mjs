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

test("令狐巡检会把韩立调查回包错误作为普通运行异常派发，不伪造卡点", async () => {
  let saved;
  const submitted = [], claimed = [];
  const persistence = { primaryExists: () => Boolean(saved), read: () => structuredClone(saved), readBackup: () => null, write: (value) => { saved = structuredClone(value); } };
  const store = new LinghuAutomationStore(persistence);
  const collaborationState = { mode: "collaboration", tasks: [], members: [] };
  const issue = {
    eventId: "event-inquiry-json", correlationId: "conversation-1", sourceType: "member", sourceId: "han-li",
    eventType: "hanli.inquiry.failed", category: "technical-error", severity: "error", status: "open", flowImpact: "none",
    message: "Unexpected token '我' is not valid JSON", payload: { requestId: "u1", flowImpact: "none" }, fingerprint: null,
    occurredAt: "2026-09-05T05:50:37.957Z", handlingOwnerId: null, handlingStartedAt: null,
  };
  const facade = new LinghuAutomationFacade({
    store,
    collaboration: {
      state: () => collaborationState,
      setMode() {},
      submitTask(request) { submitted.push(request); collaborationState.tasks.push({ taskId: "repair-1" }); return collaborationState; },
    },
    locale: () => "zh-CN", readWorkspaceState: () => ({ roots: [] }), recordEvent() {},
    readTestResourceState: () => ({ holder: null, waiters: [], localQueueDepth: 0, lastEvent: null }), runUnifiedTestAndRestart: async () => {},
    readUnhandledExceptions: () => [issue],
    claimUnhandledExceptions: (eventIds) => { claimed.push(...eventIds); issue.status = "processing"; return eventIds; },
  });
  try {
    store.setEnabled(true);
    await facade.checkNow();
    assert.equal(submitted.length, 1);
    assert.match(submitted[0].title, /运行异常修复/);
    assert.match(submitted[0].confirmedIntent, /不是卡点/);
    assert.match(submitted[0].confirmedIntent, /event-inquiry-json/);
    assert.deepEqual(claimed, ["event-inquiry-json"]);
    assert.equal(facade.state().activeTaskId, "repair-1");
  } finally { facade.stop(); }
});
