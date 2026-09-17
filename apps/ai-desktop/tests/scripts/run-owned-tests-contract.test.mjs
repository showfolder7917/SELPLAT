import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const runnerSource = readFileSync(new URL("../../scripts/run-owned-tests.mjs", import.meta.url), "utf8");

test("完整测试收集器为单个用例设置独立时限，避免一条悬空 Promise 耗尽整批时限", () => {
  assert.match(runnerSource, /OWNED_TEST_TIMEOUT_MS\s*=\s*30_000/);
  assert.match(runnerSource, /--test-timeout=\$\{OWNED_TEST_TIMEOUT_MS\}/);
  assert.match(runnerSource, /\.\.\.testFiles/);
});
