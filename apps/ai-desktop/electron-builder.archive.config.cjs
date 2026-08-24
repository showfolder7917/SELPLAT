const { existsSync } = require("node:fs");
const path = require("node:path");

const developerConfig = require("./electron-builder.developer.config.cjs");
const electronDist = path.join(__dirname, "node_modules", "electron", "dist");
if (!existsSync(path.join(electronDist, "electron.exe"))) {
  throw new Error(`Local Electron runtime is unavailable: ${electronDist}`);
}

module.exports = {
  ...developerConfig,
  // 压缩包版只使用锁定依赖中的 Electron 运行时，禁止发布阶段再访问公网下载。
  electronDist,
  win: {
    ...developerConfig.win,
    target: "dir",
  },
};
