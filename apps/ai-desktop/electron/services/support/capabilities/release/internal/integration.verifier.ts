import { execFile } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, unlinkSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { resolveApplicationDataPaths } from "@selplat/node-common-core/path";
import { resolveLockSpecificDependencyPaths } from "@selplat/node-common-core/lifecycle";

const execFileAsync = promisify(execFile);

export interface ManagedDependencyLease {
  leaseId: string;
  workspaceProjectRoot: string;
  workspaceDesktopRoot: string;
  /** 本轮租约建立的临时链接；释放时只能回收这些路径，不能删除 Git 已检出的链接。 */
  temporaryLinkPaths: readonly string[];
  environment: Readonly<{ AI_DESKTOP_DEPENDENCY_LEASE_ID: string }>;
  released: boolean;
}

const activeDependencyLeases = new Map<string, Map<string, number>>();
// 同一工作树可由多个校验共享租约，临时链接归工作树所有，不能依赖最后释放的是哪份租约。
const activeTemporaryLinkPaths = new Map<string, Set<string>>();

/**
 * 主进程为 Git 已登记的隔离工作树签发共享依赖租约；缓存来源只能是同一公共仓库的主工程锁哈希目录。
 * 工作树退出时调用 releaseManagedDependencyLease 只解除链接，不删除可由其他任务继续复用的真实缓存。
 */
export async function acquireManagedDependencyLease(
  workspaceProjectRoot: string,
  sourceProjectRoot: string,
  applicationName: string,
  leaseId: string,
  npmCacheRoot?: string,
): Promise<ManagedDependencyLease> {
  const safeLeaseId = safeIdentifier(leaseId, "dependency lease id");
  const resolvedWorkspaceRoot = path.resolve(workspaceProjectRoot);
  const resolvedSourceRoot = path.resolve(sourceProjectRoot);
  if (resolvedWorkspaceRoot === resolvedSourceRoot) throw new Error("共享依赖租约只能签发给隔离工作树。");
  await verifyRegisteredWorktree(resolvedWorkspaceRoot, resolvedSourceRoot);
  const workspaceDesktopRoot = path.join(resolvedWorkspaceRoot, "apps", applicationName);
  const sourceDesktopRoot = path.join(resolvedSourceRoot, "apps", applicationName);
  const sourceLockPath = path.join(sourceDesktopRoot, "package-lock.json");
  const sourcePaths = resolveApplicationDataPaths({ selplatRoot: resolvedSourceRoot, applicationName });
  const sourceModules = resolveLockSpecificDependencyPaths(sourcePaths.dependencyCacheRoot, readFileSync(sourceLockPath)).nodeModulesRoot;
  // 候选检出时可能已有受 Git 跟踪的依赖链接；它不属于本轮租约，必须在结束时保留。
  const existingLinkPaths = new Set(existingIntegrationDependencyLinkPaths(workspaceDesktopRoot));
  const dependencyMode = await ensureIntegrationDependencies(workspaceDesktopRoot, sourceModules, sourceLockPath, npmCacheRoot);
  const temporaryLinkPaths = existingIntegrationDependencyLinkPaths(workspaceDesktopRoot)
    .filter((linkPath) => !existingLinkPaths.has(linkPath));
  if (dependencyMode !== "linked") {
    cleanupIntegrationDependencyLinks(workspaceDesktopRoot, temporaryLinkPaths);
    throw new Error("隔离工作树未能挂载主工程共享依赖缓存，拒绝签发租约。");
  }
  const holders = activeDependencyLeases.get(workspaceDesktopRoot) || new Map<string, number>();
  holders.set(safeLeaseId, (holders.get(safeLeaseId) || 0) + 1);
  activeDependencyLeases.set(workspaceDesktopRoot, holders);
  const ownedLinks = activeTemporaryLinkPaths.get(workspaceDesktopRoot) || new Set<string>();
  for (const linkPath of temporaryLinkPaths) ownedLinks.add(linkPath);
  activeTemporaryLinkPaths.set(workspaceDesktopRoot, ownedLinks);
  return {
    leaseId: safeLeaseId,
    workspaceProjectRoot: resolvedWorkspaceRoot,
    workspaceDesktopRoot,
    temporaryLinkPaths,
    environment: { AI_DESKTOP_DEPENDENCY_LEASE_ID: safeLeaseId },
    released: false,
  };
}

