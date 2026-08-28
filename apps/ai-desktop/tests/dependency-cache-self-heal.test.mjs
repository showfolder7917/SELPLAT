import assert from "node:assert/strict";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { attachDeveloperDependencyCache, detachDeveloperDependencyCache } from "../scripts/dependency-cache.mjs";

const runner = readFileSync(new URL("../scripts/run-with-dependencies.mjs", import.meta.url), "utf8");
const cache = readFileSync(new URL("../scripts/dependency-cache.mjs", import.meta.url), "utf8");
const ensure = readFileSync(new URL("../scripts/ensure-dependency-cache.mjs", import.meta.url), "utf8");
const linkManager = readFileSync(new URL("../scripts/manage-dependency-link.mjs", import.meta.url), "utf8");
const pathResolver = readFileSync(new URL("../scripts/resolve-application-paths.mjs", import.meta.url), "utf8");
const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("受控命令在锁文件哈希缓存缺失时先调用统一依赖准备入口", () => {
  assert.match(runner, /resolveDependencyCache/);
  assert.match(runner, /existsSync\(unresolvedCache\.dependencyRoot\)/);
  assert.match(runner, /scripts\/ensure-dependency-cache\.mjs/);
  assert.match(runner, /if \(prepared\.status !== 0\) process\.exit/);
  assert.ok(runner.indexOf("ensure-dependency-cache.mjs") < runner.indexOf("attachDependencyCache("));
});

test("首次安装和中断恢复都使用应用工程内 npm 缓存", () => {
  assert.match(ensure, /sourceDependenciesAreReusableLink/);
  assert.match(ensure, /lstatSync\(details\.linkPath, \{ throwIfNoEntry: false \}\)/);
  assert.match(ensure, /Boolean\(sourceDependencyEntry\?\.isSymbolicLink\(\)\)/);
  assert.match(ensure, /path\.join\(details\.projectRoot, "cache", details\.applicationName, "npm"\)/);
  assert.match(ensure, /NPM_CONFIG_CACHE: npmCacheRoot/);
  assert.ok(ensure.indexOf("NPM_CONFIG_CACHE") < ensure.indexOf("migrate-dependencies-to-cache.mjs"));
  assert.match(ensure, /detachDeveloperDependencyCache\(details\)/);
});

test("开发依赖链接使用本机平台链接并且只接受当前应用缓存目标", (context) => {
  const projectRoot = mkdtempSync(path.join(tmpdir(), "ai-desktop-dependency-link-"));
  context.after(() => rmSync(projectRoot, { recursive: true, force: true }));
  const appRoot = path.join(projectRoot, "apps", "ai-desktop");
  const dependencyCacheRoot = path.join(projectRoot, "cache", "ai-desktop", "dependencies");
  const cacheRoot = path.join(dependencyCacheRoot, "current-lock");
  const dependencyRoot = path.join(cacheRoot, "node_modules");
  const linkPath = path.join(appRoot, "node_modules");
  mkdirSync(dependencyRoot, { recursive: true });
  mkdirSync(appRoot, { recursive: true });
  writeFileSync(path.join(appRoot, "package-lock.json"), JSON.stringify({ packages: {} }), "utf8");
  const details = {
    appRoot,
    projectRoot,
    applicationName: "ai-desktop",
    lockHash: "current-lock",
    dependencyCacheRoot,
    cacheRoot,
    dependencyRoot,
    linkPath,
    buildLinkPath: path.join(projectRoot, "build", "ai-desktop", "node_modules"),
  };

  const attached = attachDeveloperDependencyCache(details);
  assert.equal(attached.created, true);
  assert.equal(lstatSync(linkPath).isSymbolicLink(), true);
  assert.equal(realpathSync(linkPath), realpathSync(dependencyRoot));
  assert.equal(attachDeveloperDependencyCache(details).created, false);
  assert.equal(detachDeveloperDependencyCache(details).removed, true);
  assert.equal(existsSync(linkPath), false);

  const staleDependencyRoot = path.join(dependencyCacheRoot, "old-lock", "node_modules");
  mkdirSync(staleDependencyRoot, { recursive: true });
  symlinkSync(staleDependencyRoot, linkPath, process.platform === "win32" ? "junction" : "dir");
  assert.equal(attachDeveloperDependencyCache(details).created, true);
  assert.equal(realpathSync(linkPath), realpathSync(dependencyRoot));
  assert.equal(detachDeveloperDependencyCache(details).removed, true);

  const missingStaleRoot = path.join(dependencyCacheRoot, "missing-old-lock", "node_modules");
  symlinkSync(missingStaleRoot, linkPath, process.platform === "win32" ? "junction" : "dir");
  assert.equal(attachDeveloperDependencyCache(details).created, true);
  assert.equal(realpathSync(linkPath), realpathSync(dependencyRoot));
  assert.equal(detachDeveloperDependencyCache(details).removed, true);

  const foreignRoot = path.join(projectRoot, "foreign-dependencies");
  mkdirSync(foreignRoot, { recursive: true });
  symlinkSync(foreignRoot, linkPath, process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => attachDeveloperDependencyCache(details), /escaped the application cache/);
  assert.equal(realpathSync(linkPath), realpathSync(foreignRoot));
  rmSync(linkPath, { force: true });

  mkdirSync(linkPath, { recursive: true });
  assert.throws(() => attachDeveloperDependencyCache(details), /must be a symbolic link or junction/);
  assert.equal(lstatSync(linkPath).isDirectory(), true);
});

