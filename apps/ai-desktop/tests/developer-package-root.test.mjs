import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const applicationRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expectedDevelopmentRoot = path.resolve(process.env.SELPLAT_ROOT || path.join(applicationRoot, "../.."));
const developerConfig = require("../electron-builder.developer.config.cjs");
const archiveConfigSource = readFileSync(new URL("../electron-builder.archive.config.cjs", import.meta.url), "utf8");
const packageManifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const appConfigSource = readFileSync(new URL("../electron/config/app-config.ts", import.meta.url), "utf8");
const unifiedRunnerSource = readFileSync(new URL("../electron/services/collaboration/linghu-unified-test-runner.ts", import.meta.url), "utf8");
const packagedVerifierSource = readFileSync(new URL("../scripts/verify-developer-package-root.mjs", import.meta.url), "utf8");
const developerBatchSource = readFileSync(new URL("../启动开发版.bat", import.meta.url), "utf8");
const variantBatchSource = readFileSync(new URL("../scripts/start-variant.bat", import.meta.url), "utf8");
const developerDesktopLauncherSource = readFileSync(new URL("../scripts/start-developer-desktop.mjs", import.meta.url), "utf8");
const archiveReleaseBuilderSource = readFileSync(new URL("../scripts/build-developer-archive-release.mjs", import.meta.url), "utf8");
const mainSource = readFileSync(new URL("../electron/main.ts", import.meta.url), "utf8");
const mainWindowSource = readFileSync(new URL("../electron/window/create-main-window.ts", import.meta.url), "utf8");
const developerAppSource = readFileSync(new URL("../src/variants/developer/DeveloperApp.tsx", import.meta.url), "utf8");

test("全部开发版打包入口自动注入稳定 SELPLAT 工程根", () => {
  assert.equal(developerConfig.extraMetadata.selplatDevelopmentRoot, expectedDevelopmentRoot);
  for (const scriptName of ["dist:win:developer", "dist:mac:developer", "package:mac:developer"]) {
    assert.match(packageManifest.scripts[scriptName], /--config electron-builder\.developer\.config\.cjs/);
  }
  assert.match(unifiedRunnerSource, /SELPLAT_ROOT: this\.#sourceProjectRoot/);
  assert.match(packageManifest.scripts["verify:developer-package-root"], /verify-developer-package-root\.mjs/);
  assert.match(packagedVerifierSource, /mtimeMs/, "多平台产物并存时必须验证最新生成的真实包");
  assert.match(packagedVerifierSource, /extractFile\(asarPath, "package\.json"\)/);
  assert.match(packagedVerifierSource, /packagedManifest\.selplatDevelopmentRoot/);
});

test("运行时优先使用显式覆盖且只有开发包读取内置工程根", () => {
  const argumentIndex = appConfigSource.indexOf("const argumentRoot");
  const environmentIndex = appConfigSource.indexOf("process.env.SELPLAT_ROOT", argumentIndex);
  const metadataIndex = appConfigSource.indexOf("typeof packagedDevelopmentRoot", environmentIndex);
  assert.ok(argumentIndex >= 0 && environmentIndex > argumentIndex && metadataIndex > environmentIndex);
  assert.match(appConfigSource, /const packagedDevelopmentRoot = app\.isPackaged[\s\S]*readApplicationMetadata\(\)\.selplatDevelopmentRoot/);
});

test("Windows BAT 开发版从脚本位置解析工程根并进入无端口桌面链路", () => {
  assert.match(developerBatchSource, /scripts\\start-variant\.bat" developer/);
  assert.match(variantBatchSource, /for %%I in \("%AI_DESKTOP_ROOT%\\\.\.\\\.\."\) do set "SELPLAT_ROOT=%%~fI"/);
  assert.match(variantBatchSource, /npm run dependencies:ensure/);
  assert.match(variantBatchSource, /npm run start:developer/);
  assert.doesNotMatch(variantBatchSource, /desktop:dev:developer --/);
  assert.doesNotMatch(variantBatchSource, /desktop:dev:developer/);
  assert.match(packageManifest.scripts["start:developer"], /start-developer-desktop\.mjs/);
  assert.equal(packageManifest.scripts["desktop:dev"], undefined);
  assert.equal(packageManifest.scripts["desktop:dev:developer"], undefined);
  assert.match(developerDesktopLauncherSource, /`--selplat-root=\$\{projectRoot\}`/);
  assert.doesNotMatch(developerDesktopLauncherSource, /VITE_DEV_SERVER_URL|vite|5173/i);
  assert.match(developerDesktopLauncherSource, /"--disable-gpu-compositing"/);
  assert.match(developerDesktopLauncherSource, /"--disable-software-rasterizer"/);
  assert.match(developerDesktopLauncherSource, /"--no-sandbox"/);
  assert.equal(packageManifest.devDependencies.concurrently, undefined);
  assert.equal(packageManifest.devDependencies.electronmon, undefined);
  assert.equal(packageManifest.devDependencies["wait-on"], undefined);
  assert.doesNotMatch(mainWindowSource, /VITE_DEV_SERVER_URL|127\.0\.0\.1:5173/);
  assert.match(mainWindowSource, /window\.loadFile\(rendererTarget\)/);
  assert.doesNotMatch(variantBatchSource, /dist:win:developer|electron-builder/);
});

test("免安装开发 ZIP 携带完整 Electron 运行目录且不依赖源工程", () => {
  assert.match(packageManifest.scripts["package:win:developer:archive"], /electron-builder\.archive\.config\.cjs.*--win dir --x64/);
  assert.match(archiveConfigSource, /target: "dir"/);
  assert.match(archiveConfigSource, /node_modules", "electron", "dist"/);
  assert.match(packageManifest.scripts["dist:zip:developer"], /build-developer-archive-release\.mjs/);
  assert.match(archiveReleaseBuilderSource, /win-unpacked/);
  assert.match(archiveReleaseBuilderSource, /cpSync\(lockedElectronRoot, portableRoot/);
  assert.match(archiveReleaseBuilderSource, /%~dp0electron\.exe/);
  assert.match(archiveReleaseBuilderSource, /%~dp0resources\\\\app\.asar/);
  assert.match(archiveReleaseBuilderSource, /--disable-gpu.*--in-process-gpu/);
  assert.match(archiveReleaseBuilderSource, /set \"SELPLAT_ROOT=\$\{dataRoot\}\"/);
  assert.match(archiveReleaseBuilderSource, /--ai-desktop-distribution=archive/);
  assert.match(archiveReleaseBuilderSource, /--ai-desktop-user-data-dir=%AI_DESKTOP_USER_DATA%/);
  assert.match(archiveReleaseBuilderSource, /Compress-Archive/);
  assert.match(appConfigSource, /resolveDistributionMode\(\) === "archive"/);
  assert.match(mainSource, /path\.join\(path\.dirname\(process\.execPath\), "dist", "developer"\)/);
  assert.match(mainSource, /resolveDistributionMode\(\) === "archive"\) app\.disableHardwareAcceleration\(\)/);
  assert.match(mainSource, /process\.env\.AI_DESKTOP_HEALTH_CHECK_FILE/);
  assert.match(mainWindowSource, /压缩包版/);
  assert.match(mainWindowSource, /webContents\.once\("did-finish-load", options\.onRendererReady\)/);
  assert.match(mainWindowSource, /onRendererFailed/);
  assert.match(mainWindowSource, /window\.loadFile\(rendererTarget\)/);
  assert.match(developerAppSource, /压缩包版/);
});
