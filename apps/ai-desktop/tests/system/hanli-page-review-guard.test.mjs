import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const result = await build({
  entryPoints: [fileURLToPath(new URL("../../electron/system/ipc/hanli-page-review-guard.ts", import.meta.url))],
  bundle: true, format: "cjs", platform: "node", packages: "external", write: false,
});
const compiled = { exports: {} };
new Function("require", "module", "exports", result.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const { HanliPageReviewGuard } = compiled.exports;

test("韩立检查正式页面期间拒绝目录和文件浏览", () => {
  const guard = new HanliPageReviewGuard();
  guard.begin(1);
  assert.equal(guard.isReviewing(1), true);
  assert.equal(guard.isReviewing(2), false);
  assert.throws(() => guard.assertWorkspaceDirectoryAllowed(1), /不能浏览工作区目录/);
  assert.throws(() => guard.assertWorkspaceFileAllowed(1), /不能打开工作区文件/);
  assert.doesNotThrow(() => guard.assertIpcAllowed(1, "desktop:get-collaboration-state"));
  assert.throws(() => guard.assertIpcAllowed(1, "desktop:submit-collaboration-task"), /不能修改正式业务数据/);
});

test("页面检查结束后不限制客户正常工作区操作", () => {
  const guard = new HanliPageReviewGuard();
  guard.begin(1);
  guard.end(1);
  assert.equal(guard.isReviewing(1), false);
  assert.doesNotThrow(() => guard.assertWorkspaceDirectoryAllowed(1));
  assert.doesNotThrow(() => guard.assertWorkspaceFileAllowed(1));
});

test("正式验收窗口不接收后台实时阶段覆盖，只接受场景专用快照", () => {
  const runtime = readFileSync(new URL("../../electron/system/bootstrap/application-runtime.ts", import.meta.url), "utf8");
  const ipc = readFileSync(new URL("../../electron/system/ipc/domains/register-codex-ipc.ts", import.meta.url), "utf8");
  assert.match(runtime, /collaboration-timeline-changed", event\)/);
  assert.match(runtime, /desktop:collaboration-state", \{ state, reason, taskIds \}/);
  assert.match(runtime, /desktop:evolution-state", \{ state, reason, topicId, proposalId \}/);
  assert.equal((runtime.match(/!hanliPageReviewGuard\.isReviewing\(window\.webContents\.id\)/g) || []).length, 3);
  assert.match(runtime, /window\.isDestroyed\(\) \|\| hanliPageReviewGuard\.isReviewing\(window\.webContents\.id\)/);
  assert.match(ipc, /if \(hanliPageReviewGuard\.isReviewing\(event\.sender\.id\)\) return \[\];/);
});
