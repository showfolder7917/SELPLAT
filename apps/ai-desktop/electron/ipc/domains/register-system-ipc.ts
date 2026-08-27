/** 桌面系统 IPC：提供环境、数据库状态、临时目录、审计目录和安全外链能力。 */
import { shell } from "electron";

import type { AiMemoryDatabaseStatus, AppVariant, TestDataResetResult } from "../../../contracts/desktop/desktop.js";
import type { EventCenterFacade } from "../../services/event-center/event-center-facade.js";
import type { WorkflowRepository } from "../../services/event-center/workflow-repository.js";
import type { ScreenshotStore } from "../../services/screenshot-store.js";
import { registerEventCenterIpcHandler } from "../event-center-ipc.js";

interface SystemIpcDependencies {
  aiMemoryDatabaseStatus: AiMemoryDatabaseStatus;
  projectRoot: string;
  variant: AppVariant;
  screenshots: ScreenshotStore;
  workflowRepository: WorkflowRepository | null;
  eventCenter: EventCenterFacade;
  clearTestData: () => Promise<TestDataResetResult>;
}

/** 注册系统只读查询和受控目录操作；外部 URL 仅允许 HTTP(S)。 */
export function registerSystemIpc({ aiMemoryDatabaseStatus, projectRoot, variant, screenshots, workflowRepository, eventCenter, clearTestData }: SystemIpcDependencies): void {
  const handle = <Arguments extends unknown[]>(channel: string, handler: Parameters<typeof registerEventCenterIpcHandler<Arguments>>[2], boundary: "business" | "technical" | "auto" = "auto") => registerEventCenterIpcHandler(eventCenter, channel, handler, boundary);
  handle("desktop:get-environment", () => ({ projectRoot, platform: process.platform, variant }));
  handle("desktop:get-ai-memory-database-status", () => aiMemoryDatabaseStatus);
  handle("desktop:clear-test-data", () => clearTestData(), "business");
  handle("desktop:get-approval-governance", () => workflowRepository?.listApprovalGovernance() || []);
  handle("desktop:open-external-url", async (_event, value: string) => {
    if (typeof value !== "string" || value.length > 2_048) throw new Error("Invalid external URL.");
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Only HTTP(S) links can be opened.");
    await shell.openExternal(url.toString());
  });
  handle("desktop:get-temp-directory-info", () => screenshots.info());
  handle("desktop:open-temp-directory", async () => {
    const directory = await screenshots.ensure();
    const error = await shell.openPath(directory);
    if (error) throw new Error(error);
  });
  handle("desktop:clear-temp-files", () => screenshots.clear());
  handle("desktop:get-audit-log-info", () => eventCenter.info());
  handle("desktop:open-audit-log-directory", async () => {
    const error = await shell.openPath(eventCenter.ensure());
    if (error) throw new Error(error);
  });
}
