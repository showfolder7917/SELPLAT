import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync, symlinkSync, existsSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { assertDeveloperPackageInputCapacity, estimateDeveloperPackageInputCapacity, prepareDeveloperPackageInput, cleanupDeveloperPackageInput } from "../../scripts/developer-package-input.mjs";

function fixture() {
  // 受控依赖租约会把系统临时目录定向到来源缓存；隔离工作树可显式提供其可写测试目录。
  const projectRoot = mkdtempSync(path.join(testTemporaryRoot(), "package-lifecycle-"));
  const applicationRoot = path.join(projectRoot, "apps", "ai-desktop");
  mkdirSync(path.join(applicationRoot, "node_modules", "demo"), { recursive: true });
  writeFileSync(path.join(applicationRoot, "package.json"), '{"name":"fixture"}');
  writeFileSync(path.join(applicationRoot, "node_modules", "demo", "index.js"), "ok");
  return { projectRoot, applicationRoot };
}

function testTemporaryRoot() {
  return process.env.AI_DESKTOP_TEST_TMPDIR || tmpdir();
}

test("并发准备独占目录，清理不碰另一轮与源依赖", () => {
  const f = fixture();
  try {
    const first = prepareDeveloperPackageInput(f);
    const second = prepareDeveloperPackageInput(f);
    assert.notEqual(first, second);
    cleanupDeveloperPackageInput({ ...f, packageInputRoot: first });
    assert.ok(existsSync(second));
    assert.ok(existsSync(path.join(f.applicationRoot, "node_modules", "demo", "index.js")));
    assert.throws(() => cleanupDeveloperPackageInput({ ...f, packageInputRoot: f.applicationRoot }), /not owned/);
    cleanupDeveloperPackageInput({ ...f, packageInputRoot: second });
  } finally { rmSync(f.projectRoot, { recursive: true, force: true }); }
});

test("复制失败也清理半成品，保留失败来源", () => {
  const f = fixture();
  try {
    symlinkSync("missing", path.join(f.applicationRoot, "node_modules", "broken"));
    assert.throws(() => prepareDeveloperPackageInput(f), /ENOENT/);
    assert.deepEqual(readdirSync(path.join(f.projectRoot, "build", "ai-desktop", "package-input")), []);
    assert.ok(existsSync(path.join(f.applicationRoot, "package.json")));
  } finally { rmSync(f.projectRoot, { recursive: true, force: true }); }
});

test("输出父目录为链接时拒绝复制，不触碰链接目标", () => {
  const f = fixture();
  const outside = mkdtempSync(path.join(testTemporaryRoot(), "package-outside-"));
  try {
    writeFileSync(path.join(outside, "keep"), "keep");
    symlinkSync(outside, path.join(f.projectRoot, "build"), "dir");
    assert.throws(() => prepareDeveloperPackageInput(f), /symbolic link/);
    assert.deepEqual(readdirSync(outside), ["keep"]);
  } finally { rmSync(f.projectRoot, { recursive: true, force: true }); rmSync(outside, { recursive: true, force: true }); }
});

test("容量不足时在复制前拒绝，且不创建临时输入目录", () => {
  const f = fixture();
  try {
    const estimate = estimateDeveloperPackageInputCapacity({ applicationRoot: f.applicationRoot, storageBlockSize: 1024 });
    const availableBlocks = Math.floor((estimate.requiredBytes - 1) / 1024);
    assert.throws(
      () => assertDeveloperPackageInputCapacity({
        ...f,
        getStorageStats: () => ({ bsize: 1024, bavail: availableBlocks }),
      }),
      (error) => error.code === "ENOSPC" && error.capacity.requiredBytes === estimate.requiredBytes,
    );
    assert.equal(existsSync(path.join(f.projectRoot, "build")), false);
    assert.doesNotThrow(() => assertDeveloperPackageInputCapacity({
      ...f,
      getStorageStats: () => ({ bsize: 1024, bavail: estimate.requiredBytes / 1024 }),
    }));
  } finally { rmSync(f.projectRoot, { recursive: true, force: true }); }
});
