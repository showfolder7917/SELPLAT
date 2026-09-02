import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const applicationRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const expectedDevelopmentRoot = path.resolve(process.env.SELPLAT_ROOT || path.join(applicationRoot, "../.."));
const developerConfig = require("../../electron-builder.developer.config.cjs");
const packageManifest = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
const appConfigSource = readFileSync(new URL("../../electron/system/config/app-config.ts", import.meta.url), "utf8");
const unifiedRunnerSource = readFileSync(new URL("../../electron/services/support/capabilities/testing/internal/fixed-unified-test.runner.ts", import.meta.url), "utf8");
const packagedVerifierSource = readFileSync(new URL("../../scripts/verify-developer-package-root.mjs", import.meta.url), "utf8");
const developerBatchSource = readFileSync(new URL("../../启动开发版.bat", import.meta.url), "utf8");
const variantBatchSource = readFileSync(new URL("../../scripts/start-variant.bat", import.meta.url), "utf8");
const developerDesktopLauncherSource = readFileSync(new URL("../../scripts/start-developer-desktop.mjs", import.meta.url), "utf8");
const mainWindowSource = readFileSync(new URL("../../electron/system/window/create-main-window.ts", import.meta.url), "utf8");

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

test("打包入口只保留 Developer 配置", () => {
  for (const scriptName of [
    "dist:win:customer",
    "package:win:customer",
    "verify:win:customer",
    "package:win:developer:archive",
    "dist:zip:developer",
  ]) assert.equal(packageManifest.scripts[scriptName], undefined, scriptName);
  for (const relativePath of [
    "electron-builder.customer.config.cjs",
    "electron-builder.archive.config.cjs",
    "scripts/verify-windows-customer-package.mjs",
    "scripts/build-developer-archive-release.mjs",
  ]) assert.equal(existsSync(path.join(applicationRoot, relativePath)), false, relativePath);
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
