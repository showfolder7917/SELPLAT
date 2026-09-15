import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

const result = await build({
  entryPoints: [fileURLToPath(new URL("../../../src/applications/developer/explorer/file-operation-timeout.ts", import.meta.url))],
  bundle: true, format: "cjs", platform: "node", packages: "external", write: false,
});
const compiled = { exports: {} };
new Function("require", "module", "exports", result.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const { FileOperationTimeoutError, waitForFileOperation } = compiled.exports;

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => { resolve = nextResolve; reject = nextReject; });
  return { promise, resolve, reject };
}

test("文件操作正常返回时保留主进程结果", async () => {
  assert.equal(await waitForFileOperation(Promise.resolve("preview"), "ignored", 10), "preview");
});

test("文件操作超时只结束页面等待，迟到拒绝不会成为未处理异常", async () => {
  const request = deferred();
  await assert.rejects(
    () => waitForFileOperation(request.promise, "文件打开未及时返回，可重试。", 0),
    (error) => error instanceof FileOperationTimeoutError && error.message === "文件打开未及时返回，可重试。",
  );
  request.reject(new Error("迟到失败"));
  await new Promise((resolve) => setTimeout(resolve, 0));
});
