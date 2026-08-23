import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const runner = readFileSync(new URL("../scripts/run-interaction-tests.mjs", import.meta.url), "utf8");
const config = readFileSync(new URL("../playwright.interaction.config.ts", import.meta.url), "utf8");
const paths = readFileSync(new URL("../scripts/interaction-test-paths.mjs", import.meta.url), "utf8");

test("交互测试引导不依赖尚未编译的本地公共包", () => {
  assert.doesNotMatch(runner, /@selplat\/node-common-core/);
  assert.doesNotMatch(config, /@selplat\/node-common-core/);
  assert.match(runner, /resolveInteractionTestPaths/);
  assert.match(config, /resolveInteractionTestPaths/);
  assert.match(paths, /resolveDependencyCache/);
  assert.match(paths, /temporaryMaterialsRoot/);
  assert.match(paths, /archiveLogRoot/);
});
