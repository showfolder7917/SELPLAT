import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { app, BrowserWindow } from "electron";
import { resolveApplicationDataPaths } from "@selplat/node-common-core/path";

import { resolveApplicationName, resolveAppVariant, resolveProjectRoot } from "../config/app-config.js";
import { resolveAiMemoryPaths as resolveConfiguredAiMemoryPaths } from "../config/ai-memory-path-resolver.js";
import { createBusinessAuditArchive, EventCenterFacade } from "../../services/support/capabilities/event-center/index.js";
import { WorkspaceFacade } from "../../services/support/platform/workspace/index.js";

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
  auditAcceptanceIsolation({ applicationName, projectRoot: configuredProjectRoot, projectPaths });
  const workspaces = new WorkspaceFacade(path.join(app.getPath("userData"), "workspace-profiles.json"), configuredProjectRoot);
  const workspaceState = workspaces.read();
  const selectedWorkspace = workspaceState.roots.find((root) => root.id === workspaceState.primaryId);
  if (!selectedWorkspace || !path.isAbsolute(selectedWorkspace.path)
    || !existsSync(path.join(selectedWorkspace.path, "apps", applicationName, "package.json"))) {
    throw new Error("工作区中没有工程，请添加工程");
  }

  const projectRoot = path.resolve(selectedWorkspace.path);
  if (readArgument("--ai-desktop-acceptance-isolation-root=") && projectRoot !== configuredProjectRoot) {
    throw new Error("隔离验收工作区不得在启动后切换项目根。");
  }
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
  const runtimeSourceSha = runtimeSourceShaArgument && /^[0-9a-f]{40,64}$/.test(runtimeSourceShaArgument)
    ? runtimeSourceShaArgument
    : null;

  return {
    applicationName,
    variant: resolveAppVariant(),
    projectRoot,
    projectPaths,
    preloadPath: path.join(electronDirectory, "preload", "preload.cjs"),
    healthCheckFile,
    runtimeSourceSha,
    workspaces,
    eventCenter,
    ownsApplicationInstance,
  };
}

/**
 * 在任何可写服务创建前校验验收进程的全部已知运行根。
 * 正式启动没有本参数，因此保持原有路径和行为。
 */
function auditAcceptanceIsolation(options: {
  applicationName: string;
  projectRoot: string;
  projectPaths: ReturnType<typeof resolveApplicationDataPaths>;
}): void {
  const isolationRootArgument = readArgument("--ai-desktop-acceptance-isolation-root=");
  if (!isolationRootArgument) return;
  if (!app.isPackaged) throw new Error("隔离验收只允许启动已打包的 AI Desktop。");
  const isolationRoot = path.resolve(isolationRootArgument);
  const protectedProjectRoot = requireArgument("--ai-desktop-acceptance-protected-project-root=");
  const protectedUserDataRoot = requireArgument("--ai-desktop-acceptance-protected-user-data-root=");
  const userDataRoot = path.resolve(app.getPath("userData"));
  const database = resolveConfiguredAiMemoryPaths(options.projectRoot);
  const auditPath = path.join(isolationRoot, "path-audit", "runtime-paths.json");
  const writablePaths = [
    options.projectRoot, database.databasePath, `${database.databasePath}-wal`, `${database.databasePath}-shm`,
    path.join(userDataRoot, "ai-memory-database-state.json"), path.join(userDataRoot, "workspace-profiles.json"),
    path.join(userDataRoot, "rule-workspace"), path.join(userDataRoot, "codex-home"), path.join(userDataRoot, "collaboration"),
    path.join(userDataRoot, "desktop-settings.json"), path.join(userDataRoot, "trusted-project-commands.json"),
    path.join(userDataRoot, "conversation-dispatch.json"), path.join(userDataRoot, "corpus-semantic-backfill-workspace"),
    path.join(userDataRoot, "corpus-semantic-backfill-session.json"), options.projectPaths.buildRoot, options.projectPaths.cacheRoot,
    options.projectPaths.archiveLogRoot, options.projectPaths.temporaryMaterialsRoot, auditPath,
  ].map((candidate) => path.resolve(candidate));
  const protectedRoots = [path.resolve(protectedProjectRoot), path.resolve(protectedUserDataRoot)];
  for (const candidate of writablePaths) {
    if (!isDescendantOrSame(isolationRoot, candidate) || protectedRoots.some((root) => isDescendantOrSame(root, candidate))) {
      throw new Error(`隔离验收路径越界，拒绝启动：${candidate}`);
    }
  }
  process.env.AI_DESKTOP_ACCEPTANCE_ISOLATED = "1";
  mkdirSync(path.dirname(auditPath), { recursive: true });
  writeFileSync(auditPath, `${JSON.stringify({
    mode: "acceptance-isolated", recordedAt: new Date().toISOString(), isolationRoot,
    writablePaths, readonlyPaths: [path.join(process.resourcesPath, "prompts"), path.join(process.resourcesPath, "ruleengine"), path.join(app.getAppPath(), "dist", "developer")],
  }, null, 2)}\n`, "utf8");
}

function readArgument(prefix: string): string | null {
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) || null;
}

function requireArgument(prefix: string): string {
  const value = readArgument(prefix);
  if (!value) throw new Error(`隔离验收缺少启动参数：${prefix}`);
  return value;
}

function isDescendantOrSame(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}
