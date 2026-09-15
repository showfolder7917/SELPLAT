import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

const result = await build({
  entryPoints: [fileURLToPath(new URL("../../../src/features/collaboration/model/recovery-operation.ts", import.meta.url))],
  bundle: true, format: "cjs", platform: "node", packages: "external", write: false,
});
const compiled = { exports: {} };
new Function("require", "module", "exports", result.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const { continueTaskWithRecovery } = compiled.exports;

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => { resolve = nextResolve; reject = nextReject; });
  return { promise, resolve, reject };
}

const queuedTimeline = (taskId) => ({ timeline: { groups: [{ nodes: [{ taskId, eventType: "task.recovery_requested" }] }] } });
const emptyTimeline = { timeline: { groups: [] } };
const nextTick = () => new Promise((resolve) => setTimeout(resolve, 0));

test("恢复正常返回只提交一次，并异步刷新权威状态", async () => {
  let submissions = 0;
  let refreshes = 0;
  const result = await continueTaskWithRecovery("task-a", {
    continueTask: async () => { submissions += 1; },
    refreshRecoveryState: async () => { refreshes += 1; return emptyTimeline; },
  });
  await nextTick();
  assert.deepEqual(result, { kind: "confirmed", message: "" });
  assert.equal(submissions, 1);
  assert.equal(refreshes, 1);
});

test("恢复超时后复查排队事实，不取消或重派原请求", async () => {
  const submitted = deferred();
  let submissions = 0;
  const result = await continueTaskWithRecovery("task-a", {
    continueTask: () => { submissions += 1; return submitted.promise; },
    refreshRecoveryState: async () => queuedTimeline("task-a"),
    requestTimeoutMs: 0,
  });
  submitted.resolve();
  assert.deepEqual(result, { kind: "queued", message: "恢复请求已提交，正在排队。" });
  assert.equal(submissions, 1);
});

test("恢复超时且复查未返回时结束等待并给出可读结果", async () => {
  const submitted = deferred();
  const recheck = deferred();
  let submissions = 0;
  const result = await continueTaskWithRecovery("task-a", {
    continueTask: () => { submissions += 1; return submitted.promise; },
    refreshRecoveryState: () => recheck.promise,
    requestTimeoutMs: 0,
    recheckTimeoutMs: 0,
  });
  submitted.resolve();
  recheck.resolve(emptyTimeline);
  assert.deepEqual(result, { kind: "unavailable", message: "恢复请求未取消，但状态确认未返回。" });
  assert.equal(submissions, 1);
});

test("恢复请求异常保留给页面错误处理，并且不会自动重派", async () => {
  let submissions = 0;
  await assert.rejects(
    () => continueTaskWithRecovery("task-a", {
      continueTask: async () => { submissions += 1; throw new Error("恢复失败"); },
      refreshRecoveryState: async () => emptyTimeline,
    }),
    /恢复失败/,
  );
  assert.equal(submissions, 1);
});
