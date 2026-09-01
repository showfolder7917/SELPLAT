import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { projectPaths } from "./test-paths.mjs";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Codex 运行时已经成为 platform/codex 的内部解析器，测试只直接读取 internal 来验证固定版本安全契约。
const source = await readFile(path.join(appRoot, "electron", "services", "platform", "codex", "internal", "codex-runtime.resolver.ts"), "utf8");
// 运行断言读取本轮真实 Electron 构建产物，避免旧路径兼容文件掩盖迁移错误。
const { CODEX_TARGET_VERSION, resolveCodexRuntime } = await import("../../../build/ai-desktop/electron/electron/services/support/platform/codex/internal/codex-runtime.resolver.js");

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
