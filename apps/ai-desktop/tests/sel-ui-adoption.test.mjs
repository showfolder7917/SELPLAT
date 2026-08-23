import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (url) => readFileSync(new URL(url, import.meta.url), "utf8");
const packageManifest = JSON.parse(read("../package.json"));
const selUiManifest = JSON.parse(read("../../../shared/frontend/sel-ui/package.json"));
const themeAdapter = read("../src/theme/selUiTheme.ts");
const entry = read("../src/main.tsx");
const developerStyles = read("../src/variants/developer/developer.css");
const developerApp = read("../src/variants/developer/DeveloperApp.tsx");
const officeStyles = read("../src/variants/office/office.css");
const themeContract = read("../../../shared/frontend/sel-ui/src/theme/contract/selThemeContract.css");
const sharedTokens = read("../../../shared/frontend/sel-ui/src/theme/selThemeTokens.css");
const dependencyCache = read("../scripts/dependency-cache.mjs");
const dependencyRunner = read("../scripts/run-with-dependencies.mjs");
const developerTheme = [
  read("../../../shared/frontend/sel-ui/src/theme/packs/developer-workbench/theme.css"),
  read("../../../shared/frontend/sel-ui/src/theme/packs/developer-workbench/modes/dark.css"),
  read("../../../shared/frontend/sel-ui/src/theme/packs/developer-workbench/modes/light.css"),
].join("\n");

test("AI Desktop 通过正式 Node 出口接入同一 SEL UI 源码", () => {
  assert.equal(selUiManifest.name, "@selplat/sel-ui");
  assert.equal(packageManifest.devDependencies["@selplat/sel-ui"], "file:../../shared/frontend/sel-ui");
  assert.equal(packageManifest.dependencies["@selplat/sel-ui"], undefined);
  for (const exportedPath of [
    "./theme/tokens",
    "./theme/contract",
    "./theme/states",
    "./theme/typography",
    "./theme/developer-workbench",
    "./theme/developer-workbench/dark",
    "./theme/developer-workbench/light",
    "./theme/plain-minimal",
    "./theme/plain-minimal/light",
  ]) {
    assert.ok(selUiManifest.exports[exportedPath], `缺少正式出口 ${exportedPath}`);
    assert.equal(selUiManifest.exports[exportedPath].types, "./src/theme/css.d.ts");
  }
  assert.match(themeAdapter, /@selplat\/sel-ui\/theme\/developer-workbench/);
  assert.ok(themeAdapter.indexOf('@selplat/sel-ui/theme/tokens') < themeAdapter.indexOf('@selplat/sel-ui/theme/contract'));
  assert.doesNotMatch(themeAdapter, /shared\/frontend\/sel-ui|\.\.\/\.\.\/\.\.\/shared/);
});

test("锁文件依赖缓存迁移后重建本地公共包链接", () => {
  assert.match(dependencyCache, /export function repairLocalPackageLinks/);
  assert.match(dependencyCache, /metadata\?\.link !== true/);
  assert.match(dependencyCache, /targetRelative\.startsWith/);
  assert.match(dependencyCache, /repairLocalPackageLinks\(details\);[\s\S]*symlinkSync\(details\.dependencyRoot/);
  assert.match(dependencyRunner, /node-common-core[\s\S]*build-node-common\.mjs[\s\S]*sync-node-common-runtime\.mjs/);
});

test("React 首次渲染前应用变体对应的 SEL UI 主题状态", () => {
  assert.match(themeAdapter, /developer-workbench[\s\S]*plain-minimal/);
  assert.match(themeAdapter, /root\.dataset\.selTheme = state\.theme/);
  assert.match(themeAdapter, /root\.dataset\.selMode = state\.mode/);
  assert.ok(entry.indexOf("applySelUiTheme(variant)") < entry.indexOf("createRoot("));
});

test("Developer Workbench 主题只维护视觉令牌，不侵入应用布局", () => {
  assert.match(developerTheme, /data-sel-theme="developer-workbench"/);
  for (const token of [
    "--sel-theme-workbench-canvas",
    "--sel-theme-workbench-sidebar",
    "--sel-theme-workbench-surface",
    "--sel-theme-workbench-text",
    "--sel-theme-workbench-accent",
    "--sel-theme-workbench-overlay",
  ]) assert.match(developerTheme, new RegExp(`${token}:`));
  assert.doesNotMatch(developerTheme, /\.(?:dev|office)-/);
});

test("应用样式只保留布局，颜色与可读字号统一消费 SEL UI 令牌", () => {
  const rawColor = /#[0-9a-f]{3,8}\b|rgba?\(/i;
  const pixelText = /font-size:\s*[0-9]+px|font:\s*[0-9]+px\//;
  for (const [name, source] of [["developer", developerStyles], ["office", officeStyles]]) {
    assert.doesNotMatch(source, rawColor, `${name} 仍含应用私有颜色`);
    assert.doesNotMatch(source, pixelText, `${name} 仍含像素文字字号`);
    assert.match(source, /var\(--sel-theme-/);
  }
  assert.doesNotMatch(developerStyles, /--(?:line|panel|panel-2|cyan|violet)\s*:/);
});

test("登录主操作完整消费 SEL UI 令牌并保留可读文字节点", () => {
  assert.match(themeContract, /selThemeTokens\.css\?v=20260823-action-control-1/);
  assert.match(sharedTokens, /--sel-theme-action-height:\s*32px/);
  assert.match(sharedTokens, /--sel-theme-action-padding-inline:\s*13px/);
  const accountRule = developerStyles.match(/\.dev-account button,[\s\S]*?\.status-card\.offline/)?.[0] || "";
  for (const token of [
    "--sel-theme-action-height",
    "--sel-theme-action-padding-inline",
    "--sel-theme-radius-control",
    "--sel-theme-font-size-body",
    "--sel-theme-font-weight-semibold",
    "--sel-theme-line-height-body",
    "--sel-theme-text-on-accent",
  ]) assert.match(accountRule, new RegExp(`var\\(${token}\\)`), `登录按钮缺少 ${token}`);
  assert.doesNotMatch(accountRule, /min-height:\s*32px|padding:\s*0 13px|border-radius:\s*6px|font-weight:\s*650/);
  assert.match(developerApp, /className="primary"[\s\S]*?<span>\{text\.signIn\}<\/span>/);
});
