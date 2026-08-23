import { mkdirSync } from "node:fs";
import path from "node:path";

import { defineConfig } from "@playwright/test";
import { resolveApplicationDataPaths, resolveApplicationNameFromSourceRoot } from "@selplat/node-common-core/path";

const taskSegment = (process.env.AI_DESKTOP_TEST_TASK_ID || "standalone")
  .toLowerCase()
  .replaceAll(/[^a-z0-9._-]+/g, "-")
  .replaceAll(/^-+|-+$/g, "")
  .slice(0, 100) || "standalone";
const appRoot = path.resolve(".");
const projectPaths = resolveApplicationDataPaths({ selplatRoot: path.resolve(appRoot, "../.."), applicationName: resolveApplicationNameFromSourceRoot(appRoot) });
const interactionRoot = path.join(projectPaths.temporaryMaterialsRoot, "测试证据", "interaction", taskSegment);
mkdirSync(interactionRoot, { recursive: true });

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
  webServer: {
    command: "cross-env VITE_APP_VARIANT=developer vite --host 127.0.0.1 --port 4197 --strictPort",
    url: "http://127.0.0.1:4197",
    reuseExistingServer: false,
    timeout: 30_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
