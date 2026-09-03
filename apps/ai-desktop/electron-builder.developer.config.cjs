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
const buildRoot = path.join(selplatRoot, "build", "ai-desktop");
const extraResources = baseConfig.extraResources.map((resource) => {
  if (resource.to === "ruleengine") return { ...resource, from: path.join(buildRoot, "rule-bundle") };
  if (resource.to === "prompts") return { ...resource, from: path.join(buildRoot, "prompt-bundle") };
  return resource;
});

module.exports = {
  ...baseConfig,
  directories: {
    ...baseConfig.directories,
    output: path.join(selplatRoot, "build", "ai-desktop", "package", "developer"),
  },
  // 开发版打包复用依赖缓存中已经安装并校验过的 Electron，避免再次进入外部下载缓存的解压等待。
  electronDist: path.join(applicationRoot, "node_modules", "electron", "dist"),
  // 规则与提示词 bundle 按所选工程根生成；候选工作树的相对 build 目录不包含它们。
  extraResources,
  // 只有开发版包写入构建机的工程定位；其他发布配置不得复用本文件，避免携带该绝对路径。
  extraMetadata: {
    ...baseConfig.extraMetadata,
    selplatDevelopmentRoot: selplatRoot,
  },
};
