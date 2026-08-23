import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, rmSync, symlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = path.resolve(appRoot, "../..");
const commonRoot = path.join(projectRoot, "shared", "node", "common-core");
const dependencyRoot = path.join(appRoot, "node_modules");
const commonDependencyLink = path.join(commonRoot, "node_modules");
if (!existsSync(path.join(dependencyRoot, "typescript"))) throw new Error(`AI Desktop dependency tree is unavailable: ${dependencyRoot}`);

let ownsLink = false;
try {
  if (!existsSync(commonDependencyLink)) {
    symlinkSync(dependencyRoot, commonDependencyLink, process.platform === "win32" ? "junction" : "dir");
    ownsLink = true;
  } else if (!lstatSync(commonDependencyLink).isSymbolicLink()) {
    throw new Error(`Node common dependency path must be a temporary link: ${commonDependencyLink}`);
  }
  const compiler = path.join(dependencyRoot, ".bin", process.platform === "win32" ? "tsc.cmd" : "tsc");
  const result = spawnSync(compiler, ["-p", path.join(commonRoot, "tsconfig.json")], { cwd: projectRoot, stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status ?? 1);
} finally {
  if (ownsLink) rmSync(commonDependencyLink, { force: true });
}
