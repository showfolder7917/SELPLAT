import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { attachDependencyCache, detachOwnedDependencyCache } from "./dependency-cache.mjs";

const [command, ...args] = process.argv.slice(2);
if (!command) throw new Error("A command is required.");
const cache = attachDependencyCache();
try {
  const nodeCommonRuntime = path.join(cache.dependencyRoot, "@selplat", "node-common-core", "dist", "index.js");
  if (!existsSync(nodeCommonRuntime)) {
    // 新锁缓存首次使用时先把共通 TypeScript 编译为运行包；例如测试调度器随后可直接导入 @selplat/node-common-core，失败返回原编译状态。
    for (const script of ["build-node-common.mjs", "sync-node-common-runtime.mjs"]) {
      const prepared = spawnSync(process.execPath, [path.join(cache.appRoot, "scripts", script)], {
        cwd: cache.appRoot,
        stdio: "inherit",
        env: { ...process.env, PATH: `${path.join(cache.dependencyRoot, ".bin")}${path.delimiter}${process.env.PATH || ""}` },
      });
      if (prepared.error) throw prepared.error;
      if (prepared.status !== 0) throw new Error(`Node common runtime preparation failed: ${script} (${prepared.status ?? 1})`);
    }
  }
  const executable = command === "node"
    ? process.execPath
    : path.join(cache.dependencyRoot, ".bin", process.platform === "win32" ? `${command}.cmd` : command);
  const result = spawnSync(executable, args, {
    cwd: cache.appRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, PATH: `${path.join(cache.dependencyRoot, ".bin")}${path.delimiter}${process.env.PATH || ""}` },
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  detachOwnedDependencyCache(cache);
}
