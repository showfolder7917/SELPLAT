import { mkdirSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { resolveInteractionTestPaths } from "./interaction-test-paths.mjs";

const require = createRequire(import.meta.url);
const appRoot = path.resolve(".");
const projectPaths = resolveInteractionTestPaths();
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
