import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function resolveDependencyCache() {
  const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const projectRoot = path.resolve(appRoot, "../..");
  const manifest = JSON.parse(readFileSync(path.join(appRoot, "package.json"), "utf8"));
  const applicationName = String(manifest.name || "");
  if (!/^[a-zA-Z0-9_-]+$/.test(applicationName)) throw new Error("package.json name is not a safe application identifier");
  const lockContent = readFileSync(path.join(appRoot, "package-lock.json"));
  const lockHash = createHash("sha256").update(lockContent).digest("hex");
  const lease = resolveManagedDependencyLease({ appRoot, projectRoot, applicationName, lockHash });
  const cacheProjectRoot = lease?.sourceProjectRoot || projectRoot;
  const dependencyCacheRoot = path.join(cacheProjectRoot, "cache", applicationName, "dependencies");
  const cacheRoot = path.join(dependencyCacheRoot, lockHash);
  return {
    appRoot, projectRoot, cacheProjectRoot, applicationName, lockHash, dependencyCacheRoot, cacheRoot,
    dependencyRoot: path.join(cacheRoot, "node_modules"),
    linkPath: path.join(appRoot, "node_modules"),
    buildLinkPath: path.join(projectRoot, "build", applicationName, "node_modules"),
    dependencyLeaseId: lease?.leaseId || null,
  };
}

/**
 * 隔离工作树只能消费桌面主进程签发的共享依赖租约；工作树锁文件、源工程锁文件和租约哈希必须完全一致。
 * 普通本地命令没有完整租约环境时继续使用自身工程缓存，禁止半套环境变量悄悄改变数据根。
 */
function resolveManagedDependencyLease({ appRoot, projectRoot, applicationName, lockHash }) {
  const leaseId = process.env.AI_DESKTOP_DEPENDENCY_LEASE_ID;
  if (!leaseId) return null;
  if (!/^[a-zA-Z0-9._-]+$/.test(leaseId)) throw new Error("Managed dependency lease id is invalid");
  const sourceProjectRoot = resolveRegisteredWorktreeSourceRoot(projectRoot);
  const sourceApplicationRoot = path.join(sourceProjectRoot, "apps", applicationName);
  const sourceLockPath = path.join(sourceApplicationRoot, "package-lock.json");
  if (!existsSync(sourceLockPath)) throw new Error("Managed dependency source package-lock.json is missing");
  const sourceLockHash = createHash("sha256").update(readFileSync(sourceLockPath)).digest("hex");
  if (sourceLockHash !== lockHash) throw new Error("Managed dependency source and worktree lock files differ");
  return { leaseId, sourceProjectRoot };
}

