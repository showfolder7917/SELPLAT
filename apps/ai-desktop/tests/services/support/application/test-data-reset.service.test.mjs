import assert from "node:assert/strict";
import test from "node:test";

import { TestDataResetService } from "../../../../../../build/ai-desktop/electron/electron/services/support/application/test-data-reset.service.js";

function fixture(overrides = {}) {
  const calls = [];
  const service = new TestDataResetService({
    stopWriters: () => calls.push("stop"),
    resumeWriters: () => calls.push("resume"),
    disposeRuntime: async () => { calls.push("dispose"); },
    cleanupCandidates: async () => ({ branchCount: 1, worktreeCount: 2, failures: ["一个候选未清理"] }),
    clearStores: async () => {
      calls.push("clear");
      return [{ category: "workflow", clearedRecordCount: 4 }, { category: "evolution", clearedRecordCount: 3 }];
    },
    assertStoresCleared: () => calls.push("assert"),
    createFreshHanliConversation: async () => { calls.push("fresh-hanli"); },
    detachPersistence: () => calls.push("detach"),
    scheduleRestart: (code) => calls.push(`restart:${code}`),
    ...overrides,
  });
  return { calls, service };
}

test("测试数据清理先给出真实分类结果，只有确认后才重启", async () => {
  const { calls, service } = fixture();
  assert.throws(() => service.confirmRestart(), /尚未完成/);
  const result = await service.clear();
  assert.equal(result.clearedRecordCount, 7);
  assert.equal(result.clearedCategories.length, 2);
  assert.equal(result.clearedCandidateWorktreeCount, 2);
  assert.deepEqual(result.candidateCleanupWarnings, ["一个候选未清理"]);
  assert.equal(result.restartRequired, true);
  assert.deepEqual(calls, ["stop", "dispose", "clear", "assert", "fresh-hanli", "detach"]);
  await assert.rejects(service.clear(), /先确认重启/);
  service.confirmRestart();
  assert.equal(calls.at(-1), "restart:0");
});

test("运行时销毁后的清理失败触发受控恢复重启", async () => {
  const { calls, service } = fixture({ clearStores: async () => { throw new Error("清理失败"); } });
  await assert.rejects(service.clear(), /清理失败/);
  assert.deepEqual(calls, ["stop", "dispose", "restart:1"]);
});

test("韩立新空会话切换失败时不提交清空成功结果", async () => {
  const { calls, service } = fixture({ createFreshHanliConversation: async () => { throw new Error("活动会话断言失败"); } });
  await assert.rejects(service.clear(), /活动会话断言失败/);
  assert.deepEqual(calls, ["stop", "dispose", "clear", "assert", "restart:1"]);
  assert.throws(() => service.confirmRestart(), /尚未完成/);
});

test("运行时尚未销毁的清理失败恢复写入者", async () => {
  const { calls, service } = fixture({ disposeRuntime: async () => { throw new Error("停止失败"); } });
  await assert.rejects(service.clear(), /停止失败/);
  assert.deepEqual(calls, ["stop", "resume"]);
});
