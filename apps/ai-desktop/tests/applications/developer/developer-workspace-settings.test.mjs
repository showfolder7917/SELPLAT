import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const application = readFileSync(new URL("../../../src/applications/developer/DeveloperApplication.tsx", import.meta.url), "utf8");
const applicationViewModel = readFileSync(new URL("../../../src/applications/developer/model/createDeveloperViewModel.ts", import.meta.url), "utf8");
const settingsView = readFileSync(new URL("../../../src/features/settings/components/DeveloperSettingsView.tsx", import.meta.url), "utf8");
const settingsViewModel = readFileSync(new URL("../../../src/features/settings/model/createDeveloperSettingsViewModel.ts", import.meta.url), "utf8");
const registry = readFileSync(new URL("../../../src/features/workspace/model/useWorkspaceRegistry.ts", import.meta.url), "utf8");
const activityBar = readFileSync(new URL("../../../src/applications/developer/layout/DeveloperActivityBar.tsx", import.meta.url), "utf8");
const desktopApi = readFileSync(new URL("../../../contracts/system/desktop/api/desktop.api.ts", import.meta.url), "utf8");

test("工作区管理位于设置页并复用既有控制器", () => {
  assert.match(applicationViewModel, /workspace: controller\.workspace/);
  assert.match(settingsView, /workspace-settings-card/);
  assert.match(settingsViewModel, /workspace\.addWorkspace\(\)/);
  assert.match(settingsViewModel, /workspace\.updateWorkspacePermission/);
  assert.match(settingsViewModel, /workspace\.setPrimaryWorkspace/);
  assert.match(settingsViewModel, /workspace\.removeWorkspace/);
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
