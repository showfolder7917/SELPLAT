import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { resolveApplicationDataPaths, resolveApplicationNameFromSourceRoot, resolveArchiveMonth, resolveLockSpecificDependencyPaths, validateSafeIdentifier } from "../../../../build/shared/node/common-core/index.js";

test("不同应用取得互不冲突的标准数据根", () => {
  const desktop = resolveApplicationDataPaths({ selplatRoot: "/workspace/SELPLAT", applicationName: "ai-desktop", pathApi: path.posix });
  const memory = resolveApplicationDataPaths({ selplatRoot: "/workspace/SELPLAT", applicationName: "ai-memory", pathApi: path.posix });
  assert.equal(desktop.pendingTestRoot, "/workspace/SELPLAT/OPTION/temp/ai-desktop/执行日志/待执行/测试");
  assert.equal(desktop.archiveLogRoot, "/workspace/SELPLAT/log/ai-desktop/归档日志");
  assert.notEqual(desktop.cacheRoot, memory.cacheRoot);
});

test("Windows 路径使用同一目录语义", () => {
  const paths = resolveApplicationDataPaths({ selplatRoot: "C:\\workspace\\SELPLAT", applicationName: "ai-desktop", pathApi: path.win32 });
  assert.equal(paths.runningExecutionRoot, "C:\\workspace\\SELPLAT\\OPTION\\temp\\ai-desktop\\执行日志\\运行中\\执行");
  assert.equal(paths.diagnosticArchiveRoot, "C:\\workspace\\SELPLAT\\log\\ai-desktop\\归档日志\\诊断归档");
});

test("工程名和动态标识拒绝路径逃逸", () => {
  for (const value of ["../escape", "a/b", "a\\b", "/absolute", "", "bad name"]) assert.throws(() => validateSafeIdentifier(value));
  assert.equal(validateSafeIdentifier("task_2026-08-23"), "task_2026-08-23");
});

test("应用名从真实源码根解析且年月分区稳定", () => {
  assert.equal(resolveApplicationNameFromSourceRoot("/workspace/SELPLAT/apps/ai-memory", path.posix), "ai-memory");
  assert.equal(resolveArchiveMonth("2026-08-23T01:02:03.000Z"), "2026-08");
  assert.throws(() => resolveArchiveMonth("invalid"));
});

test("不同锁文件进入不同依赖缓存且结果稳定", () => {
  const first = resolveLockSpecificDependencyPaths("/workspace/cache/app/dependencies", "lock-a", path.posix);
  const repeated = resolveLockSpecificDependencyPaths("/workspace/cache/app/dependencies", "lock-a", path.posix);
  const second = resolveLockSpecificDependencyPaths("/workspace/cache/app/dependencies", "lock-b", path.posix);
  assert.equal(first.nodeModulesRoot, repeated.nodeModulesRoot);
  assert.notEqual(first.lockHash, second.lockHash);
  assert.match(first.nodeModulesRoot, /\/node_modules$/);
});
