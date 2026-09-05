import { mkdirSync } from "node:fs";
import path from "node:path";

import { defineConfig } from "@playwright/test";
import { resolveInteractionTestPaths } from "./scripts/interaction-test-paths.mjs";

const taskSegment = (process.env.AI_DESKTOP_TEST_TASK_ID || "standalone")
  .toLowerCase()
  .replaceAll(/[^a-z0-9._-]+/g, "-")
  .replaceAll(/^-+|-+$/g, "")
  .slice(0, 100) || "standalone";
const appRoot = path.resolve(".");
const projectPaths = resolveInteractionTestPaths();
const runSegment = (process.env.AI_DESKTOP_TEST_RUN_ID || "").replaceAll(/[^a-zA-Z0-9_-]/g, "");
const interactionRoot = path.join(projectPaths.temporaryMaterialsRoot, "测试证据", "interaction", taskSegment, runSegment);
mkdirSync(interactionRoot, { recursive: true });
process.env.AI_DESKTOP_INTERACTION_USER_DATA_ROOT = path.join(interactionRoot, "user-data");

export default defineConfig({
  testDir: "./tests/interaction",
  fullyParallel: false,
  workers: 1,
  timeout: 15_000,
  expect: { timeout: 5_000 },
  outputDir: path.join(interactionRoot, "artifacts"),
  reporter: [
    ["line"],
    ["json", { outputFile: path.join(interactionRoot, "result.json") }],
  ],
  use: {
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  // 主桌面用例直接加载生产文件；本地服务仅供独立截图编辑器测试入口使用。
  webServer: {
    command: "cross-env VITE_APP_VARIANT=developer vite --host 127.0.0.1 --port 4197 --strictPort",
    url: "http://127.0.0.1:4197",
    reuseExistingServer: false,
    timeout: 30_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
