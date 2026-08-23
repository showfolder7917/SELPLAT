import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { projectPaths } from "./test-paths.mjs";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = await readFile(path.join(appRoot, "electron", "services", "codex-runtime.ts"), "utf8");
const { CODEX_TARGET_VERSION, resolveCodexRuntime } = await import("../../../build/ai-desktop/electron/electron/services/codex-runtime.js");

test("固定 Codex 运行时只选择安装包内置目标版本", async () => {
  const runtime = await resolveCodexRuntime({
    ...process.env,
    CODEX_HOME: path.join(projectPaths.temporaryMaterialsRoot, "测试证据", "codex-runtime-test", "codex-home"),
  });
  assert.equal(CODEX_TARGET_VERSION, "0.149.0");
  assert.equal(runtime.source, "bundled");
  assert.equal(runtime.version, CODEX_TARGET_VERSION);
  assert.match(runtime.command, /node_modules[\\/]@openai[\\/]codex-/);
});

test("源码只声明内置和校验下载两种固定运行时来源", () => {
  assert.match(source, /source: "bundled" \| "downloaded"/);
  assert.match(source, /validatePackageMetadata/);
  assert.match(source, /verifyArchiveIntegrity/);
  assert.match(source, /TeamIdentifier=/);
});
