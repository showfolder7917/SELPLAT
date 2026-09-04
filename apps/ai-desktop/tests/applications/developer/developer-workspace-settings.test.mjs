import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const application = readFileSync(new URL("../../../src/applications/developer/DeveloperApplication.tsx", import.meta.url), "utf8");
const settings = readFileSync(new URL("../../../src/features/settings/components/DeveloperSettingsFeature.tsx", import.meta.url), "utf8");
const registry = readFileSync(new URL("../../../src/features/workspace/model/useWorkspaceRegistry.ts", import.meta.url), "utf8");
const activityBar = readFileSync(new URL("../../../src/applications/developer/layout/DeveloperActivityBar.tsx", import.meta.url), "utf8");
const desktopApi = readFileSync(new URL("../../../contracts/system/desktop/api/desktop.api.ts", import.meta.url), "utf8");

test("工作区管理位于设置页并复用既有控制器", () => {
  assert.match(application, /workspace=\{workspace\}/);
  assert.match(settings, /workspace-settings-card/);
  assert.match(settings, /workspace\.addWorkspace\(\)/);
  assert.match(settings, /workspace\.updateWorkspacePermission/);
  assert.match(settings, /workspace\.setPrimaryWorkspace/);
  assert.match(settings, /workspace\.removeWorkspace/);
});

test("资源树和整体侧栏恢复入口已删除", () => {
  const retiredExplorer = ["Workspace", "Explorer", "Feature"].join("");
  const retiredShellState = ["explorer", "Expanded"].join("");
  const retiredResizer = ["explorer", "-resizer"].join("");
  const retiredDirectoryApi = ["list", "Workspace", "Entries"].join("");
  const retiredDirectoryState = ["workspace", "Entries"].join("");
  const retiredExpansionState = ["expanded", "Workspaces"].join("");
  const retiredToggle = ["toggle", "Workspace"].join("");
  assert.doesNotMatch(application, new RegExp(`${retiredExplorer}|${retiredShellState}|${retiredResizer}`));
  assert.doesNotMatch(registry, new RegExp(`${retiredDirectoryApi}|${retiredDirectoryState}|${retiredExpansionState}|${retiredToggle}`));
  assert.doesNotMatch(activityBar, /Search24Regular|Branch24Regular|Bug24Regular|Folder24Regular/);
  assert.doesNotMatch(desktopApi, new RegExp(retiredDirectoryApi));
});
