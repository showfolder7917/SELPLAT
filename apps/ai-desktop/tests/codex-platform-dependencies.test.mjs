import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
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
