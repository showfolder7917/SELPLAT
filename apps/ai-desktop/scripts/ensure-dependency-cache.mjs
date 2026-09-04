import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync } from "node:fs";
import path from "node:path";
import { assertDependencyLinkIsUntracked, detachDeveloperDependencyCache, repairLocalPackageLinks, resolveDependencyCache } from "./dependency-cache.mjs";

let details = resolveDependencyCache();
// 安装或迁移前先确认 node_modules 没有被 Git 跟踪，避免替换跨平台链接时波及共享源码。
assertDependencyLinkIsUntracked(details);
if (!existsSync(details.dependencyRoot)) {
  const sourceDependencyEntry = lstatSync(details.linkPath, { throwIfNoEntry: false });
  const sourceDependenciesAreReusableLink = Boolean(sourceDependencyEntry?.isSymbolicLink());
  if (sourceDependenciesAreReusableLink) {
    // 锁文件变化后先解除经本应用缓存验证的旧开发链接，禁止把旧哈希或跨机器目标迁入新缓存。
    detachDeveloperDependencyCache(details);
  }
  if (!sourceDependenciesAreReusableLink || !existsSync(details.linkPath)) {
    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    const npmCacheRoot = path.join(details.projectRoot, "cache", details.applicationName, "npm");
    mkdirSync(npmCacheRoot, { recursive: true });
    // npm 自身下载缓存和错误日志同样属于应用可再生数据，禁止写入用户目录或源码树。
    const installed = spawnSync(npm, ["install", "--force", "--no-audit", "--no-fund"], {
      cwd: details.appRoot,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: { ...process.env, NPM_CONFIG_CACHE: npmCacheRoot },
    });
    if (installed.status !== 0) process.exit(installed.status ?? 1);
  }
  const migrated = spawnSync(process.execPath, ["scripts/migrate-dependencies-to-cache.mjs"], { cwd: details.appRoot, stdio: "inherit" });
  if (migrated.status !== 0) process.exit(migrated.status ?? 1);
  details = resolveDependencyCache();
}
if (!existsSync(details.dependencyRoot)) throw new Error(`Dependency cache preparation failed: ${details.cacheRoot}`);
repairLocalPackageLinks(details);
console.log(`Dependency cache ready: ${details.lockHash}`);
