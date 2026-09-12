import assert from "node:assert/strict";
import { existsSync, lstatSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const applicationRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const expectedDevelopmentRoot = path.resolve(process.env.SELPLAT_ROOT || path.join(applicationRoot, "../.."));
const developerConfig = require("../../electron-builder.developer.config.cjs");
const packageManifest = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
const installedElectron = JSON.parse(readFileSync(path.join(applicationRoot, "node_modules", "electron", "package.json"), "utf8"));
const appConfigSource = readFileSync(new URL("../../electron/system/config/app-config.ts", import.meta.url), "utf8");
const unifiedRunnerSource = readFileSync(new URL("../../electron/services/support/capabilities/testing/internal/fixed-unified-test.runner.ts", import.meta.url), "utf8");
const packagedVerifierSource = readFileSync(new URL("../../scripts/verify-developer-package-root.mjs", import.meta.url), "utf8");
const developerBatchSource = readFileSync(new URL("../../启动开发版.bat", import.meta.url), "utf8");
const variantBatchSource = readFileSync(new URL("../../scripts/start-variant.bat", import.meta.url), "utf8");
const developerDesktopLauncherSource = readFileSync(new URL("../../scripts/start-developer-desktop.mjs", import.meta.url), "utf8");
const mainWindowSource = readFileSync(new URL("../../electron/system/window/create-main-window.ts", import.meta.url), "utf8");
const packageInputSource = readFileSync(new URL("../../scripts/developer-package-input.mjs", import.meta.url), "utf8");
const packageRunnerSource = readFileSync(new URL("../../scripts/package-developer.mjs", import.meta.url), "utf8");
const managedTestRunnerSource = readFileSync(new URL("../../scripts/run-managed-tests.mjs", import.meta.url), "utf8");

test("全部开发版打包入口自动注入稳定 SELPLAT 工程根", () => {
  assert.equal(developerConfig.extraMetadata.selplatDevelopmentRoot, expectedDevelopmentRoot);
  assert.equal(developerConfig.directories.app, applicationRoot);
  assert.equal("build" in packageManifest, false, "双 package 打包时应用包不得声明 build 配置");
  assert.equal(developerConfig.electronVersion, installedElectron.version, "项目根不含依赖时必须使用应用受管 Electron 的精确版本");
  for (const scriptName of ["dist:win:developer", "dist:mac:developer", "package:mac:developer"]) {
    assert.match(packageManifest.scripts[scriptName], /scripts\/package-developer\.mjs/);
  }
  assert.match(unifiedRunnerSource, /SELPLAT_ROOT: this\.#sourceProjectRoot/);
  assert.match(packageManifest.scripts["verify:developer-package-root"], /verify-developer-package-root\.mjs/);
  assert.match(packagedVerifierSource, /mtimeMs/, "多平台产物并存时必须验证最新生成的真实包");
  assert.match(packagedVerifierSource, /extractFile\(asarPath, "package\.json"\)/);
  assert.match(packagedVerifierSource, /packagedManifest\.selplatDevelopmentRoot/);
});

test("开发包将缓存依赖解引用到候选工作树内的临时输入", async () => {
  const { assertPackageInputLinksStayInside, cleanupDeveloperPackageInput, prepareDeveloperPackageInput } = await import(new URL("../../scripts/developer-package-input.mjs", import.meta.url));
  const fixtureRoot = path.join(applicationRoot, "cache", "test-tmp", "developer-package-input");
  const externalRoot = path.join(fixtureRoot, "external-cache");
  const babelCacheRoot = path.join(fixtureRoot, "babel-cache");
  const lockCacheRoot = path.join(fixtureRoot, "lock-cache");
  const candidateRoot = path.join(fixtureRoot, "candidate");
  const sourceRoot = path.join(fixtureRoot, "source");
  const packageRoot = path.join(fixtureRoot, "candidate", "apps", "ai-desktop");
  let packageInputRoot;
  rmSync(fixtureRoot, { recursive: true, force: true });
  try {
    mkdirSync(path.join(externalRoot, "@isaacs", "fs-minipass"), { recursive: true });
    writeFileSync(path.join(externalRoot, "@isaacs", "fs-minipass", "LICENSE"), "fixture");
    mkdirSync(path.join(babelCacheRoot, "core"), { recursive: true });
    writeFileSync(path.join(babelCacheRoot, "core", "index.js"), "module.exports = 'fixture';");
    symlinkSync(babelCacheRoot, path.join(externalRoot, "@babel"), "dir");
    assert.equal(lstatSync(path.join(externalRoot, "@babel")).isSymbolicLink(), true);
    mkdirSync(lockCacheRoot, { recursive: true });
    writeFileSync(path.join(lockCacheRoot, ".package-lock.json"), '{"lockfileVersion":3}');
    symlinkSync(path.join(lockCacheRoot, ".package-lock.json"), path.join(externalRoot, ".package-lock.json"));
    assert.equal(lstatSync(path.join(externalRoot, ".package-lock.json")).isSymbolicLink(), true);
    mkdirSync(path.join(externalRoot, ".bin"), { recursive: true });
    symlinkSync("../@isaacs/fs-minipass/LICENSE", path.join(externalRoot, ".bin", "fixture"));
    mkdirSync(packageRoot, { recursive: true });
    writeFileSync(path.join(packageRoot, "package.json"), '{"name":"fixture"}');
    symlinkSync(externalRoot, path.join(packageRoot, "node_modules"), "dir");
    mkdirSync(path.join(sourceRoot, ".git"), { recursive: true });
    mkdirSync(path.join(sourceRoot, "apps", "ai-desktop"), { recursive: true });
    writeFileSync(path.join(sourceRoot, "apps", "ai-desktop", "package.json"), '{"name":"source-fixture"}');

    packageInputRoot = prepareDeveloperPackageInput({
      applicationRoot: packageRoot,
      projectRoot: candidateRoot,
    });

    const copiedLicense = path.join(packageInputRoot, "node_modules", "@isaacs", "fs-minipass", "LICENSE");
    const copiedBabelScope = path.join(packageInputRoot, "node_modules", "@babel");
    assert.equal(lstatSync(path.join(packageInputRoot, "node_modules")).isSymbolicLink(), false);
    assert.equal(lstatSync(copiedLicense).isSymbolicLink(), false);
    assert.equal(readFileSync(copiedLicense, "utf8"), "fixture");
    assert.equal(lstatSync(copiedBabelScope).isSymbolicLink(), false);
    assert.equal(readFileSync(path.join(copiedBabelScope, "core", "index.js"), "utf8"), "module.exports = 'fixture';");
    assert.equal(existsSync(path.join(packageInputRoot, "node_modules", ".bin")), false);
    assert.equal(existsSync(path.join(packageInputRoot, "node_modules", ".package-lock.json")), false);
    assert.doesNotThrow(() => assertPackageInputLinksStayInside(packageInputRoot));
    symlinkSync(path.join(externalRoot, "@isaacs", "fs-minipass", "LICENSE"), path.join(packageInputRoot, "node_modules", "outside-input"));
    assert.throws(() => assertPackageInputLinksStayInside(packageInputRoot), /link escaped its root/);

    const configPath = require.resolve("../../electron-builder.developer.config.cjs");
    const originalPackageInput = process.env.AI_DESKTOP_PACKAGE_INPUT_ROOT;
    const originalSelplatRoot = process.env.SELPLAT_ROOT;
    try {
      process.env.AI_DESKTOP_PACKAGE_INPUT_ROOT = packageInputRoot;
      process.env.SELPLAT_ROOT = sourceRoot;
      delete require.cache[configPath];
      const stagedConfig = require("../../electron-builder.developer.config.cjs");
      assert.equal(stagedConfig.directories.app, packageInputRoot);
      assert.equal(stagedConfig.files[0].from, path.resolve(applicationRoot, "../../build/ai-desktop/renderer/developer"));
      assert.equal(stagedConfig.files[1].from, path.resolve(applicationRoot, "../../build/ai-desktop/electron"));
      assert.equal(stagedConfig.extraResources.find((resource) => resource.to === "ruleengine").from, path.join(sourceRoot, "build", "ai-desktop", "rule-bundle"));
      assert.equal(stagedConfig.extraResources.find((resource) => resource.to === "prompts").from, path.join(sourceRoot, "build", "ai-desktop", "prompt-bundle"));
      assert.equal(stagedConfig.extraResources.find((resource) => resource.to === "db/sql").from, path.join(applicationRoot, "db", "sql"));
    } finally {
      if (originalPackageInput === undefined) delete process.env.AI_DESKTOP_PACKAGE_INPUT_ROOT;
      else process.env.AI_DESKTOP_PACKAGE_INPUT_ROOT = originalPackageInput;
      if (originalSelplatRoot === undefined) delete process.env.SELPLAT_ROOT;
      else process.env.SELPLAT_ROOT = originalSelplatRoot;
      delete require.cache[configPath];
    }
  } finally {
    if (packageInputRoot) cleanupDeveloperPackageInput({ projectRoot: candidateRoot, packageInputRoot });
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("开发包运行器只在打包期间使用和清理实体化输入", () => {
  assert.match(packageInputSource, /dereference: true/);
  assert.match(packageInputSource, /materializeDependencyTree/);
  assert.match(packageInputSource, /assertPackageInputLinksStayInside/);
  assert.match(packageRunnerSource, /AI_DESKTOP_PACKAGE_INPUT_ROOT/);
  assert.match(packageRunnerSource, /finally[\s\S]*cleanupDeveloperPackageInput/);
});

test("隔离工作树的托管静态测试使用临时数据工作区", () => {
  assert.match(packageManifest.scripts["test:managed"], /scripts\/run-managed-tests\.mjs/);
  assert.match(managedTestRunnerSource, /isCollaborationWorktree/);
  assert.match(managedTestRunnerSource, /SELPLAT_ROOT: temporaryWorkspace/);
  assert.match(managedTestRunnerSource, /finally[\s\S]*rmSync\(temporaryWorkspace/);
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
