import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const appRoot = new URL("../../../", import.meta.url);
const source = (relativePath) => readFileSync(new URL(relativePath, appRoot), "utf8");

test("Developer 左侧任务区按可见职责拆分并保留折叠状态入口", () => {
  const taskExplorer = source("src/applications/developer/explorer/TaskExplorerFeature.tsx");
  const workspaceExplorer = source("src/applications/developer/explorer/WorkspaceExplorerFeature.tsx");
  const workspaceController = source("src/applications/developer/explorer/useWorkspaceExplorerFeature.ts");
  const fileOperationTimeout = source("src/applications/developer/explorer/file-operation-timeout.ts");
  const workspaceSection = source("src/applications/developer/sections/DeveloperWorkspaceSection.tsx");
  const applicationController = source("src/applications/developer/model/useDeveloperApplicationController.ts");
  const styles = source("src/applications/styles/desktop-applications.css");
  assert.match(taskExplorer, /aria-expanded=\{expanded\}/);
  assert.match(taskExplorer, /OperatingModeSwitch/);
  assert.match(taskExplorer, /SingleConversationTaskSummary/);
  assert.match(taskExplorer, /CollaborationTaskNavigation/);
  assert.doesNotMatch(taskExplorer, /CollaborationWorkspaceFeature|HanliConversationWorkspace/);
  assert.match(workspaceExplorer, /aria-expanded/);
  assert.match(workspaceExplorer, /workspace-tree-row.*selected/);
  assert.match(workspaceController, /listWorkspaceDirectory/);
  assert.match(workspaceController, /openWorkspaceFile/);
  assert.match(workspaceController, /selectedEntry/);
  assert.match(workspaceController, /pendingDirectoryLoads/);
  assert.match(workspaceController, /pendingLoad\) return pendingLoad/);
  assert.match(workspaceController, /撤销登记后立即移除旧树和选择/);
  assert.match(workspaceController, /setSelectedEntry\(\(current\) => current && !isRegisteredWorkspace\(current\.workspaceId\) \? null : current\)/);
  assert.match(workspaceController, /openRequestId/);
  assert.match(workspaceController, /import \{ FileOperationTimeoutError, waitForFileOperation \} from "\.\/file-operation-timeout"/);
  assert.match(fileOperationTimeout, /waitForFileOperation[\s\S]*FILE_OPERATION_TIMEOUT_MS/);
  assert.match(fileOperationTimeout, /finally\(\(\) => globalThis\.clearTimeout\(timer\)\)\.catch\(\(\) => undefined\)/);
  assert.match(workspaceController, /directoryRequestId/);
  assert.match(workspaceController, /pendingFileOpens/);
  assert.match(workspaceController, /requestId !== openRequestId\.current/);
  assert.match(workspaceController, /result\.kind === "system-open-failed"/);
  assert.match(workspaceController, /result\.kind === "system-opened"[\s\S]*toast/);
  assert.match(workspaceController, /!registeredWorkspaceIds\.current\.has\(workspaceId\)/);
  assert.doesNotMatch(workspaceExplorer, /workspace-file-preview/);
  assert.match(applicationController, /workspaceFilePreview/);
  assert.match(workspaceSection, /WorkspaceFilePreview/);
  assert.match(styles, /\.workspace-tree-row\.selected/);
  assert.match(styles, /\.workspace-file-preview-panel/);
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
    "src/applications/developer/workspace/WorkspaceFilePreview.tsx",
  ]) assert.equal(existsSync(new URL(relativePath, appRoot)), true, relativePath);
});
