import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const applicationRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = path.resolve(process.env.SELPLAT_ROOT || path.join(applicationRoot, "../.."));
if (!existsSync(path.join(projectRoot, "settings.gradle"))) {
  throw new Error(`Invalid SELPLAT root for Developer startup: ${projectRoot}`);
}

const electronRoot = path.join(applicationRoot, "node_modules", "electron");
const electronExecutable = path.resolve(electronRoot, "dist", readFileSync(path.join(electronRoot, "path.txt"), "utf8").trim());
const userDataRoot = path.join(projectRoot, "cache", "ai-desktop", "user-data");
const argumentsToPass = [
  applicationRoot,
  "--disable-gpu",
  "--disable-gpu-compositing",
  "--disable-software-rasterizer",
  "--no-sandbox",
  `--selplat-root=${projectRoot}`,
  `--ai-desktop-user-data-dir=${userDataRoot}`,
];

// 桌面开发版直接加载已编译的本地页面，不启动前端服务，也不占用开发端口。
const result = spawnSync(electronExecutable, argumentsToPass, {
  cwd: applicationRoot,
  stdio: "inherit",
  shell: false,
  env: { ...process.env, AI_DESKTOP_VARIANT: "developer" },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
