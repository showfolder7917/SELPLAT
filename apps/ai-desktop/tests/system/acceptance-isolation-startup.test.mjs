import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const startup = readFileSync("electron/system/bootstrap/startup-context.ts", "utf8");
const runtime = readFileSync("electron/system/bootstrap/application-runtime.ts", "utf8");
const launcher = readFileSync("scripts/start-isolated-acceptance.mjs", "utf8");
const packageJson = readFileSync("package.json", "utf8");

test("隔离验收在任何可写服务前审计并拒绝正式根", () => {
  assert.match(startup, /auditAcceptanceIsolation\(\{ applicationName, projectRoot: configuredProjectRoot, projectPaths \}\);/);
  assert.match(startup, /隔离验收路径越界，拒绝启动/);
  assert.match(startup, /resolveConfiguredAiMemoryPaths\(options\.projectRoot\)/);
  assert.match(startup, /databasePath.*-wal.*-shm/s);
  assert.match(startup, /rule-workspace.*codex-home.*collaboration/s);
  assert.match(startup, /archiveLogRoot.*temporaryMaterialsRoot/s);
});

test("验收启动器只启动已打包应用，并把三类根同时传入", () => {
  assert.match(launcher, /AI_DESKTOP_ACCEPTANCE_APP/);
  assert.match(launcher, /--selplat-root=\$\{projectRoot\}/);
  assert.match(launcher, /--ai-desktop-user-data-dir=\$\{userDataRoot\}/);
  assert.match(launcher, /--ai-desktop-acceptance-isolation-root=\$\{acceptanceRoot\}/);
  assert.match(launcher, /AI_DESKTOP_ACCEPTANCE_PROTECTED_USER_DATA_ROOT/);
  assert.match(launcher, /ai-memory-paths\.json/);
  assert.doesNotMatch(launcher, /isolated-preload/);
  assert.match(packageJson, /"start:isolated-acceptance": "node scripts\/start-isolated-acceptance\.mjs"/);
});

test("隔离验收不初始化外部 Codex 用户目录与 watcher", () => {
  assert.match(runtime, /AI_DESKTOP_ACCEPTANCE_ISOLATED/);
  assert.match(runtime, /const externalCorpusEnabled = process\.env\.AI_DESKTOP_ACCEPTANCE_ISOLATED !== "1"/);
  assert.match(runtime, /if \(externalCorpusEnabled\) \{\s*codexAppCorpusWatcher = createCodexConversationCorpusWatcher/s);
  assert.match(runtime, /const corpusSemanticBackfill = aiMemoryDatabase && externalCorpusEnabled/);
  assert.match(runtime, /roots: externalCorpusRoots/);
});
