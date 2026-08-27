const { readFileSync } = require("node:fs");
const path = require("node:path");

const applicationRoot = __dirname;
const baseConfig = JSON.parse(readFileSync(path.join(applicationRoot, "electron-builder.developer.json"), "utf8"));

/** 客户包不写入构建机工程根；运行时在 userData/workspace 建立独立数据工作区。 */
module.exports = {
  ...baseConfig,
  appId: "com.selplat.aidesktop",
  directories: { output: "../../build/ai-desktop/package/customer" },
  extraMetadata: {
    aiDesktopVariant: "developer",
    main: "dist-electron/electron/packaged-bootstrap.js",
  },
  win: {
    ...baseConfig.win,
    artifactName: "AI-Desktop-${version}-Setup.${ext}",
  },
};
