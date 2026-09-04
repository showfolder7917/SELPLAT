import { existsSync, lstatSync, mkdirSync, renameSync } from "node:fs";
import path from "node:path";
import { assertDependencyLinkIsUntracked, repairLocalPackageLinks, resolveDependencyCache } from "./dependency-cache.mjs";

const details = resolveDependencyCache();
// 迁移实体依赖目录前，禁止接受已经进入版本控制的跨平台链接。
assertDependencyLinkIsUntracked(details);
if (!existsSync(details.linkPath)) {
  if (!existsSync(details.dependencyRoot)) throw new Error("Neither source dependencies nor the lock-specific dependency cache exists.");
  repairLocalPackageLinks(details);
  console.log(`Dependency cache already prepared: ${details.cacheRoot}`);
  process.exit(0);
}
if (lstatSync(details.linkPath).isSymbolicLink()) throw new Error("Remove the temporary dependency link before migrating dependencies.");
if (existsSync(details.dependencyRoot)) throw new Error(`Lock-specific dependency cache already exists: ${details.dependencyRoot}`);
mkdirSync(details.cacheRoot, { recursive: true });
renameSync(details.linkPath, details.dependencyRoot);
repairLocalPackageLinks(details);
console.log(`Dependencies migrated to lock-specific cache: ${details.cacheRoot}`);
