import { ipcMain } from "electron";

import type { CreateCollaborationMemberRequest, DesktopOperatingMode, SubmitCollaborationTaskRequest, UpdateCollaborationMemberRequest } from "../../../contracts/collaboration.js";
import type { CollaborationCoordinator } from "../../services/collaboration/collaboration-coordinator.js";
import type { LinghuAutomationFacade } from "../../services/collaboration/linghu-automation-facade.js";

/** 协同领域集中登记人物、任务和令狐自动保障通道，总注册器不再感知每个业务动作。 */
export function registerCollaborationIpc(collaboration: CollaborationCoordinator, linghuAutomation: LinghuAutomationFacade): void {
  ipcMain.handle("desktop:get-collaboration-state", () => collaboration.state());
  ipcMain.handle("desktop:set-operating-mode", (_event, mode: DesktopOperatingMode) => collaboration.setMode(mode));
  ipcMain.handle("desktop:select-collaboration-member", (_event, memberId: string) => collaboration.selectMember(memberId));
  ipcMain.handle("desktop:create-collaboration-member", (_event, request: CreateCollaborationMemberRequest) => collaboration.createMember(request));
  ipcMain.handle("desktop:update-collaboration-member", (_event, memberId: string, request: UpdateCollaborationMemberRequest) => collaboration.updateMember(memberId, request));
  ipcMain.handle("desktop:delete-collaboration-member", (_event, memberId: string) => collaboration.deleteMember(memberId));
  ipcMain.handle("desktop:submit-collaboration-task", (_event, request: SubmitCollaborationTaskRequest) => collaboration.submitTask(request));
  ipcMain.handle("desktop:continue-collaboration-task", (_event, taskId: string) => collaboration.continueTask(taskId));
  ipcMain.handle("desktop:cancel-collaboration-task", (_event, taskId: string) => collaboration.cancelTask(taskId));
  ipcMain.handle("desktop:get-linghu-automation-state", () => linghuAutomation.state());
  ipcMain.handle("desktop:set-linghu-automation-enabled", (_event, enabled: boolean) => linghuAutomation.setEnabled(enabled === true));
  ipcMain.handle("desktop:create-linghu-startup-prompt", (_event, request) => linghuAutomation.createPrompt(request));
  ipcMain.handle("desktop:update-linghu-startup-prompt", (_event, promptId: string, request) => linghuAutomation.updatePrompt(promptId, request));
  ipcMain.handle("desktop:delete-linghu-startup-prompt", (_event, promptId: string) => linghuAutomation.deletePrompt(promptId));
  ipcMain.handle("desktop:select-linghu-startup-prompt", (_event, promptId: string) => linghuAutomation.selectPrompt(promptId));
}
