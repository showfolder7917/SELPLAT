import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { resolveApplicationDataPaths, resolveApplicationNameFromSourceRoot } from "@selplat/node-common-core/path";

const component = readFileSync(new URL("../src/variants/developer/DeveloperApp.tsx", import.meta.url), "utf8");
const settingsPanel = readFileSync(new URL("../src/features/settings/components/SettingsFloatingPanel.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/variants/developer/developer.css", import.meta.url), "utf8");
const floatingPanel = readFileSync(new URL("../../../shared/frontend/sel-ui/src/components/floating-panel/selFloatingPanel.js", import.meta.url), "utf8");
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const selplatRoot = path.resolve(appRoot, "../..");

test("连接与执行设置不再把本机路径渲染为文本", () => {
  assert.doesNotMatch(component, /runtime\.path/);
  assert.doesNotMatch(component, /tempInfo\?\.path/);
  assert.doesNotMatch(component, /auditInfo\?\.path/);
  assert.match(component, /openTempDirectory/);
  assert.match(component, /clearTempFiles/);
  assert.match(component, /clearTestData/);
  assert.match(component, /一键清空测试数据/);
  assert.match(component, /保留登录、设置、工作区、可信命令、规则、源码和工程审计文件/);
  assert.match(component, /openAuditLogDirectory/);
});

test("连接与执行设置复用 SELUI 浮动面板并支持调整宽度", () => {
  assert.match(component, /@selplat\/sel-ui\/components\/floating-panel/);
  assert.doesNotMatch(component, /shared\/frontend\/sel-ui/);
  assert.match(settingsPanel, /floatingPanel\.mount/);
  assert.match(settingsPanel, /resizable:\s*\{/);
  assert.match(settingsPanel, /minWidth:\s*MINIMUM_WIDTH/);
  assert.match(settingsPanel, /maxWidth:\s*MAXIMUM_WIDTH/);
  assert.match(settingsPanel, /resetLabel:/);
  assert.doesNotMatch(component, /SettingsWidthResizer/);
  assert.match(settingsPanel, /portalBody && open && createPortal\(children, portalBody\)/);
  assert.match(styles, /\.dev-activitybar \.dev-settings \.selfloating-resize-bottom, \.dev-activitybar \.dev-settings \.selfloating-resize-corner/);
  assert.match(styles, /max-width:\s*min\(720px, calc\(100vw - 70px\)\)/);
});

test("SELUI 浮动面板提供宽度约束、键盘、双击与关闭交互", () => {
  assert.match(floatingPanel, /selFloatingPanelResizeBounds/);
  assert.match(floatingPanel, /pointerdown/);
  assert.match(floatingPanel, /\["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"\]/);
  assert.match(floatingPanel, /dblclick/);
  assert.match(floatingPanel, /key === "Escape"/);
  assert.match(floatingPanel, /document\.addEventListener\("pointerdown", selFloatingPanelHandleDocumentPointer\)/);
});

test("测试文档通过公共路径模块定位当前应用测试目录", () => {
  const applicationName = resolveApplicationNameFromSourceRoot(appRoot);
  const dataPaths = resolveApplicationDataPaths({ selplatRoot, applicationName });
  assert.equal(applicationName, "ai-desktop");
  assert.equal(dataPaths.pendingTestRoot, path.join(selplatRoot, "OPTION", "temp", applicationName, "执行日志", "待执行", "测试"));
});