/** 释放任务拥有的链接，真实共享缓存由主工程生命周期管理。 */
export function releaseManagedDependencyLease(lease: ManagedDependencyLease | null | undefined): void {
  if (!lease || lease.released) return;
  lease.released = true;
  const holders = activeDependencyLeases.get(lease.workspaceDesktopRoot);
  const count = holders?.get(lease.leaseId) || 0;
  if (count > 1) holders?.set(lease.leaseId, count - 1);
  else holders?.delete(lease.leaseId);
  if (holders?.size) return;
  activeDependencyLeases.delete(lease.workspaceDesktopRoot);
  const temporaryLinkPaths = activeTemporaryLinkPaths.get(lease.workspaceDesktopRoot) || new Set(lease.temporaryLinkPaths);
  activeTemporaryLinkPaths.delete(lease.workspaceDesktopRoot);
  cleanupIntegrationDependencyLinks(lease.workspaceDesktopRoot, [...temporaryLinkPaths]);
}

/** 集成批次只运行代码级组合检查；正式构建和当前应用重启仍需用户明确触发结果验证。 */
export async function verifyCollaborationIntegration(
  rootPath: string,
  taskIds: string[],
  dependencySourceRoot: string,
  applicationName: string,
  candidateRange: Readonly<{ baseSha: string; candidateSha: string }>,
): Promise<void> {
  await verifyCandidateDelta(rootPath, candidateRange);
  const desktopRoot = path.join(rootPath, "apps", applicationName);
  if (existsSync(path.join(desktopRoot, "package.json"))) {
    const leaseId = `integration-${taskIds.join("-")}`;
    const dependencyLease = await acquireManagedDependencyLease(rootPath, dependencySourceRoot, applicationName, leaseId);
    try {
      await run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "typecheck"], desktopRoot, 180_000, {
        // 组合检查与后续统一测试共享外层已核验的候选依赖链接，禁止内层命令把它当作待迁移源码依赖。
        ...dependencyLease.environment,
      });
    } finally {
      releaseManagedDependencyLease(dependencyLease);
    }
  }
}

/** 只核对本批候选相对冻结基线引入的差异，禁止历史提交中的旧问题阻断当前批次。 */
export async function verifyCandidateDelta(rootPath: string, candidateRange: Readonly<{ baseSha: string; candidateSha: string }>): Promise<void> {
  await run("git", ["diff", "--check", `${candidateRange.baseSha}..${candidateRange.candidateSha}`], rootPath);
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
  if (hasUsableDesktopDependencies(candidateModules)) {
    ensureBuildDependencyLink(candidateDesktopRoot, candidateModules);
    return lstatSync(candidateModules).isSymbolicLink() ? "linked" : "ready";
  }

  const locksMatch = sameFile(
    path.join(candidateDesktopRoot, "package-lock.json"),
    sourceLockPath,
  );
  if (existsSync(candidateModules)) rmSync(candidateModules, { recursive: true, force: true });
  if (locksMatch && hasUsableDesktopDependencies(sourceModules)) {
    symlinkSync(sourceModules, candidateModules, process.platform === "win32" ? "junction" : "dir");
    ensureBuildDependencyLink(candidateDesktopRoot, sourceModules);
    return "linked";
  }

  try {
    await run(
      process.platform === "win32" ? "npm.cmd" : "npm",
      ["ci", "--prefer-offline", "--no-audit", "--no-fund"],
      candidateDesktopRoot,
      600_000,
      npmCacheRoot ? { npm_config_cache: npmCacheRoot } : undefined,
    );
  } catch (error) {
    throw new Error(`集成依赖自愈失败：${error instanceof Error ? error.message : String(error)}`);
  }
  if (!hasUsableDesktopDependencies(candidateModules)) throw new Error("集成依赖自愈失败：补齐依赖后仍缺少 TypeScript 或 Electron 运行时。");
  ensureBuildDependencyLink(candidateDesktopRoot, candidateModules);
  return "installed";
}

