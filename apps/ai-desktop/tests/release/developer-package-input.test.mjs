import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync, symlinkSync, existsSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { prepareDeveloperPackageInput, cleanupDeveloperPackageInput } from "../../scripts/developer-package-input.mjs";

function fixture() {
  const projectRoot = mkdtempSync(path.join(tmpdir(), "package-lifecycle-"));
  const applicationRoot = path.join(projectRoot, "apps", "ai-desktop");
  mkdirSync(path.join(applicationRoot, "node_modules", "demo"), { recursive: true });
  writeFileSync(path.join(applicationRoot, "package.json"), '{"name":"fixture"}');
  writeFileSync(path.join(applicationRoot, "node_modules", "demo", "index.js"), "ok");
  return { projectRoot, applicationRoot };
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
  const outside = mkdtempSync(path.join(tmpdir(), "package-outside-"));
  try {
    writeFileSync(path.join(outside, "keep"), "keep");
    symlinkSync(outside, path.join(f.projectRoot, "build"), "dir");
    assert.throws(() => prepareDeveloperPackageInput(f), /symbolic link/);
    assert.deepEqual(readdirSync(outside), ["keep"]);
  } finally { rmSync(f.projectRoot, { recursive: true, force: true }); rmSync(outside, { recursive: true, force: true }); }
});
