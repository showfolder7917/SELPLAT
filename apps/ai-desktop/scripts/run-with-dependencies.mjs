import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { attachDependencyCache, detachOwnedDependencyCache, resolveDependencyCache } from "./dependency-cache.mjs";

const [command, ...args] = process.argv.slice(2);
if (!command) throw new Error("A command is required.");

const unresolvedCache = resolveDependencyCache();
const controlledNodeCompileCache = path.join(unresolvedCache.cacheProjectRoot, "cache", unresolvedCache.applicationName, "test-tmp", "node-compile-cache");

// 锁文件变化后先复用统一准备入口补齐新哈希缓存，避免所有受控命令在挂载阶段直接失败。
if (!existsSync(unresolvedCache.dependencyRoot)) {
  if (unresolvedCache.dependencyLeaseId) throw new Error(`Managed dependency lease cache is missing: ${unresolvedCache.cacheRoot}`);
  const prepared = spawnSync(process.execPath, ["scripts/ensure-dependency-cache.mjs"], {
    cwd: unresolvedCache.appRoot,
    stdio: "inherit",
  });
  if (prepared.error) throw prepared.error;
  if (prepared.status !== 0) process.exit(prepared.status ?? 1);
}

const cache = attachDependencyCache();
try {
  const nodeCommonRuntime = path.join(cache.dependencyRoot, "@selplat", "node-common-core", "dist", "index.js");
  if (!existsSync(nodeCommonRuntime)) {
    if (cache.dependencyLeaseId) throw new Error(`Managed dependency lease is incomplete: ${nodeCommonRuntime}`);
    // 新锁缓存首次使用时先把共通 TypeScript 编译为运行包；例如测试调度器随后可直接导入 @selplat/node-common-core，失败返回原编译状态。
    for (const script of ["build-node-common.mjs", "sync-node-common-runtime.mjs"]) {
      const prepared = spawnSync(process.execPath, [path.join(cache.appRoot, "scripts", script)], {
        cwd: cache.appRoot,
        stdio: "inherit",
        env: { ...process.env, NODE_COMPILE_CACHE: controlledNodeCompileCache, PATH: `${path.join(cache.dependencyRoot, ".bin")}${path.delimiter}${process.env.PATH || ""}` },
      });
      if (prepared.error) throw prepared.error;
      if (prepared.status !== 0) throw new Error(`Node common runtime preparation failed: ${script} (${prepared.status ?? 1})`);
    }
  }
  runCommand(cache.dependencyRoot, cache.appRoot, controlledNodeCompileCache);
} finally {
  // 外层租约统一管理隔离工作树链接；普通命令只回收自己建立的临时链接。
  if (!cache.dependencyLeaseId) detachOwnedDependencyCache(cache);
}

function runCommand(dependencyRoot, appRoot, nodeCompileCache) {
  const executable = command === "node"
    ? process.execPath
    : path.join(dependencyRoot, ".bin", process.platform === "win32" ? `${command}.cmd` : command);
  const usesWindowsCommandInterpreter = process.platform === "win32" && command !== "node";
  const quoteWindowsArgument = (value) => `"${String(value).replaceAll('"', '""')}"`;
  const windowsCommandLine = `"${[quoteWindowsArgument(executable), ...args.map(quoteWindowsArgument)].join(" ")}"`;
  const launchExecutable = usesWindowsCommandInterpreter ? process.env.ComSpec || "cmd.exe" : executable;
  const launchArguments = usesWindowsCommandInterpreter ? ["/d", "/s", "/c", windowsCommandLine] : args;
  const result = spawnSync(launchExecutable, launchArguments, {
    cwd: appRoot,
    stdio: "inherit",
    shell: false,
    windowsVerbatimArguments: usesWindowsCommandInterpreter,
    env: { ...process.env, NODE_COMPILE_CACHE: nodeCompileCache, PATH: `${path.join(dependencyRoot, ".bin")}${path.delimiter}${process.env.PATH || ""}` },
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