test("依赖链接命令复用唯一缓存入口且向 package scripts 暴露显式启停动作", () => {
  assert.match(linkManager, /scripts\/ensure-dependency-cache\.mjs/);
  assert.match(linkManager, /attachDeveloperDependencyCache\(details\)/);
  assert.match(linkManager, /detachDeveloperDependencyCache\(\)/);
  assert.equal(manifest.scripts["dependencies:link"], "node scripts/manage-dependency-link.mjs link");
  assert.equal(manifest.scripts["dependencies:unlink"], "node scripts/manage-dependency-link.mjs unlink");
});

test("应用路径诊断通过受控依赖入口加载公共路径包且不要求持久源码依赖目录", () => {
  assert.equal(manifest.scripts["paths:resolve"], "node scripts/run-with-dependencies.mjs node scripts/resolve-application-paths.mjs");
  assert.match(pathResolver, /from "@selplat\/node-common-core\/path"/);
  assert.match(pathResolver, /resolveApplicationNameFromSourceRoot\(applicationRoot\)/);
  assert.match(pathResolver, /resolveApplicationDataPaths\(\{ selplatRoot, applicationName \}\)/);
});

test("隔离 Playwright 不复用缺少 Electron 安装产物的临时依赖链接", () => {
  assert.match(runner, /hasElectronRuntime\(linkedDependencies\)/);
  assert.match(runner, /rmSync\(unresolvedCache\.linkPath, \{ force: true \}\)/);
  assert.match(runner, /rmSync\(unresolvedCache\.dependencyRoot, \{ recursive: true, force: true \}\)/);
  assert.match(runner, /if \(!process\.env\.AI_DESKTOP_TEST_TASK_ID\) detachOwnedDependencyCache\(cache\)/);
});

test("当前哈希缓存存在时收敛实体目录和旧哈希链接", () => {
  assert.match(cache, /linkedDependencyRoot === realpathSync\(details\.dependencyRoot\)/);
  assert.match(cache, /rmSync\(details\.linkPath, \{ recursive: true, force: true \}\)/);
  assert.ok(cache.indexOf("Dependency cache is missing") < cache.indexOf("recursive: true, force: true"));
});

test("签发 worktree 内层命令借用外层依赖链接且不抢占清理所有权", () => {
  assert.match(runner, /preserveExistingLink: Boolean\(process\.env\.AI_DESKTOP_TEST_TASK_ID\)/);
  assert.match(cache, /options\.preserveExistingLink === true/);
  assert.match(cache, /dependencyRoot: linkedDependencyRoot, ownsLink: false, ownsBuildLink: false/);
});
