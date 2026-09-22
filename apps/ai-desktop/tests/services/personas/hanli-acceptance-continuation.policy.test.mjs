import assert from "node:assert/strict";
import { build } from "esbuild";
import test from "node:test";
import { fileURLToPath } from "node:url";

const result = await build({
  entryPoints: [fileURLToPath(new URL("../../../electron/services/personas/hanli/internal/acceptance/hanli-acceptance-continuation.policy.ts", import.meta.url))],
  bundle: true, format: "esm", platform: "node", target: "es2022", write: false,
});
const { selectHanliAcceptanceContinuation } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);

const base = {
  completed: false,
  hasArchivedScreenshot: true,
  finishAttempted: false,
  finishRejection: "",
  finalizationAttempted: false,
  correctionAttempted: false,
  observationRecoveryAttempted: false,
};

test("遗漏 finish 只进入 finish-only 回合", () => {
  assert.deepEqual(selectHanliAcceptanceContinuation(base), { kind: "finish-only" });
  assert.equal(selectHanliAcceptanceContinuation({ ...base, finalizationAttempted: true }), null);
});

test("首次被拒绝的 finish 只允许一次纠正回合", () => {
  const rejected = { ...base, finishAttempted: true, finishRejection: "criterion-4 缺少截图" };
  assert.deepEqual(selectHanliAcceptanceContinuation(rejected), { kind: "correction", rejection: "criterion-4 缺少截图" });
  assert.equal(selectHanliAcceptanceContinuation({ ...rejected, correctionAttempted: true }), null);
});

test("没有归档截图时只允许一次重新观察，已经完成时不能续接", () => {
  assert.deepEqual(selectHanliAcceptanceContinuation({ ...base, hasArchivedScreenshot: false }), { kind: "retry-observation" });
  assert.equal(selectHanliAcceptanceContinuation({ ...base, hasArchivedScreenshot: false, observationRecoveryAttempted: true }), null);
  assert.equal(selectHanliAcceptanceContinuation({ ...base, completed: true }), null);
});
