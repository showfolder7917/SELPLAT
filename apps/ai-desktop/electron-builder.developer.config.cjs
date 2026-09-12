const { existsSync, readFileSync } = require("node:fs");
const path = require("node:path");

const applicationRoot = __dirname;
// 候选工作树打包时由发布协调器传入稳定源工程根；普通本地打包则从当前应用目录定位本轮真实工程。
const selplatRoot = path.resolve(process.env.SELPLAT_ROOT || path.join(applicationRoot, "../.."));
const manifestPath = path.join(selplatRoot, "apps", "ai-desktop", "package.json");
if (!existsSync(path.join(selplatRoot, ".git")) || !existsSync(manifestPath)) {
  throw new Error(`SELPLAT development root is unavailable: ${selplatRoot}`);
}

const baseConfig = JSON.parse(readFileSync(path.join(applicationRoot, "electron-builder.developer.json"), "utf8"));
const sourceBundleBuildRoot = path.join(selplatRoot, "build", "ai-desktop");
const candidateProjectRoot = path.resolve(applicationRoot, "../..");
const candidateBuildRoot = path.join(candidateProjectRoot, "build", "ai-desktop");
const packageInputRoot = process.env.AI_DESKTOP_PACKAGE_INPUT_ROOT
  ? path.resolve(process.env.AI_DESKTOP_PACKAGE_INPUT_ROOT)
  : applicationRoot;
if (!existsSync(path.join(packageInputRoot, "package.json")) || !existsSync(path.join(packageInputRoot, "node_modules"))) {
  throw new Error(`AI Desktop package input is unavailable: ${packageInputRoot}`);
}
// SELPLAT_ROOT 指向发布后仍存在的源工程；打包输入必须属于当前候选工作树，两者在隔离发布时不同。
const relativePackageInput = path.relative(candidateProjectRoot, packageInputRoot);
if (relativePackageInput === ".." || relativePackageInput.startsWith(`..${path.sep}`) || path.isAbsolute(relativePackageInput)) {
  throw new Error(`AI Desktop package input escaped the candidate project: ${packageInputRoot}`);
}
// projectDir 是候选工程根时，electron-builder 不会再从应用依赖目录自动推断版本，必须使用已挂载运行时的精确版本。
const electronPackage = JSON.parse(readFileSync(path.join(applicationRoot, "node_modules", "electron", "package.json"), "utf8"));
const electronVersion = String(electronPackage.version || "").trim();
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(electronVersion)) {
  throw new Error(`AI Desktop Electron version is unavailable: ${electronVersion || "missing"}`);
}
const extraResources = baseConfig.extraResources.map((resource) => {
  if (resource.to === "ruleengine") return { ...resource, from: path.join(sourceBundleBuildRoot, "rule-bundle") };
  if (resource.to === "prompts") return { ...resource, from: path.join(sourceBundleBuildRoot, "prompt-bundle") };
  if (resource.to === "db/sql") return { ...resource, from: path.join(applicationRoot, "db", "sql") };
  return resource;
});
const files = baseConfig.files.map((entry) => {
  if (typeof entry === "string") return entry;
  if (entry.from === "../../build/ai-desktop/renderer/developer") {
    return { ...entry, from: path.join(candidateBuildRoot, "renderer", "developer") };
  }
  if (entry.from === "../../build/ai-desktop/electron") {
    return { ...entry, from: path.join(candidateBuildRoot, "electron") };
  }
  return entry;
});

module.exports = {
  ...baseConfig,
  directories: {
    ...baseConfig.directories,
    // projectDir 指向 SELPLAT 根后，应用元数据和 files 相对路径仍以 AI Desktop 应用目录为准。
    app: packageInputRoot,
    output: path.join(selplatRoot, "build", "ai-desktop", "package", "developer"),
  },
  // 开发版打包复用依赖缓存中已经安装并校验过的 Electron，避免再次进入外部下载缓存的解压等待。
  electronDist: path.join(applicationRoot, "node_modules", "electron", "dist"),
  // 与 electronDist 同源，避免 projectDir 下没有 node_modules 时触发错误的自动版本扫描。
  electronVersion,
  files,
  // 规则与提示词 bundle 按所选工程根生成；候选工作树的相对 build 目录不包含它们。
  extraResources,
  // 只有开发版包写入构建机的工程定位；其他发布配置不得复用本文件，避免携带该绝对路径。
  extraMetadata: {
    ...baseConfig.extraMetadata,
    selplatDevelopmentRoot: selplatRoot,
  },
};
