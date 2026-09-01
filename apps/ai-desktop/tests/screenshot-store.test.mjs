import assert from "node:assert/strict";
import { access, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { ScreenshotStore } from "../../../build/ai-desktop/electron/electron/services/support/platform/attachments/internal/screenshot.store.js";
import { controlledTestRoot } from "./test-paths.mjs";

const fixtureRoot = path.join(controlledTestRoot, `screenshot-store-test-${process.pid}`);
const onePixelPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

test("截图只落入应用 temp 并可通过附件 ID 安全解析", async () => {
  const store = new ScreenshotStore(fixtureRoot);
  const attachment = await store.save({ originalDataUrl: onePixelPng, annotatedDataUrl: onePixelPng });

  assert.equal(path.relative(store.path, attachment.filePath).startsWith(".."), false);
  assert.deepEqual(await store.resolveAttachmentPaths([attachment.id]), [attachment.filePath]);
  await access(attachment.filePath);
  const index = JSON.parse(await readFile(path.join(store.path, "screenshot-index.json"), "utf8"));
  assert.equal(index.items[attachment.id].filePath, attachment.filePath);
  const info = await store.info();
  assert.equal(info.path, store.path);
  assert.ok(info.fileCount >= 4);
  assert.ok(info.totalBytes > 0);

  await assert.rejects(() => store.resolveAttachmentPaths(["../../outside.png"]), /Invalid screenshot attachment ID/);
  await assert.rejects(() => store.save({ originalDataUrl: "data:image/png;base64,bad", annotatedDataUrl: onePixelPng }), /Invalid original screenshot PNG/);
});

test("一键清理删除 temp 全部内容但保留空目录", async () => {
  const store = new ScreenshotStore(fixtureRoot);
  await store.save({ originalDataUrl: onePixelPng, annotatedDataUrl: onePixelPng });
  const info = await store.clear();

  assert.deepEqual(info, { path: store.path, fileCount: 0, totalBytes: 0 });
  assert.deepEqual(await readdir(store.path), []);
  assert.deepEqual(await store.resolveAttachmentPaths([]), []);
});

test.after(async () => {
  await rm(fixtureRoot, { recursive: true, force: true });
});
