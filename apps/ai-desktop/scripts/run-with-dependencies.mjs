import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, realpathSync, rmSync } from "node:fs";
import path from "node:path";
import { attachDependencyCache, detachOwnedDependencyCache, resolveDependencyCache } from "./dependency-cache.mjs";

const [command, ...args] = process.argv.slice(2);
if (!command) throw new Error("A command is required.");

const unresolvedCache = resolveDependencyCache();
// 签发 worktree 的验证器已按相同锁文件建立受控依赖链接；仅在 Electron 安装产物完整时复用，避免隔离 Playwright 到启动时才发现损坏缓存。
if (process.env.AI_DESKTOP_TEST_TASK_ID && existsSync(unresolvedCache.linkPath) && lstatSync(unresolvedCache.linkPath).isSymbolicLink()) {
  const linkedDependencies = realpathSync(unresolvedCache.linkPath);
  if (hasElectronRuntime(linkedDependencies)) {
    runCommand(linkedDependencies, unresolvedCache.appRoot);
    process.exit();
  }
  rmSync(unresolvedCache.linkPath, { force: true });
}
if (process.env.AI_DESKTOP_TEST_TASK_ID && existsSync(unresolvedCache.dependencyRoot) && !hasElectronRuntime(unresolvedCache.dependencyRoot)) {
  rmSync(unresolvedCache.dependencyRoot, { recursive: true, force: true });
}

// 锁文件变化后先复用统一准备入口补齐新哈希缓存，避免所有受控命令在挂载阶段直接失败。
if (!existsSync(unresolvedCache.dependencyRoot)) {
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
  runCommand(cache.dependencyRoot, cache.appRoot);
} finally {
  // 同一隔离任务会连续执行 typecheck、构建和 Playwright；保留本任务链接交给任务验证器统一回收，避免再次回退到已知损坏的来源依赖。
  if (!process.env.AI_DESKTOP_TEST_TASK_ID) detachOwnedDependencyCache(cache);
}

function hasElectronRuntime(dependencyRoot) {
  const electronRoot = path.join(dependencyRoot, "electron");
  const pathFile = path.join(electronRoot, "path.txt");
  if (!existsSync(pathFile)) return false;
  const relativeExecutable = readFileSync(pathFile, "utf8").trim();
  const executable = path.resolve(electronRoot, "dist", relativeExecutable);
  return Boolean(relativeExecutable)
    && !path.isAbsolute(relativeExecutable)
    && executable.startsWith(`${path.resolve(electronRoot, "dist")}${path.sep}`)
    && existsSync(executable);
}

function runCommand(dependencyRoot, appRoot) {
  const executable = command === "node"
    ? process.execPath
    : path.join(dependencyRoot, ".bin", process.platform === "win32" ? `${command}.cmd` : command);
  const result = spawnSync(executable, args, {
    cwd: appRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, PATH: `${path.join(dependencyRoot, ".bin")}${path.delimiter}${process.env.PATH || ""}` },
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
