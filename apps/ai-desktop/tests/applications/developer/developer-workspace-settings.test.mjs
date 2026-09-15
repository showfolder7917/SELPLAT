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

test("工作区管理进入左侧 Explorer，并复用既有登记控制器", () => {
  const explorer = readFileSync(new URL("../../../src/applications/developer/explorer/WorkspaceExplorerFeature.tsx", import.meta.url), "utf8");
  assert.match(applicationViewModel, /workspaces: controller\.workspace\.workspaces/);
  assert.match(applicationViewModel, /onAddWorkspace/);
  assert.match(explorer, /onAdd/);
  assert.doesNotMatch(settingsView, /workspace-settings-card/);
  assert.doesNotMatch(settingsViewModel, /workspace\.addWorkspace\(\)/);
});

test("工作区资源树使用受控目录与文本预览 API", () => {
  const retiredShellState = ["explorer", "Expanded"].join("");
  const retiredResizer = ["explorer", "-resizer"].join("");
  const directoryApi = ["list", "Workspace", "Directory"].join("");
  const fileApi = ["open", "Workspace", "File"].join("");
  assert.doesNotMatch(application, new RegExp(`${retiredShellState}|${retiredResizer}`));
  assert.match(desktopApi, new RegExp(`${directoryApi}|${fileApi}`));
  assert.match(registry, /addWorkspace/);
  assert.doesNotMatch(activityBar, /Search24Regular|Branch24Regular|Bug24Regular|Folder24Regular/);
});

test("文件内容在右侧主工作区阅读，左侧只保留目录树", () => {
  const explorer = readFileSync(new URL("../../../src/applications/developer/explorer/WorkspaceExplorerFeature.tsx", import.meta.url), "utf8");
  const workspaceSection = readFileSync(new URL("../../../src/applications/developer/sections/DeveloperWorkspaceSection.tsx", import.meta.url), "utf8");
  const preview = readFileSync(new URL("../../../src/applications/developer/workspace/WorkspaceFilePreview.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(explorer, /workspace-file-preview/);
  assert.match(workspaceSection, /WorkspaceFilePreview/);
  assert.match(preview, /workspace-file-preview-panel/);
  assert.match(preview, /aria-label/);
  assert.match(preview, /onClose/);
  assert.match(preview, /copyText/);
  assert.match(preview, /toast/);
  assert.match(preview, /useState\(false\)/);
  assert.match(preview, /if \(copying\) return/);
  assert.match(preview, /disabled=\{copying\}/);
  assert.match(preview, /finally \{\s*setCopying\(false\)/);
});
