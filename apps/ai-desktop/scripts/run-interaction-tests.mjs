import { mkdirSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { resolveApplicationDataPaths, resolveApplicationNameFromSourceRoot } from "@selplat/node-common-core/path";

const require = createRequire(import.meta.url);
// 协同 worktree 路径可能包含空格，必须先解码 file URL，避免把 `%20` 当成真实目录名。
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = path.resolve(appRoot, "../..");
const projectPaths = resolveApplicationDataPaths({ selplatRoot: projectRoot, applicationName: resolveApplicationNameFromSourceRoot(appRoot) });
const taskSegment = (process.env.AI_DESKTOP_TEST_TASK_ID || "standalone")
  .toLowerCase()
  .replaceAll(/[^a-z0-9._-]+/g, "-")
  .replaceAll(/^-+|-+$/g, "")
  .slice(0, 100) || "standalone";
const temporaryRoot = path.join(projectPaths.temporaryMaterialsRoot, "测试证据", "interaction", taskSegment);
mkdirSync(temporaryRoot, { recursive: true });

// 每个签发任务的转换缓存、报告和失败截图独立进入工程临时数据域，避免多人分支互相覆盖。
const child = spawn(process.execPath, [require.resolve("@playwright/test/cli"), "test", "--config", "playwright.interaction.config.ts"], {
  cwd: appRoot,
  env: {
    ...process.env,
    TMPDIR: temporaryRoot,
    TEMP: temporaryRoot,
    TMP: temporaryRoot,
    AI_DESKTOP_TEMP_MATERIALS_ROOT: projectPaths.temporaryMaterialsRoot,
    AI_DESKTOP_ARCHIVE_LOG_ROOT: projectPaths.archiveLogRoot,
  },
  stdio: "inherit",
});

child.once("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.once("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