async function verifyRegisteredWorktree(workspaceProjectRoot: string, sourceProjectRoot: string): Promise<void> {
  const { stdout: commonOutput } = await execFileAsync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: workspaceProjectRoot });
  const commonDirectory = path.resolve(workspaceProjectRoot, commonOutput.trim());
  if (commonDirectory !== path.join(sourceProjectRoot, ".git")) throw new Error("隔离工作树不属于当前主工程，禁止签发共享依赖租约。");
  const { stdout: worktreeOutput } = await execFileAsync("git", ["worktree", "list", "--porcelain"], { cwd: sourceProjectRoot });
  const registeredRoots = worktreeOutput.split(/\r?\n/)
    .filter((line) => line.startsWith("worktree "))
    .map((line) => path.resolve(line.slice("worktree ".length)));
  if (!registeredRoots.includes(workspaceProjectRoot)) throw new Error("隔离工作树未登记到当前主工程，禁止签发共享依赖租约。");
}

function safeIdentifier(value: string, label: string): string {
  if (!/^[a-zA-Z0-9._-]+$/.test(value)) throw new Error(`${label} contains unsafe characters`);
  return value;
}

/**
 * 只回收调用方明确证明由本轮租约创建的链接；真实依赖目录和候选检出的链接永不删除。
 * 不提供候选目录全量链接的默认值，避免新的调用方重新引入无范围清理。
 */
export function cleanupIntegrationDependencyLinks(
  candidateDesktopRoot: string,
  linkPaths: readonly string[],
): void {
  for (const linkPath of linkPaths) {
    const current = lstatSync(linkPath, { throwIfNoEntry: false });
    if (current?.isSymbolicLink()) unlinkSync(linkPath);
  }
}

/** 返回当前实际存在的符号链接，供租约区分本轮临时链接与候选检出的链接。 */
function existingIntegrationDependencyLinkPaths(candidateDesktopRoot: string): string[] {
  return integrationDependencyLinkPaths(candidateDesktopRoot)
    .filter((linkPath) => lstatSync(linkPath, { throwIfNoEntry: false })?.isSymbolicLink());
}

function ensureBuildDependencyLink(candidateDesktopRoot: string, dependencyRoot: string): void {
  const buildLink = integrationDependencyLinkPaths(candidateDesktopRoot)[1];
  const current = lstatSync(buildLink, { throwIfNoEntry: false });
  if (current) {
    if (current.isSymbolicLink() && realpathSync(buildLink) === realpathSync(dependencyRoot)) return;
    throw new Error(`候选构建依赖路径不是当前签发链接：${buildLink}`);
  }
  mkdirSync(path.dirname(buildLink), { recursive: true });
  symlinkSync(dependencyRoot, buildLink, process.platform === "win32" ? "junction" : "dir");
}

function integrationDependencyLinkPaths(candidateDesktopRoot: string): [string, string] {
  const applicationName = path.basename(candidateDesktopRoot);
  // AI Desktop 固定位于工程根 apps/ai-desktop，两级向上就是该候选工程根。
  const candidateProjectRoot = path.resolve(candidateDesktopRoot, "../..");
  return [
    path.join(candidateDesktopRoot, "node_modules"),
    path.join(candidateProjectRoot, "build", applicationName, "node_modules"),
  ];
}

/** 验证隔离桌面测试所需的编译器和 Electron 已由安装脚本完整落盘。 */
function hasUsableDesktopDependencies(modulesRoot: string): boolean {
  return existsSync(executablePath(modulesRoot, "tsc")) && hasElectronRuntime(modulesRoot);
}

/** Electron 的 path.txt 仅由安装脚本写入，存在且指向实际文件才允许复用依赖。 */
function hasElectronRuntime(modulesRoot: string): boolean {
  const electronRoot = path.join(modulesRoot, "electron");
  const pathFile = path.join(electronRoot, "path.txt");
  if (!existsSync(pathFile)) return false;
  const relativeExecutable = readFileSync(pathFile, "utf8").trim();
  const executable = path.resolve(electronRoot, "dist", relativeExecutable);
  return Boolean(relativeExecutable)
    && !path.isAbsolute(relativeExecutable)
    && executable.startsWith(`${path.resolve(electronRoot, "dist")}${path.sep}`)
    && existsSync(executable);
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
    const stderr = error && typeof error === "object" && "stderr" in error && typeof error.stderr === "string" ? error.stderr.trim() : "";
    const stdout = error && typeof error === "object" && "stdout" in error && typeof error.stdout === "string" ? error.stdout.trim() : "";
    // Git 的 whitespace 诊断写入 stdout；两路都为空时才退回异常消息，禁止页面只得到一个空错误前缀。
    const detail = (stderr || stdout || (error instanceof Error ? error.message : String(error))).slice(-2_000);
    throw new Error(`协同组合检查失败：${detail}`);
  }
}
