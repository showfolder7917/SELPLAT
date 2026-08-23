import { execFile } from "node:child_process";
import { existsSync, readFileSync, symlinkSync, unlinkSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { resolveApplicationDataPaths } from "@selplat/node-common-core/path";
import { resolveLockSpecificDependencyPaths } from "@selplat/node-common-core/lifecycle";

const execFileAsync = promisify(execFile);

/** 集成批次只运行代码级组合检查；正式构建和当前应用重启仍属于用户明确触发的测试托管。 */
export async function verifyCollaborationIntegration(rootPath: string, taskIds: string[], dependencySourceRoot: string, applicationName: string): Promise<void> {
  const commitCount = Math.max(4, taskIds.length * 3);
  await run("git", ["log", "--check", "--oneline", "-n", String(commitCount)], rootPath);
  const desktopRoot = path.join(rootPath, "apps", applicationName);
  if (existsSync(path.join(desktopRoot, "package.json"))) {
    const sourceDesktopRoot = path.join(dependencySourceRoot, "apps", applicationName);
    const dataPaths = resolveApplicationDataPaths({ selplatRoot: dependencySourceRoot, applicationName });
    const sourceModules = resolveLockSpecificDependencyPaths(dataPaths.dependencyCacheRoot, readFileSync(path.join(sourceDesktopRoot, "package-lock.json"))).nodeModulesRoot;
    const dependencyMode = await ensureIntegrationDependencies(desktopRoot, sourceModules, path.join(sourceDesktopRoot, "package-lock.json"));
    try {
      await run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "typecheck"], desktopRoot);
    } finally {
      // 复用依赖的目录链接只服务本轮组合检查；提升候选前删除，避免被 Git 误判为待集成源码。
      if (dependencyMode === "linked") unlinkSync(path.join(desktopRoot, "node_modules"));
    }
  }
}

/**
 * 独立集成 worktree 没有依赖目录时，优先复用锁文件一致的主工作区依赖；
 * 真实传参示例：候选 `.../integration/g2/apps/ai-desktop` 与主工程 `.../SELPLAT/apps/ai-desktop`；
 * 返回示例：`linked` 表示已建立临时目录链接，`installed` 表示已按锁文件离线优先补齐；
 * 异常示例：锁文件不一致且 npm 无法补齐时抛出“集成依赖自愈失败”，该环境故障不会计入审核驳回次数。
 */
export async function ensureIntegrationDependencies(
  candidateDesktopRoot: string,
  sourceModules: string,
  sourceLockPath: string,
  npmCacheRoot?: string,
): Promise<"ready" | "linked" | "installed"> {
  const candidateModules = path.join(candidateDesktopRoot, "node_modules");
  const candidateTsc = executablePath(candidateModules, "tsc");
  if (existsSync(candidateTsc)) return "ready";

  const sourceTsc = executablePath(sourceModules, "tsc");
  const locksMatch = sameFile(
    path.join(candidateDesktopRoot, "package-lock.json"),
    sourceLockPath,
  );
  if (!existsSync(candidateModules) && locksMatch && existsSync(sourceTsc)) {
    symlinkSync(sourceModules, candidateModules, process.platform === "win32" ? "junction" : "dir");
    return "linked";
  }

  try {
    await run(
      process.platform === "win32" ? "npm.cmd" : "npm",
      ["ci", "--ignore-scripts", "--prefer-offline", "--no-audit", "--no-fund"],
      candidateDesktopRoot,
      600_000,
      npmCacheRoot ? { npm_config_cache: npmCacheRoot } : undefined,
    );
  } catch (error) {
    throw new Error(`集成依赖自愈失败：${error instanceof Error ? error.message : String(error)}`);
  }
  if (!existsSync(candidateTsc)) throw new Error("集成依赖自愈失败：补齐依赖后仍找不到 TypeScript 编译器。");
  return "installed";
}

function executablePath(modulesRoot: string, name: string): string {
  return path.join(modulesRoot, ".bin", process.platform === "win32" ? `${name}.cmd` : name);
}

function sameFile(left: string, right: string): boolean {
  if (!existsSync(left) || !existsSync(right)) return false;
  return readFileSync(left).equals(readFileSync(right));
}

async function run(command: string, args: string[], cwd: string, timeout = 180_000, environment?: NodeJS.ProcessEnv): Promise<void> {
  try {
    await execFileAsync(command, args, {
      cwd,
      timeout,
      maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env, ...environment, GIT_TERMINAL_PROMPT: "0" },
    });
  } catch (error) {
    const detail = error && typeof error === "object" && "stderr" in error && typeof error.stderr === "string"
      ? error.stderr.trim().slice(-2_000)
      : error instanceof Error ? error.message : String(error);
    throw new Error(`协同组合检查失败：${detail}`);
  }
}
