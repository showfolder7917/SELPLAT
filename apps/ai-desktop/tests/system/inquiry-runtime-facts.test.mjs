import assert from "node:assert/strict";
import { build } from "esbuild";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const bundle = await build({ entryPoints: [fileURLToPath(new URL("../../electron/system/bootstrap/inquiry-runtime-facts.ts", import.meta.url))], bundle: true, format: "esm", platform: "node", write: false });
const { createInquiryRuntimeFacts } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
const projectRoot = path.resolve("acceptance-project");
const runtime = { projectRoot, processId: 123, applicationRoot: "current-app", rendererRoot: "current-renderer", version: "1.0", sourceSha: null, capturedAt: "2026-09-12T10:23:00Z" };
const workspace = (root) => ({ primaryId: "current", roots: [{ id: "current", name: "current", path: root, permission: "read-only" }] });

test("同一调查工程得到宿主身份，未知提交不伪造，证据不冒充页面通过", () => {
  const facts = createInquiryRuntimeFacts(workspace(projectRoot), runtime);
  assert.equal(facts.status, "observed");
  assert.deepEqual(facts.identity, runtime);
  assert.equal(facts.identity.sourceSha, null);
  assert.match(facts.limitation, /不代表页面操作/);
});

test("其他工程、仅父目录和同名前缀不接收运行路径", () => {
  for (const root of [path.resolve("different"), `${projectRoot}-other`, path.dirname(projectRoot)]) {
    const facts = createInquiryRuntimeFacts(workspace(root), runtime);
    assert.equal(facts.status, "unavailable");
    assert.equal(facts.identity, undefined);
    assert.doesNotMatch(JSON.stringify(facts), /current-app|current-renderer/);
  }
});

test("提供身份不修改原请求的工作区或追加应用包读取范围", () => {
  const original = workspace(projectRoot);
  const before = structuredClone(original);
  const facts = createInquiryRuntimeFacts(original, runtime);
  assert.deepEqual(original, before);
  assert.notEqual(facts.identity, runtime);
});
