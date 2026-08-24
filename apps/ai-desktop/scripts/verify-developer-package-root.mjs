import { existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { extractFile } = require("@electron/asar");
const applicationRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expectedRoot = path.resolve(process.env.SELPLAT_ROOT || path.join(applicationRoot, "../.."));
const packageRoot = path.join(expectedRoot, "build", "ai-desktop", "package", "developer");

const candidates = [path.join(packageRoot, "win-unpacked", "resources", "app.asar")];
if (existsSync(packageRoot)) {
  for (const entry of readdirSync(packageRoot, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name.startsWith("mac")) {
      candidates.push(path.join(packageRoot, entry.name, "AI Desktop.app", "Contents", "Resources", "app.asar"));
    }
  }
}
const asarPath = candidates.find((candidate) => existsSync(candidate));
if (!asarPath) throw new Error(`Packaged developer application is unavailable: ${packageRoot}`);

// 读取真实打包产物而不是源码配置，确保 electron-builder 已把开发根合并进最终应用清单。
const packagedManifest = JSON.parse(extractFile(asarPath, "package.json").toString("utf8"));
if (path.resolve(packagedManifest.selplatDevelopmentRoot || "") !== expectedRoot) {
  throw new Error(`Packaged SELPLAT root mismatch: ${packagedManifest.selplatDevelopmentRoot || "missing"}`);
}
console.log(`Packaged developer root verified: ${expectedRoot}`);
