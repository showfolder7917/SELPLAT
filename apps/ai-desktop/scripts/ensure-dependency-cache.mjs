import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync } from "node:fs";
import path from "node:path";
import { repairLocalPackageLinks, resolveDependencyCache } from "./dependency-cache.mjs";

let details = resolveDependencyCache();
if (!existsSync(details.dependencyRoot)) {
  const sourceDependenciesAreReusableLink = existsSync(details.linkPath) && lstatSync(details.linkPath).isSymbolicLink();
  if (!sourceDependenciesAreReusableLink) {
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
