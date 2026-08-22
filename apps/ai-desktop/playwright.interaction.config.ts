import { mkdirSync } from "node:fs";
import path from "node:path";

import { defineConfig } from "@playwright/test";

const interactionRoot = path.resolve("temp", "interaction");
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
