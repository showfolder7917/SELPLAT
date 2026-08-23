import { cpSync, existsSync, lstatSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = path.resolve(appRoot, "../..");
const compiledRoot = path.join(projectRoot, "build", "shared", "node", "common-core");
const installedPackageRoot = path.join(appRoot, "node_modules", "@selplat", "node-common-core");
const installedRuntimeRoot = path.join(installedPackageRoot, "dist");

if (!existsSync(compiledRoot)) throw new Error(`Node common build is unavailable: ${compiledRoot}`);
let installedPackageStat;
try { installedPackageStat = lstatSync(installedPackageRoot); } catch { installedPackageStat = null; }
if (!installedPackageStat) throw new Error(`Node common package is not installed: ${installedPackageRoot}`);
if (installedPackageStat.isSymbolicLink()) {
  rmSync(installedPackageRoot, { force: true });
  mkdirSync(installedPackageRoot, { recursive: true });
}
if (!existsSync(path.join(installedPackageRoot, "package.json")) && !installedPackageStat.isSymbolicLink()) {
  throw new Error(`Node common package metadata is unavailable: ${installedPackageRoot}`);
}
cpSync(path.join(projectRoot, "shared", "node", "common-core", "package.json"), path.join(installedPackageRoot, "package.json"));
cpSync(path.join(projectRoot, "shared", "node", "common-core", "README.md"), path.join(installedPackageRoot, "README.md"));
rmSync(installedRuntimeRoot, { recursive: true, force: true });
mkdirSync(installedPackageRoot, { recursive: true });
cpSync(compiledRoot, installedRuntimeRoot, { recursive: true });
console.log(`Synchronized @selplat/node-common-core runtime: ${installedRuntimeRoot}`);
