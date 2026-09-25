import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { app, BrowserWindow, shell } from "electron";
import { resolveApplicationDataPaths } from "@selplat/node-common-core/path";

import { resolveApplicationName, resolveAppVariant, resolveProjectRoot } from "../config/app-config.js";
import { createBusinessAuditArchive, EventCenterFacade } from "../../services/support/capabilities/event-center/index.js";
import { WorkspaceFacade } from "../../services/support/platform/workspace/index.js";
import { resolvePublishedRuntimeSourceSha } from "./published-runtime-source.manifest.js";

/** 启动前解析出的稳定环境；后续 Bootstrap 禁止再次读取启动参数推断另一套路径。 */
export interface StartupContext {
  readonly applicationName: string;
  readonly variant: ReturnType<typeof resolveAppVariant>;
  readonly projectRoot: string;
  readonly projectPaths: ReturnType<typeof resolveApplicationDataPaths>;
  readonly preloadPath: string;
  readonly healthCheckFile: string | null;
  /** 当前进程实际装载的候选源码提交；发布重启验收必须与批次集成提交一致。 */
  readonly runtimeSourceSha: string | null;
  /** 候选运行包预激活后要恢复的发布批次。 */
  readonly resumeReleaseBatchId: string | null;
  /** 包外启动器接管已提升包时，允许候选进程先恢复精确的归档批次。 */
  readonly recoverReleaseBatchId: string | null;
  readonly workspaces: WorkspaceFacade;
  readonly eventCenter: EventCenterFacade;
  readonly ownsApplicationInstance: boolean;
}

/** 在 Electron ready 之前完成用户目录、工程根、协议和单实例门禁。 */
export function createStartupContext(): StartupContext {
  const electronDirectory = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const applicationName = resolveApplicationName();
  const isolatedUserData = process.argv.find((argument) => argument.startsWith("--ai-desktop-user-data-dir="))
    ?.slice("--ai-desktop-user-data-dir=".length) || null;
  app.setPath("userData", isolatedUserData ? path.resolve(isolatedUserData) : path.join(app.getPath("appData"), applicationName));

  const configuredProjectRoot = resolveProjectRoot();
  const projectPaths = resolveApplicationDataPaths({ selplatRoot: configuredProjectRoot, applicationName });
  const workspaces = new WorkspaceFacade(path.join(app.getPath("userData"), "workspace-profiles.json"), configuredProjectRoot, async (filePath) => {
    const error = await shell.openPath(filePath);
    if (error) throw new Error("system-open-failed");
  });
  const workspaceState = workspaces.read();
  const selectedWorkspace = workspaceState.roots.find((root) => root.id === workspaceState.primaryId);
  if (!selectedWorkspace || !path.isAbsolute(selectedWorkspace.path)
    || !existsSync(path.join(selectedWorkspace.path, "apps", applicationName, "package.json"))) {
    throw new Error("工作区中没有工程，请添加工程");
  }

  const projectRoot = path.resolve(selectedWorkspace.path);
  const eventCenter = new EventCenterFacade(createBusinessAuditArchive(projectPaths.sourceRoot, projectPaths.buildRoot, projectPaths.archiveLogRoot));
  eventCenter.installProcessExceptionBoundary();

  const healthCheckFile = process.argv.find((argument) => argument.startsWith("--ai-desktop-health-check-file="))
    ?.slice("--ai-desktop-health-check-file=".length)
    || process.env.AI_DESKTOP_HEALTH_CHECK_FILE
    || null;
  // 候选包健康检查必须与已运行的桌面应用并存，不能被正常启动的单实例门禁提前退出。
  const ownsApplicationInstance = healthCheckFile ? true : app.requestSingleInstanceLock();
  if (!healthCheckFile && !ownsApplicationInstance) app.quit();
  else if (!healthCheckFile) app.on("second-instance", () => {
    const window = BrowserWindow.getAllWindows()[0];
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.focus();
  });
  const runtimeSourceShaArgument = process.argv.find((argument) => argument.startsWith("--ai-desktop-runtime-sha="))
    ?.slice("--ai-desktop-runtime-sha=".length)
    || null;
  const runtimeSourceSha = resolvePublishedRuntimeSourceSha(process.resourcesPath, runtimeSourceShaArgument);
  const resumeReleaseBatchId = readArgument("--ai-desktop-resume-release=");
  const recoverReleaseBatchId = readArgument("--ai-desktop-recover-release=");

  return {
    applicationName,
    variant: resolveAppVariant(),
    projectRoot,
    projectPaths,
    preloadPath: path.join(electronDirectory, "preload", "preload.cjs"),
    healthCheckFile,
    runtimeSourceSha,
    resumeReleaseBatchId,
    recoverReleaseBatchId,
    workspaces,
    eventCenter,
    ownsApplicationInstance,
  };
}

function readArgument(prefix: string): string | null {
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) || null;
}
