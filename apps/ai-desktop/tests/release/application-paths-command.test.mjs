import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const packageJson = readFileSync(new URL("../../package.json", import.meta.url), "utf8");
const commandSource = readFileSync(new URL("../../scripts/resolve-application-paths.mjs", import.meta.url), "utf8");

test("路径诊断命令通过受控依赖入口解析真实应用名", () => {
  assert.match(packageJson, /"paths:resolve": "node scripts\/run-with-dependencies\.mjs node scripts\/resolve-application-paths\.mjs"/);
  assert.match(commandSource, /resolveApplicationNameFromSourceRoot\(applicationRoot\)/);
  assert.match(commandSource, /resolvePathDiagnosticWorkspaceRoot\(sourceProjectRoot\)/);
  assert.match(commandSource, /source-worktree-diagnostic-only/);
  assert.match(commandSource, /resolveApplicationDataPaths\(\{ selplatRoot, applicationName \}\)/);
});
