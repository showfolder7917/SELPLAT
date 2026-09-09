/**
 * 桌面系统跨进程 API 的唯一领域视图。
 *
 * 调用链：Renderer shell/settings/workspace -> system desktop adapter -> system preload bridge
 * -> system/settings/workspace IPC -> 对应平台 Facade。
 */
import type { DesktopApi } from "../desktop.api.js";

/** 系统领域包含宿主、设置、工作区、诊断和窗口控制能力。 */
export const SYSTEM_DESKTOP_API_METHODS = [
  "getEnvironment",
  "getAiMemoryDatabaseStatus",
  "clearTestData",
  "getCorpusSemanticBackfillStatus",
  "startCorpusSemanticBackfill",
  "getSettings",
  "updateSettings",
  "getWorkspaces",
  "addWorkspace",
  "updateWorkspacePermission",
  "setPrimaryWorkspace",
  "removeWorkspace",
  "openExternalUrl",
  "getTempDirectoryInfo",
  "openTempDirectory",
  "clearTempFiles",
  "getAuditLogInfo",
  "openAuditLogDirectory",
  "reportRendererException",
  "windowControl",
] as const satisfies readonly (keyof DesktopApi)[];

/** Renderer 的系统类模块只能通过该视图访问主进程。 */
export type SystemDesktopApi = Pick<DesktopApi, (typeof SYSTEM_DESKTOP_API_METHODS)[number]>;
