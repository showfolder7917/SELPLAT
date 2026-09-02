import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const manifest = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
const lock = JSON.parse(readFileSync(new URL("../../package-lock.json", import.meta.url), "utf8"));
const platformPackages = [
  "@openai/codex-darwin-arm64",
  "@openai/codex-darwin-x64",
  "@openai/codex-win32-x64",
];

test("平台专属 Codex 包保持直接锁定但不阻塞其他平台安装", () => {
  for (const packageName of platformPackages) {
    assert.equal(manifest.dependencies?.[packageName], undefined);
    assert.equal(typeof manifest.optionalDependencies?.[packageName], "string");
    assert.equal(lock.packages[""]?.dependencies?.[packageName], undefined);
    assert.equal(lock.packages[""]?.optionalDependencies?.[packageName], manifest.optionalDependencies[packageName]);
    assert.equal(lock.packages[`node_modules/${packageName}`]?.optional, true);
  }
});

test("Windows 打包入口必须先通过 Windows 原生宿主门禁", () => {
  for (const scriptName of ["dist:win:developer"]) {
    assert.match(manifest.scripts[scriptName], /^node scripts\/assert-package-host\.mjs win32 &&/);
  }
  const guard = readFileSync(new URL("../../scripts/assert-package-host.mjs", import.meta.url), "utf8");
  assert.match(guard, /process\.platform !== expectedPlatform/);
  const result = spawnSync(process.execPath, [fileURLToPath(new URL("../../scripts/assert-package-host.mjs", import.meta.url)), "win32"], { encoding: "utf8" });
  assert.equal(result.status, process.platform === "win32" ? 0 : 1);
  if (process.platform !== "win32") assert.match(result.stderr, /Windows 安装包必须在 Windows 环境构建/);
});