/** 共享缓存根只从 Git 已登记 worktree 的公共仓库目录推导，禁止租约或调用方直接提供任意路径。 */
function resolveRegisteredWorktreeSourceRoot(projectRoot) {
  const common = spawnGit(projectRoot, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  const commonDirectory = path.resolve(projectRoot, common);
  if (path.basename(commonDirectory) !== ".git") throw new Error("Managed dependency lease requires a standard Git common directory");
  const sourceProjectRoot = path.dirname(commonDirectory);
  if (path.resolve(sourceProjectRoot) === path.resolve(projectRoot)) {
    throw new Error("Managed dependency lease is only valid for an isolated worktree");
  }
  const worktrees = spawnGit(sourceProjectRoot, ["worktree", "list", "--porcelain"])
    .split(/\r?\n/)
    .filter((line) => line.startsWith("worktree "))
    .map((line) => path.resolve(line.slice("worktree ".length)));
  if (!worktrees.includes(path.resolve(projectRoot))) throw new Error("Managed dependency lease worktree is not registered by Git");
  return sourceProjectRoot;
}

function spawnGit(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Managed dependency Git verification failed: ${(result.stderr || "").trim()}`);
  return String(result.stdout || "").trim();
}

function isInsideRoot(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return Boolean(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function managedLinkTarget(details) {
  const current = lstatSync(details.linkPath, { throwIfNoEntry: false });
  if (!current) return null;
  if (!current.isSymbolicLink()) throw new Error(`Application dependency path must be a symbolic link or junction: ${details.linkPath}`);
  const target = path.resolve(path.dirname(details.linkPath), readlinkSync(details.linkPath));
  const dependencyCacheRoot = details.dependencyCacheRoot || path.dirname(details.cacheRoot);
  if (!isInsideRoot(dependencyCacheRoot, target)) {
    throw new Error(`Application dependency link escaped the application cache: ${details.linkPath}`);
  }
  return target;
}

function createDependencyLink(target, linkPath) {
  mkdirSync(path.dirname(linkPath), { recursive: true });
  symlinkSync(target, linkPath, process.platform === "win32" ? "junction" : "dir");
}

/** 为 VS Code 保留当前锁哈希的本机开发链接；Windows 使用 Junction，macOS 与 Linux 使用目录符号链接，链接本身永不进入 Git。 */
export function attachDeveloperDependencyCache(details = resolveDependencyCache()) {
  if (!existsSync(details.dependencyRoot)) throw new Error(`Dependency cache is missing for current package-lock.json: ${details.cacheRoot}`);
  const currentTarget = managedLinkTarget(details);
  if (currentTarget) {
    if (existsSync(currentTarget) && realpathSync(currentTarget) === realpathSync(details.dependencyRoot)) {
      return { ...details, created: false };
    }
    // 旧锁哈希链接只能在验证仍属于本应用缓存后解除，禁止复用或删除任意外部目录链接。
    rmSync(details.linkPath, { force: true });
  }
  createDependencyLink(details.dependencyRoot, details.linkPath);
  return { ...details, created: true };
}

/** 只解除由本应用缓存签发的开发链接；实体目录和逃出缓存根的链接必须保留现场并阻断。 */
export function detachDeveloperDependencyCache(details = resolveDependencyCache()) {
  const currentTarget = managedLinkTarget(details);
  if (!currentTarget) return { ...details, removed: false };
  rmSync(details.linkPath, { force: true });
  return { ...details, removed: true };
}

/** 在依赖目录迁移后重建 package-lock 中的本地包链接；例如 @selplat/sel-ui 返回指向共享源码的有效目录链接，路径逃逸或普通目录冲突时抛错。 */
export function repairLocalPackageLinks(details = resolveDependencyCache()) {
  if (!existsSync(details.dependencyRoot)) return;
  const lock = JSON.parse(readFileSync(path.join(details.appRoot, "package-lock.json"), "utf8"));
  for (const [packagePath, metadata] of Object.entries(lock.packages || {})) {
    if (!packagePath.startsWith("node_modules/") || metadata?.link !== true || typeof metadata.resolved !== "string") continue;
    const relativePackagePath = packagePath.slice("node_modules/".length);
    const linkPath = path.resolve(details.dependencyRoot, relativePackagePath);
    const targetPath = path.resolve(details.appRoot, metadata.resolved);
    const linkRelative = path.relative(details.dependencyRoot, linkPath);
    const targetRelative = path.relative(details.projectRoot, targetPath);
    if (!relativePackagePath || linkRelative.startsWith(`..${path.sep}`) || path.isAbsolute(linkRelative)) {
      throw new Error(`Local dependency link escaped node_modules: ${packagePath}`);
    }
    if (targetRelative.startsWith(`..${path.sep}`) || targetRelative === ".." || path.isAbsolute(targetRelative) || !existsSync(targetPath)) {
      throw new Error(`Local dependency target escaped or is missing: ${metadata.resolved}`);
    }
    const current = lstatSync(linkPath, { throwIfNoEntry: false });
    // 已指向锁文件声明的本地包时无需重建；只读诊断不能因为无意义的删链操作而要求缓存写权限。
    if (current?.isSymbolicLink() && path.resolve(path.dirname(linkPath), readlinkSync(linkPath)) === targetPath) continue;
    // 哈希缓存中遗留的实体目录会掩盖共享包源码更新；路径已由 linkRelative 验证，收敛为锁文件规定的链接。
    if (current) rmSync(linkPath, { recursive: !current.isSymbolicLink(), force: true });
    mkdirSync(path.dirname(linkPath), { recursive: true });
    createDependencyLink(targetPath, linkPath);
  }
}

export function attachDependencyCache() {
  const details = resolveDependencyCache();
  if (!existsSync(details.dependencyRoot)) throw new Error(`Dependency cache is missing for current package-lock.json: ${details.cacheRoot}`);
  // 普通诊断、类型检查和测试只挂载已准备好的缓存；本地包链接修复仅允许由 ensure/migrate 准备阶段执行，
  // 避免每条固定命令都修改共享缓存并反复触发 Codex 人工权限审批。
  if (existsSync(details.linkPath)) {
    if (lstatSync(details.linkPath).isSymbolicLink()) {
      const linkedDependencyRoot = realpathSync(details.linkPath);
      // 只复用真实指向当前锁哈希缓存的链接；旧哈希链接必须先回收再挂载当前缓存。
      if (linkedDependencyRoot === realpathSync(details.dependencyRoot)) return { ...details, ownsLink: false };
      if (details.dependencyLeaseId) {
        throw new Error(`Managed dependency lease link target does not match the registered repository cache: ${details.linkPath}`);
      }
      rmSync(details.linkPath, { force: true });
    } else {
      // 当前哈希缓存已经完整存在时，源码目录中的实体 node_modules 只是中断迁移留下的可再生产物。
      if (details.dependencyLeaseId) throw new Error(`Managed dependency lease path is not a link: ${details.linkPath}`);
      rmSync(details.linkPath, { recursive: true, force: true });
    }
  }
  if (details.dependencyLeaseId) throw new Error(`Managed dependency lease link is missing: ${details.linkPath}`);
  mkdirSync(path.dirname(details.linkPath), { recursive: true });
  createDependencyLink(details.dependencyRoot, details.linkPath);
  let ownsBuildLink = false;
  if (!existsSync(details.buildLinkPath)) {
    mkdirSync(path.dirname(details.buildLinkPath), { recursive: true });
    createDependencyLink(details.dependencyRoot, details.buildLinkPath);
    ownsBuildLink = true;
  } else if (!lstatSync(details.buildLinkPath).isSymbolicLink()) {
    rmSync(details.linkPath, { force: true });
    throw new Error(`Build dependency path must be a temporary link: ${details.buildLinkPath}`);
  }
  return { ...details, ownsLink: true, ownsBuildLink };
}

export function detachOwnedDependencyCache(details) {
  if (details.ownsLink && existsSync(details.linkPath) && lstatSync(details.linkPath).isSymbolicLink()) rmSync(details.linkPath, { force: true });
  if (details.ownsBuildLink && existsSync(details.buildLinkPath) && lstatSync(details.buildLinkPath).isSymbolicLink()) rmSync(details.buildLinkPath, { force: true });
}
