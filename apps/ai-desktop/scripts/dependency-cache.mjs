import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
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

export function attachDependencyCache() {
  const details = resolveDependencyCache();
  if (!existsSync(details.dependencyRoot)) throw new Error(`Dependency cache is missing for current package-lock.json: ${details.cacheRoot}`);
  if (existsSync(details.linkPath)) {
    if (lstatSync(details.linkPath).isSymbolicLink()) return { ...details, ownsLink: false };
    throw new Error(`Generated dependency directory must be migrated out of source first: ${details.linkPath}`);
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
