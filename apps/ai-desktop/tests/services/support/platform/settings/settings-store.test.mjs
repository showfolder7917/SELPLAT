import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build, transform } from "esbuild";

import { controlledTestRoot } from "#test-paths";

const store = readFileSync(new URL("../../../../../electron/services/support/platform/settings/internal/settings.store.ts", import.meta.url), "utf8");
const resource = readFileSync(new URL("../../../../../contracts/foundation/i18n/fixed-ui-text.ts", import.meta.url), "utf8");
const transformedResource = await transform(resource, { format: "esm", loader: "ts", target: "es2022" });
const { fixedUiText, resolveFixedUiText } = await import(`data:text/javascript;base64,${Buffer.from(transformedResource.code).toString("base64")}`);

async function loadSettingsStore(root) {
  const result = await build({
    entryPoints: [fileURLToPath(new URL("../../../../../electron/services/support/platform/settings/internal/settings.store.ts", import.meta.url))],
    bundle: true,
    format: "cjs",
    platform: "node",
    target: "node22",
    write: false,
  });
  const output = path.join(root, "settings-store.cjs");
  writeFileSync(output, result.outputFiles[0].text, "utf8");
  return createRequire(import.meta.url)(output).SettingsStore;
}

test("设置读取区分默认值和恢复失败，失败后不会用默认配置覆盖已有文件", () => {
  assert.match(store, /readForRenderer\(\): DesktopSettingsReadOutDto/);
  assert.match(store, /source: "default"/);
  assert.match(store, /source: "recovered"/);
  assert.match(store, /if \(existsSync\(this\.#filePath\)\) this\.#readStored\(\)/);
  assert.match(store, /patch\.locale === "ja" \|\| patch\.locale === "zh-CN" \|\| patch\.locale === "en"/);
});

test("固定界面资源提供三语、中文回退和受控缺键诊断", () => {
  assert.match(resource, /"zh-CN"/);
  assert.match(resource, /\bja:/);
  assert.match(resource, /\ben:/);
  assert.match(resource, /catalog\["zh-CN"\]\?\.\[entry\]/);
  assert.match(resource, /missingText/);
  assert.equal(fixedUiText("en", "workspaceFilePreview"), "File preview");
  assert.equal(fixedUiText("zh-CN", "screenshotResizeAnnotation"), "调整红框-{handle}");
  assert.equal(fixedUiText("zh-CN", "modelDefaultLabel"), "默认模型");
  assert.equal(fixedUiText("zh-CN", "modelDefault"), "Codex 默认");
  assert.equal(fixedUiText("ja", "testDataClearFailed"), "テストデータを消去できませんでした。");
  assert.equal(fixedUiText("en", "testDataRestartFailed"), "Could not start the app restart.");
  assert.equal(fixedUiText("fr", "workspaceFilePreview"), "文件预览");
  assert.equal(fixedUiText("en", "retiredFixedKey"), "[缺少固定界面文案: retiredFixedKey]");
  assert.equal(resolveFixedUiText({ "zh-CN": { missingText: "缺少固定界面文案", developerSettings: "连接与执行设置" }, en: {} }, "en", "developerSettings"), "连接与执行设置");
  assert.equal(resolveFixedUiText({ "zh-CN": { missingText: "缺少固定界面文案" }, en: {} }, "en", "developerSettings"), "[缺少固定界面文案: developerSettings]");
});

test("语言设置持久化三语并在读取失败时保留原文件", async () => {
  mkdirSync(controlledTestRoot, { recursive: true });
  const root = mkdtempSync(path.join(controlledTestRoot, "ai-desktop-settings-"));
  try {
    const SettingsStore = await loadSettingsStore(root);
    const filePath = path.join(root, "settings.json");
    const settings = new SettingsStore(filePath);
    for (const locale of ["zh-CN", "ja", "en"]) {
      assert.equal(settings.update({ locale }).locale, locale);
      const restartedRenderer = new SettingsStore(filePath).readForRenderer();
      assert.equal(restartedRenderer.source, "stored");
      assert.equal(restartedRenderer.settings.locale, locale);
    }
    writeFileSync(filePath, "{", "utf8");
    const recoveredRenderer = new SettingsStore(filePath).readForRenderer();
    assert.equal(recoveredRenderer.source, "recovered");
    assert.equal(recoveredRenderer.settings.locale, "ja");
    assert.throws(() => new SettingsStore(filePath).update({ locale: "ja" }));
    assert.equal(readFileSync(filePath, "utf8"), "{");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
