import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  resolvePublishedRuntimeSourceSha,
  writePublishedRuntimeSourceManifest,
} from "../../electron/system/bootstrap/published-runtime-source.manifest.ts";

test("发布重启只接受与已发布批次清单一致的候选提交", () => {
  const root = mkdtempSync("/private/tmp/ai-desktop-runtime-source-");
  const resourcesPath = path.join(root, "AI Desktop.app", "Contents", "Resources");
  const sourceSha = "b".repeat(40);
  try {
    mkdirSync(resourcesPath, { recursive: true });
    assert.throws(() => resolvePublishedRuntimeSourceSha(resourcesPath, sourceSha), /缺少运行包候选提交清单/);
    writePublishedRuntimeSourceManifest(root, sourceSha);
    assert.equal(resolvePublishedRuntimeSourceSha(resourcesPath, sourceSha), sourceSha);
    assert.throws(() => resolvePublishedRuntimeSourceSha(resourcesPath, "c".repeat(40)), /运行包候选提交不一致/);
    assert.throws(() => resolvePublishedRuntimeSourceSha(resourcesPath, "not-a-sha"), /候选源码提交格式无效/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
