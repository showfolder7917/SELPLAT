import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import {
  attachDeveloperDependencyCache,
  detachDeveloperDependencyCache,
  resolveDependencyCache,
} from "./dependency-cache.mjs";

const action = process.argv[2];
if (!new Set(["link", "unlink"]).has(action)) throw new Error("Expected dependency link action: link or unlink.");

if (action === "unlink") {
  const result = detachDeveloperDependencyCache();
  console.log(result.removed ? "Developer dependency link removed." : "Developer dependency link is already absent.");
  process.exit(0);
}

let details = resolveDependencyCache();
if (!existsSync(details.dependencyRoot)) {
  // 开发链接和受控命令共享唯一依赖准备入口，保证锁哈希、npm 缓存和本地包修复规则完全一致。
  const prepared = spawnSync(process.execPath, ["scripts/ensure-dependency-cache.mjs"], {
    cwd: details.appRoot,
    stdio: "inherit",
  });
  if (prepared.error) throw prepared.error;
  if (prepared.status !== 0) process.exit(prepared.status ?? 1);
  details = resolveDependencyCache();
}

const result = attachDeveloperDependencyCache(details);
console.log(`${result.created ? "Created" : "Reused"} developer dependency link for lock ${result.lockHash}.`);
