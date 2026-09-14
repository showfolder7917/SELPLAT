import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertDeveloperPackageInputCapacity, cleanupDeveloperPackageInput, prepareDeveloperPackageInput } from "./developer-package-input.mjs";

const applicationRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = path.resolve(applicationRoot, "../..");
const builderArguments = process.argv.slice(2);
if (!builderArguments.length) throw new Error("Developer packaging requires an electron-builder target.");

// 构建后可用空间仍可能变化，所有 electron-builder 调用都在复制依赖前再次确认候选卷容量。
assertDeveloperPackageInputCapacity({ applicationRoot, projectRoot });
const packageInputRoot = prepareDeveloperPackageInput({ applicationRoot, projectRoot });
try {
  const result = spawnSync(
    process.execPath,
    [
      "scripts/run-with-dependencies.mjs",
      "electron-builder",
      "--projectDir",
      "../..",
      "--config",
      "apps/ai-desktop/electron-builder.developer.config.cjs",
      ...builderArguments,
    ],
    {
      cwd: applicationRoot,
      stdio: "inherit",
      shell: false,
      env: { ...process.env, AI_DESKTOP_PACKAGE_INPUT_ROOT: packageInputRoot },
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
} finally {
  cleanupDeveloperPackageInput({ projectRoot, packageInputRoot });
}
