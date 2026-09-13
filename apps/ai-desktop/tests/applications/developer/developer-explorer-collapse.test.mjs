import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const appRoot = new URL("../../../", import.meta.url);
const source = (relativePath) => readFileSync(new URL(relativePath, appRoot), "utf8");

test("Developer 左侧任务区按可见职责拆分并保留折叠状态入口", () => {
  const taskExplorer = source("src/applications/developer/explorer/TaskExplorerFeature.tsx");
  const workspaceExplorer = source("src/applications/developer/explorer/WorkspaceExplorerFeature.tsx");
  const workspaceController = source("src/applications/developer/explorer/useWorkspaceExplorerFeature.ts");
  assert.match(taskExplorer, /aria-expanded=\{expanded\}/);
  assert.match(taskExplorer, /OperatingModeSwitch/);
  assert.match(taskExplorer, /SingleConversationTaskSummary/);
  assert.match(taskExplorer, /CollaborationTaskNavigation/);
  assert.doesNotMatch(taskExplorer, /CollaborationWorkspaceFeature|HanliConversationWorkspace/);
  assert.match(workspaceExplorer, /aria-expanded/);
  assert.match(workspaceExplorer, /workspace-tree-row.*selected/);
  assert.match(workspaceController, /listWorkspaceDirectory/);
  assert.match(workspaceController, /readWorkspaceFile/);
  assert.match(workspaceController, /selectedEntry/);
  assert.match(workspaceController, /pendingDirectoryLoads/);
  assert.match(workspaceController, /pendingLoad\) return pendingLoad/);
});

test("Developer 磁盘结构直接区分左侧 explorer 和右侧 workspace", () => {
  for (const relativePath of [
    "src/applications/developer/explorer/DeveloperExplorer.tsx",
    "src/applications/developer/explorer/TaskExplorerFeature.tsx",
    "src/applications/developer/explorer/WorkspaceExplorerFeature.tsx",
    "src/applications/developer/explorer/OperatingModeSwitch.tsx",
    "src/applications/developer/explorer/SingleConversationTaskSummary.tsx",
    "src/applications/developer/explorer/CollaborationTaskNavigation.tsx",
    "src/applications/developer/workspace/DeveloperWorkspace.tsx",
    "src/applications/developer/workspace/DeveloperWorkspaceRouter.tsx",
  ]) assert.equal(existsSync(new URL(relativePath, appRoot)), true, relativePath);
});
