import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(new URL("../src/variants/developer/DeveloperApp.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/variants/developer/developer.css", import.meta.url), "utf8");

test("连接与执行设置不再把本机路径渲染为文本", () => {
  assert.doesNotMatch(component, /runtime\.path/);
  assert.doesNotMatch(component, /tempInfo\?\.path/);
  assert.doesNotMatch(component, /auditInfo\?\.path/);
  assert.match(component, /openTempDirectory/);
  assert.match(component, /clearTempFiles/);
  assert.match(component, /openAuditLogDirectory/);
});

test("连接与执行设置复用 SELUI 浮动面板并支持调整宽度", () => {
  assert.match(component, /selFloatingPanel\.js/);
  assert.match(component, /floatingPanel\.mount/);
  assert.match(component, /SettingsWidthResizer/);
  assert.match(component, /onPointerDown=\{startResize\}/);
  assert.match(component, /onDoubleClick=\{\(\) => applyWidth\(DEFAULT_SETTINGS_WIDTH\)\}/);
  assert.match(component, /ArrowLeft/);
  assert.match(component, /ArrowRight/);
  assert.match(styles, /\.dev-settings-resize-right/);
  assert.match(styles, /max-width:\s*min\(720px, calc\(100vw - 70px\)\)/);
});
