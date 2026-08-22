import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(new URL("../src/variants/developer/DeveloperApp.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/variants/developer/developer.css", import.meta.url), "utf8");

test("资源管理器折叠整栏并由活动栏图标恢复", () => {
  assert.match(component, /developer-shell.*explorer-collapsed/);
  assert.match(component, /aria-pressed=\{explorerExpanded\}/);
  assert.match(component, /setExplorerExpanded\(\(value\) => !value\)/);
  assert.match(styles, /\.developer-shell\.explorer-collapsed\s*\{[^}]*grid-template-columns:\s*52px 0/);
  assert.match(styles, /\.developer-shell\.explorer-collapsed \.dev-explorer\s*\{\s*display:\s*none/);
  assert.match(styles, /\.developer-shell\.explorer-collapsed \.dev-composer\s*\{[^}]*left:/);
});

test("资源管理器宽度与工作区高度支持拖拽和键盘调整", () => {
  assert.match(component, /className="explorer-resizer"/);
  assert.match(component, /className="workspace-pane-resizer"/);
  assert.match(component, /role="separator"[\s\S]*aria-orientation="vertical"/);
  assert.match(component, /role="separator"[\s\S]*aria-orientation="horizontal"/);
  assert.match(component, /onPointerDown=\{startExplorerResize\}/);
  assert.match(component, /onPointerDown=\{startWorkspaceResize\}/);
  assert.match(styles, /grid-template:[^;]*var\(--explorer-width\)/);
  assert.match(styles, /\.dev-explorer-sections > \.workspace-list\s*\{[^}]*flex:\s*1 1 auto/);
  assert.match(styles, /\.workspace-pane-resized > \.tasks-pane\.expanded\s*\{[^}]*flex:\s*1 1 auto/);
});

test("任务标题提供真实折叠状态且分隔器只绘制一像素视觉线", () => {
  assert.match(component, /tasksSectionExpanded/);
  assert.match(component, /aria-controls="developer-task-list"/);
  assert.match(component, /aria-expanded=\{tasksSectionExpanded\}/);
  assert.match(component, /id="developer-task-list"/);
  assert.match(styles, /\.workspace-pane-resizer::after\s*\{[^}]*height:\s*1px/);
  assert.match(styles, /\.dev-section-title\.tasks\s*\{\s*border-top:\s*0/);
});
