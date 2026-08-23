import { spawnSync } from "node:child_process";
import path from "node:path";
import { attachDependencyCache, detachOwnedDependencyCache } from "./dependency-cache.mjs";

const [command, ...args] = process.argv.slice(2);
if (!command) throw new Error("A command is required.");
const cache = attachDependencyCache();
try {
  const executable = command === "node"
    ? process.execPath
    : path.join(cache.dependencyRoot, ".bin", process.platform === "win32" ? `${command}.cmd` : command);
  const result = spawnSync(executable, args, {
    cwd: cache.appRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, PATH: `${path.join(cache.dependencyRoot, ".bin")}${path.delimiter}${process.env.PATH || ""}` },
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  detachOwnedDependencyCache(cache);
}
