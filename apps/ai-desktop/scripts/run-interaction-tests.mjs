import { mkdirSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const appRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const temporaryRoot = path.join(appRoot, "temp", "interaction");
mkdirSync(temporaryRoot, { recursive: true });

// Playwright 的转换缓存、报告和失败截图全部进入应用 temp，避免污染系统临时目录并支持一键清理。
const child = spawn(process.execPath, [require.resolve("@playwright/test/cli"), "test", "--config", "playwright.interaction.config.ts"], {
  cwd: appRoot,
  env: { ...process.env, TMPDIR: temporaryRoot, TEMP: temporaryRoot, TMP: temporaryRoot },
  stdio: "inherit",
});

child.once("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.once("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
