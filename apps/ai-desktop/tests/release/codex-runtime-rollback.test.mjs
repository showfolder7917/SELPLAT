import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const rollback = readFileSync(new URL("../../scripts/rollback-codex-runtime.mjs", import.meta.url), "utf8");
const manifest = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));

test("Codex 回退只能在明确确认和保留失败证据后恢复登记的 0.149.0 文件", () => {
  assert.equal(manifest.scripts["rollback:codex-runtime"], "node scripts/rollback-codex-runtime.mjs");
  assert.match(rollback, /--confirm-rollback-to-0\.149\.0/);
  assert.match(rollback, /--failure-evidence-dir/);
  assert.match(rollback, /assertWorkspaceDataPath/);
  assert.match(rollback, /targetVersion = "0\.149\.0"/);
  assert.match(rollback, /candidateVersion = "0\.154\.0"/);
  assert.match(rollback, /package-lock-only/);
  assert.match(rollback, /rollbackWrites/);
  assert.match(rollback, /NPM_CONFIG_CACHE/);
  assert.doesNotMatch(rollback, /git reset|git checkout|git restore/);
});
