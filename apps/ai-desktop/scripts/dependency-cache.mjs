import { createHash } from "node:crypto";
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
  const dependencyCacheRoot = path.join(projectRoot, "cache", applicationName, "dependencies");
  const cacheRoot = path.join(dependencyCacheRoot, lockHash);
  return {
    appRoot, projectRoot, applicationName, lockHash, dependencyCacheRoot, cacheRoot,
    dependencyRoot: path.join(cacheRoot, "node_modules"),
    linkPath: path.join(appRoot, "node_modules"),
    buildLinkPath: path.join(projectRoot, "build", applicationName, "node_modules"),
  };
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
  repairLocalPackageLinks(details);
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
    if (current && !current.isSymbolicLink()) continue;
    // 已指向锁文件声明的本地包时无需重建；只读诊断不能因为无意义的删链操作而要求缓存写权限。
    if (current && path.resolve(path.dirname(linkPath), readlinkSync(linkPath)) === targetPath) continue;
    if (current) rmSync(linkPath, { force: true });
    mkdirSync(path.dirname(linkPath), { recursive: true });
    createDependencyLink(targetPath, linkPath);
  }
}

export function attachDependencyCache(options = {}) {
  const details = resolveDependencyCache();
  if (!existsSync(details.dependencyRoot)) throw new Error(`Dependency cache is missing for current package-lock.json: ${details.cacheRoot}`);
  repairLocalPackageLinks(details);
  if (existsSync(details.linkPath)) {
    if (lstatSync(details.linkPath).isSymbolicLink()) {
      const linkedDependencyRoot = realpathSync(details.linkPath);
      // 只复用真实指向当前锁哈希缓存的链接；旧哈希链接必须先回收再挂载当前缓存。
      if (linkedDependencyRoot === realpathSync(details.dependencyRoot)) return { ...details, ownsLink: false };
      // 签发 worktree 的外层验证器已核对锁文件并挂载主工程缓存；内层命令只借用该链接，所有权仍由外层回收。
      if (options.preserveExistingLink === true) {
        return { ...details, dependencyRoot: linkedDependencyRoot, ownsLink: false, ownsBuildLink: false };
      }
      rmSync(details.linkPath, { force: true });
    } else {
      // 当前哈希缓存已经完整存在时，源码目录中的实体 node_modules 只是中断迁移留下的可再生产物。
      rmSync(details.linkPath, { recursive: true, force: true });
    }
  }
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
