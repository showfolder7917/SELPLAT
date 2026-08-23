import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync } from "node:fs";
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
  const cacheRoot = path.join(projectRoot, "cache", applicationName, "dependencies", lockHash);
  return {
    appRoot, projectRoot, applicationName, lockHash, cacheRoot,
    dependencyRoot: path.join(cacheRoot, "node_modules"),
    linkPath: path.join(appRoot, "node_modules"),
    buildLinkPath: path.join(projectRoot, "build", applicationName, "node_modules"),
  };
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
    if (current) rmSync(linkPath, { force: true });
    mkdirSync(path.dirname(linkPath), { recursive: true });
    symlinkSync(targetPath, linkPath, process.platform === "win32" ? "junction" : "dir");
  }
}

export function attachDependencyCache() {
  const details = resolveDependencyCache();
  if (!existsSync(details.dependencyRoot)) throw new Error(`Dependency cache is missing for current package-lock.json: ${details.cacheRoot}`);
  repairLocalPackageLinks(details);
  if (existsSync(details.linkPath)) {
    if (lstatSync(details.linkPath).isSymbolicLink()) {
      // 只复用真实指向当前锁哈希缓存的链接；旧哈希链接必须先回收再挂载当前缓存。
      if (realpathSync(details.linkPath) === realpathSync(details.dependencyRoot)) return { ...details, ownsLink: false };
      rmSync(details.linkPath, { force: true });
    } else {
      // 当前哈希缓存已经完整存在时，源码目录中的实体 node_modules 只是中断迁移留下的可再生产物。
      rmSync(details.linkPath, { recursive: true, force: true });
    }
  }
  mkdirSync(path.dirname(details.linkPath), { recursive: true });
  symlinkSync(details.dependencyRoot, details.linkPath, process.platform === "win32" ? "junction" : "dir");
  let ownsBuildLink = false;
  if (!existsSync(details.buildLinkPath)) {
    mkdirSync(path.dirname(details.buildLinkPath), { recursive: true });
    symlinkSync(details.dependencyRoot, details.buildLinkPath, process.platform === "win32" ? "junction" : "dir");
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
