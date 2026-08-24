import { createHash } from "node:crypto";
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveDependencyCache } from "./dependency-cache.mjs";

const applicationRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = path.resolve(applicationRoot, "../..");
const manifest = JSON.parse(readFileSync(path.join(applicationRoot, "package.json"), "utf8"));
const releaseRoot = path.join(projectRoot, "build", "ai-desktop", "package", "developer");
const portableRoot = path.join(releaseRoot, "win-unpacked");
const builtRendererRoot = path.join(projectRoot, "build", "ai-desktop", "renderer", "developer");
const portableRendererRoot = path.join(portableRoot, "dist", "developer");
const builderExecutablePath = path.join(portableRoot, "AI Desktop.exe");
const executablePath = path.join(portableRoot, "electron.exe");
const launcherPath = path.join(portableRoot, "启动压缩包版.bat");
const archivePath = path.join(releaseRoot, `AI-Desktop-Developer-压缩包版-${manifest.version}.zip`);
const dataRoot = "C:\\opt\\workspace\\SELPLAT";
const dependencyCache = resolveDependencyCache();
const lockedElectronRoot = path.join(dependencyCache.dependencyRoot, "electron", "dist");
const lockedElectronExecutable = path.join(lockedElectronRoot, "electron.exe");

function quotePowerShellLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

if (process.platform !== "win32") {
  throw new Error("开发版便携 ZIP 只能在 Windows 生成。");
}
if (!existsSync(builderExecutablePath)) {
  throw new Error(`Portable Electron directory is unavailable: ${portableRoot}`);
}
if (!existsSync(lockedElectronExecutable)) {
  throw new Error(`Locked Electron executable is unavailable: ${lockedElectronExecutable}`);
}
if (!existsSync(path.join(builtRendererRoot, "index.html"))) {
  throw new Error(`Built developer renderer is unavailable: ${builtRendererRoot}`);
}

// 免安装开发版整体恢复本机已验证可运行的锁定 Electron 运行目录，同时保留 Builder 生成的 app.asar。
cpSync(lockedElectronRoot, portableRoot, { recursive: true, force: true });
cpSync(builtRendererRoot, portableRendererRoot, { recursive: true, force: true });
rmSync(builderExecutablePath, { force: true });

const launcher = [
  "@echo off",
  "setlocal EnableExtensions DisableDelayedExpansion",
  "chcp 65001 >nul",
  "title AI Desktop - Archive Edition",
  `set "SELPLAT_ROOT=${dataRoot}"`,
  "set \"AI_DESKTOP_USER_DATA=%SELPLAT_ROOT%\\cache\\ai-desktop\\user-data\"",
  "if not exist \"%SELPLAT_ROOT%\" mkdir \"%SELPLAT_ROOT%\"",
  "if not exist \"%AI_DESKTOP_USER_DATA%\" mkdir \"%AI_DESKTOP_USER_DATA%\"",
  "echo [AI Desktop Archive Edition] Data root: %SELPLAT_ROOT%",
  "start \"AI Desktop Archive Edition\" /wait \"%~dp0electron.exe\" \"%~dp0resources\\app.asar\" \"--disable-gpu\" \"--in-process-gpu\" \"--ai-desktop-variant=developer\" \"--ai-desktop-distribution=archive\" \"--selplat-root=%SELPLAT_ROOT%\" \"--ai-desktop-user-data-dir=%AI_DESKTOP_USER_DATA%\"",
  "exit /b %ERRORLEVEL%",
  "",
].join("\r\n");
writeFileSync(launcherPath, launcher, "utf8");

const compressCommand = [
  "Compress-Archive",
  `-Path ${quotePowerShellLiteral(path.join(portableRoot, "*"))}`,
  `-DestinationPath ${quotePowerShellLiteral(archivePath)}`,
  "-CompressionLevel Optimal",
  "-Force",
].join(" ");
const compressed = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", compressCommand], {
  cwd: projectRoot,
  stdio: "inherit",
});
if (compressed.status !== 0) process.exit(compressed.status ?? 1);

const sha256 = createHash("sha256").update(readFileSync(archivePath)).digest("hex");
console.log(JSON.stringify({ archivePath, portableRoot, dataRoot, distributionLabel: "压缩包版", sha256 }, null, 2));
