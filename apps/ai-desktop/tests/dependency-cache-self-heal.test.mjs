import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const runner = readFileSync(new URL("../scripts/run-with-dependencies.mjs", import.meta.url), "utf8");
const cache = readFileSync(new URL("../scripts/dependency-cache.mjs", import.meta.url), "utf8");

test("受控命令在锁文件哈希缓存缺失时先调用统一依赖准备入口", () => {
  assert.match(runner, /resolveDependencyCache/);
  assert.match(runner, /existsSync\(unresolvedCache\.dependencyRoot\)/);
  assert.match(runner, /scripts\/ensure-dependency-cache\.mjs/);
  assert.match(runner, /if \(prepared\.status !== 0\) process\.exit/);
  assert.ok(runner.indexOf("ensure-dependency-cache.mjs") < runner.indexOf("attachDependencyCache()"));
});

test("当前哈希缓存存在时收敛实体目录和旧哈希链接", () => {
  assert.match(cache, /realpathSync\(details\.linkPath\) === realpathSync\(details\.dependencyRoot\)/);
  assert.match(cache, /rmSync\(details\.linkPath, \{ recursive: true, force: true \}\)/);
  assert.ok(cache.indexOf("Dependency cache is missing") < cache.indexOf("recursive: true, force: true"));
});
