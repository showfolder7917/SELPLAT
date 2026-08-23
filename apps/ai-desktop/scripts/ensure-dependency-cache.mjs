import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolveDependencyCache } from "./dependency-cache.mjs";

let details = resolveDependencyCache();
if (!existsSync(details.dependencyRoot)) {
  if (!existsSync(details.linkPath)) {
    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    const installed = spawnSync(npm, ["install", "--force", "--no-audit", "--no-fund"], { cwd: details.appRoot, stdio: "inherit", shell: process.platform === "win32" });
    if (installed.status !== 0) process.exit(installed.status ?? 1);
  }
  const migrated = spawnSync(process.execPath, ["scripts/migrate-dependencies-to-cache.mjs"], { cwd: details.appRoot, stdio: "inherit" });
  if (migrated.status !== 0) process.exit(migrated.status ?? 1);
  details = resolveDependencyCache();
}
if (!existsSync(details.dependencyRoot)) throw new Error(`Dependency cache preparation failed: ${details.cacheRoot}`);
console.log(`Dependency cache ready: ${details.lockHash}`);
