import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
async function load(file) {
  const result = await build({ entryPoints: [file], bundle: true, platform: "node", format: "esm", write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}
const { summarizeTestFailure } = await load("electron/services/support/capabilities/testing/internal/test-failure-summary.ts");
const { TestResourceCoordinatorFacade } = await load("electron/services/support/capabilities/testing/test-resource-coordinator.facade.ts");
const longFailure = "package:mac:developer 失败：" + "normal build output\n".repeat(400) + "ERROR: final packaging cause";
test("长摘要保留命令、最终错误并明确省略中段", () => {
  const result = summarizeTestFailure(longFailure);
  assert.ok(result.startsWith("package:mac:developer"));
  assert.ok(result.endsWith("ERROR: final packaging cause"));
  assert.ok(result.includes("中间输出已省略"));
  assert.equal(result.length, 2000);
  assert.equal(summarizeTestFailure(result), result);
});
test("短摘要与边界消息不改变", () => {
  for (const value of ["", "具体错误", "x".repeat(2000)]) assert.equal(summarizeTestFailure(value), value);
});
test("真实失败事件保留最终错误、抛出原异常并释放租约", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "failure-summary-"));
  try {
    const events = [];
    const coordinator = new TestResourceCoordinatorFacade({ coordinationRoot: root, recordEvent: (type, details) => events.push({ type, ...details }) });
    const original = new Error(longFailure);
    await assert.rejects(coordinator.run({ runId: "test-failure", taskId: "test-failure", initiatorMemberId: "test", kind: "task-validation", port: 4197, buildRoot: path.join(root, "build") }, async () => { throw original; }), error => error === original);
    const failed = events.find(event => event.type === "test.resource.failed");
    assert.ok(failed.detail.endsWith("ERROR: final packaging cause"));
    assert.equal(coordinator.state().holder, null);
    assert.equal(coordinator.state().localQueueDepth, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
