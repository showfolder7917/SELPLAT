import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const runner = readFileSync(new URL("../scripts/run-with-dependencies.mjs", import.meta.url), "utf8");
const cache = readFileSync(new URL("../scripts/dependency-cache.mjs", import.meta.url), "utf8");
const pathResolver = readFileSync(new URL("../scripts/resolve-application-paths.mjs", import.meta.url), "utf8");
const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("受控命令在锁文件哈希缓存缺失时先调用统一依赖准备入口", () => {
  assert.match(runner, /resolveDependencyCache/);
  assert.match(runner, /existsSync\(unresolvedCache\.dependencyRoot\)/);
  assert.match(runner, /scripts\/ensure-dependency-cache\.mjs/);
  assert.match(runner, /if \(prepared\.status !== 0\) process\.exit/);
  assert.ok(runner.indexOf("ensure-dependency-cache.mjs") < runner.indexOf("attachDependencyCache()"));
});

test("应用路径诊断通过受控依赖入口加载公共路径包且不要求持久源码依赖目录", () => {
  assert.equal(manifest.scripts["paths:resolve"], "node scripts/run-with-dependencies.mjs node scripts/resolve-application-paths.mjs");
  assert.match(pathResolver, /from "@selplat\/node-common-core\/path"/);
  assert.match(pathResolver, /resolveApplicationNameFromSourceRoot\(appRoot\)/);
  assert.match(pathResolver, /resolveApplicationDataPaths\(\{ selplatRoot: projectRoot, applicationName \}\)/);
});

test("当前哈希缓存存在时收敛实体目录和旧哈希链接", () => {
  assert.match(cache, /realpathSync\(details\.linkPath\) === realpathSync\(details\.dependencyRoot\)/);
  assert.match(cache, /rmSync\(details\.linkPath, \{ recursive: true, force: true \}\)/);
  assert.ok(cache.indexOf("Dependency cache is missing") < cache.indexOf("recursive: true, force: true"));
});

test("签发 worktree 内层命令借用外层依赖链接且不抢占清理所有权", () => {
  assert.match(runner, /preserveExistingLink: Boolean\(process\.env\.AI_DESKTOP_TEST_TASK_ID\)/);
  assert.match(cache, /options\.preserveExistingLink === true/);
  assert.match(cache, /dependencyRoot: linkedDependencyRoot, ownsLink: false, ownsBuildLink: false/);
});
