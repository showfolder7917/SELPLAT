import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const releaseRoot = path.join(appRoot, "release", "developer");
const macDirectory = readdirSync(releaseRoot, { withFileTypes: true })
  .find((entry) => entry.isDirectory() && entry.name.startsWith("mac"));
if (!macDirectory) throw new Error("未找到 macOS 开发版输出目录。");

const applicationPath = path.join(releaseRoot, macDirectory.name, "AI Desktop.app");
if (!existsSync(applicationPath)) throw new Error("未找到 AI Desktop.app。");

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
console.log(`AI Desktop.app 身份、稳定指定要求与签名验证通过：${bundleId}`);
