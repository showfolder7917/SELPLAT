import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveApplicationDataPaths, resolveApplicationNameFromSourceRoot } from "@selplat/node-common-core/path";
import { assertWorkspaceDataPath, resolveSelectedWorkspaceRoot } from "./selected-workspace-root.mjs";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceProjectRoot = path.resolve(appRoot, "../..");
const projectRoot = resolveSelectedWorkspaceRoot(sourceProjectRoot);
const projectPaths = resolveApplicationDataPaths({ selplatRoot: projectRoot, applicationName: resolveApplicationNameFromSourceRoot(appRoot) });
const releaseRoot = path.join(projectPaths.buildRoot, "package", "developer");
const macDirectory = readdirSync(releaseRoot, { withFileTypes: true })
  .find((entry) => entry.isDirectory() && entry.name.startsWith("mac"));
if (!macDirectory) throw new Error("未找到 macOS 开发版输出目录。");

const applicationPath = path.join(releaseRoot, macDirectory.name, "AI Desktop.app");
if (!existsSync(applicationPath)) throw new Error("未找到 AI Desktop.app。");

const targetCodexVersion = "0.149.0";
const codexArchitecture = process.arch === "arm64" ? "aarch64-apple-darwin" : "x86_64-apple-darwin";
const codexPackage = process.arch === "arm64" ? "codex-darwin-arm64" : "codex-darwin-x64";
const codexPath = path.join(applicationPath, "Contents", "Resources", "app.asar.unpacked", "node_modules", "@openai", codexPackage, "vendor", codexArchitecture, "bin", "codex");
if (!existsSync(codexPath)) throw new Error(`安装包缺少内置 Codex ${targetCodexVersion}：${codexPath}`);
const codexVersion = execFileSync(codexPath, ["--version"], { encoding: "utf8" }).trim();
if (codexVersion !== `codex-cli ${targetCodexVersion}`) throw new Error(`安装包 Codex 版本错误：${codexVersion}`);
execFileSync("codesign", ["--verify", "--strict", codexPath], { stdio: "inherit" });
const codexSignature = spawnSync("codesign", ["-dv", "--verbose=4", codexPath], { encoding: "utf8" });
if (codexSignature.status !== 0) throw new Error("无法读取安装包 Codex 签名。");
const codexSignatureOutput = `${codexSignature.stdout || ""}${codexSignature.stderr || ""}`;
if (!codexSignatureOutput.includes("TeamIdentifier=2DC432GLL2")) throw new Error("安装包 Codex 不是 OpenAI 官方签名。");

const plistPath = path.join(applicationPath, "Contents", "Info.plist");
const bundleId = execFileSync("plutil", ["-extract", "CFBundleIdentifier", "raw", "-o", "-", plistPath], { encoding: "utf8" }).trim();
if (bundleId !== "com.selplat.aidesktop.developer") throw new Error(`应用身份错误：${bundleId}`);
execFileSync("codesign", ["--verify", "--deep", "--strict", applicationPath], { stdio: "inherit" });
const requirementResult = spawnSync("codesign", ["-d", "--requirements", "-", applicationPath], { encoding: "utf8" });
if (requirementResult.status !== 0) throw new Error("无法读取 AI Desktop.app 指定要求。");
const requirementOutput = `${requirementResult.stdout || ""}${requirementResult.stderr || ""}`;
const expectedRequirement = `designated => identifier "${bundleId}"`;
if (!requirementOutput.includes(expectedRequirement)) {
  throw new Error(`AI Desktop.app 屏幕录制身份不稳定：期望 ${expectedRequirement}`);
}
const healthRoot = assertWorkspaceDataPath(projectRoot, path.join(projectPaths.temporaryMaterialsRoot, "候选包健康检查"));
mkdirSync(healthRoot, { recursive: true });
const healthRun = mkdtempSync(path.join(healthRoot, "run-"));
const healthFile = path.join(healthRun, "ready.json");
let healthCheckPassed = false;
const describeHealthCheckFailure = (health, cause = null) => {
  const healthDiagnostics = {
    diagnosticsDirectory: healthRun,
    status: health.status,
    signal: health.signal,
    error: health.error?.message || null,
    stdout: health.stdout || "",
    stderr: health.stderr || "",
    healthFile,
    healthFileContent: existsSync(healthFile) ? readFileSync(healthFile, "utf8") : null,
    cause,
  };
  return `候选包隔离启动失败；保留诊断目录：${healthRun}\n${JSON.stringify(healthDiagnostics, null, 2)}`;
};
try {
  const executable = path.join(applicationPath, "Contents", "MacOS", "AI Desktop");
  const health = spawnSync(executable, [
    `--selplat-root=${projectRoot}`,
    "--ai-desktop-variant=developer",
    `--ai-desktop-user-data-dir=${path.join(healthRun, "user-data")}`,
    `--ai-desktop-health-check-file=${healthFile}`,
  ], { encoding: "utf8", timeout: 30_000 });
  if (health.error || health.status !== 0 || !existsSync(healthFile)) {
    throw new Error(describeHealthCheckFailure(health));
  }
  let healthResult;
  try {
    healthResult = JSON.parse(readFileSync(healthFile, "utf8"));
  } catch (error) {
    throw new Error(describeHealthCheckFailure(health, error instanceof Error ? error.message : String(error)));
  }
  if (healthResult.status !== "ready") {
    throw new Error(describeHealthCheckFailure(health, `候选包未报告 ready 状态：${healthResult.status || "missing"}`));
  }
  healthCheckPassed = true;
} finally {
  if (healthCheckPassed) rmSync(healthRun, { recursive: true, force: true });
}
console.log(`AI Desktop.app 身份、稳定指定要求、内置 Codex ${targetCodexVersion}、OpenAI 签名与隔离启动验证通过：${bundleId}`);
