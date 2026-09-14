import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { WorkspaceStartupRecoveryEvidenceOutDto } from "../../../contracts/services/personas/hanli/index.js";
import type { WorkspaceFacade as WorkspaceStore } from "../../services/support/platform/workspace/index.js";
import { WorkspaceAcceptanceFixture, WORKSPACE_ACCEPTANCE_FIXTURE_MARKER, WORKSPACE_ACCEPTANCE_FIXTURE_MARKER_NAME } from "./workspace-acceptance-fixture.js";

export interface WorkspaceStartupRecoveryCheck {
  resultFile: string;
  temporaryRoot: string;
}

/** 在隔离工程和用户目录中启动同一已打包应用，证明重启装配会在首屏前清除私有夹具。 */
export async function runWorkspaceStartupRecoveryAcceptance(options: {
  executable: string;
  formalProjectRoot: string;
  formalUserDataRoot: string;
  temporaryParent: string;
}): Promise<WorkspaceStartupRecoveryEvidenceOutDto> {
  const isolationRoot = mkdtempSync(path.join(options.temporaryParent, "ai-desktop-workspace-restart-"));
  const projectRoot = path.join(isolationRoot, "project");
  const applicationRoot = path.join(projectRoot, "apps", "ai-desktop");
  const databaseRoot = path.join(applicationRoot, "db");
  const userDataRoot = path.join(isolationRoot, "user-data");
  const temporaryRoot = path.join(isolationRoot, "temp");
  const staleRoot = path.join(temporaryRoot, "stale-fixture");
  const unmarkedRoot = path.join(temporaryRoot, "unmarked-workspace");
  const resultFile = path.join(isolationRoot, "result", "workspace-startup-recovery.json");
  try {
    for (const directory of [applicationRoot, databaseRoot, userDataRoot, staleRoot, unmarkedRoot]) mkdirSync(directory, { recursive: true });
    writeFileSync(path.join(applicationRoot, "package.json"), `${JSON.stringify({ name: "ai-desktop", version: "0.1.1" })}\n`, "utf8");
    // 启动路径审计会先读取工程内唯一数据库配置；夹具必须提供完整的最小工程结构，不能依赖正式工程文件。
    writeFileSync(path.join(databaseRoot, "ai-memory-paths.json"), `${JSON.stringify({ schemaVersion: 2, databaseFile: "events.sqlite3" })}\n`, "utf8");
    writeFileSync(path.join(staleRoot, WORKSPACE_ACCEPTANCE_FIXTURE_MARKER_NAME), JSON.stringify(WORKSPACE_ACCEPTANCE_FIXTURE_MARKER), "utf8");
    writeFileSync(path.join(userDataRoot, "workspace-profiles.json"), `${JSON.stringify({
      permissionDefaultsVersion: 1,
      primaryId: "isolated-project",
      roots: [
        { id: "isolated-project", name: "隔离正式工作区", path: projectRoot, permission: "workspace-write" },
        { id: "stale-fixture", name: "异常遗留临时工作区", path: staleRoot, permission: "read-only" },
        { id: "unmarked-workspace", name: "未标记工作区", path: unmarkedRoot, permission: "read-only" },
      ],
    }, null, 2)}\n`, "utf8");
    await runProbeProcess(options.executable, [
      `--selplat-root=${projectRoot}`,
      `--ai-desktop-user-data-dir=${userDataRoot}`,
      `--ai-desktop-acceptance-isolation-root=${isolationRoot}`,
      `--ai-desktop-acceptance-protected-project-root=${options.formalProjectRoot}`,
      `--ai-desktop-acceptance-protected-user-data-root=${options.formalUserDataRoot}`,
      `--ai-desktop-workspace-recovery-check-file=${resultFile}`,
      `--ai-desktop-workspace-recovery-temp-root=${temporaryRoot}`,
    ]);
    const result = JSON.parse(readFileSync(resultFile, "utf8")) as WorkspaceStartupRecoveryEvidenceOutDto;
    if (result.status !== "passed") throw new Error(result.reason || "隔离重启回收检查未通过。");
    return result;
  } finally {
    rmSync(isolationRoot, { recursive: true, force: true });
  }
}

/** 子进程在完整运行时和 Renderer 创建前执行真实夹具服务装配，并只回传不含路径的结果摘要。 */
export function completeWorkspaceStartupRecoveryCheck(check: WorkspaceStartupRecoveryCheck, workspaces: WorkspaceStore): WorkspaceStartupRecoveryEvidenceOutDto {
  const before = workspaces.read();
  const staleRoot = before.roots.find((root) => root.name === "stale-fixture" || root.name === "异常遗留临时工作区");
  const unmarkedRoot = before.roots.find((root) => root.name === "unmarked-workspace" || root.name === "未标记工作区");
  new WorkspaceAcceptanceFixture(workspaces, check.temporaryRoot);
  const after = workspaces.read();
  const staleDirectoryRemoved = !!staleRoot && !existsSync(staleRoot.path);
  const staleRegistrationRemoved = !!staleRoot && !after.roots.some((root) => root.id === staleRoot.id);
  const unmarkedWorkspacePreserved = !!unmarkedRoot && existsSync(unmarkedRoot.path) && after.roots.some((root) => root.id === unmarkedRoot.id);
  const primaryWorkspacePreserved = after.primaryId === before.primaryId && after.roots.some((root) => root.id === before.primaryId);
  const passed = staleDirectoryRemoved && staleRegistrationRemoved && unmarkedWorkspacePreserved && primaryWorkspacePreserved;
  return {
    status: passed ? "passed" : "failed",
    runId: randomUUID(),
    recordedAt: new Date().toISOString(),
    staleDirectoryRemoved,
    staleRegistrationRemoved,
    unmarkedWorkspacePreserved,
    primaryWorkspacePreserved,
    beforeRootCount: before.roots.length,
    afterRootCount: after.roots.length,
    reason: passed ? "隔离应用重启后，主进程在 Renderer 首次显示前回收了带标记遗留内容，并保留正式与未标记工作区。" : "隔离应用重启回收结果不完整。",
  };
}

function runProbeProcess(executable: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { shell: false, stdio: "ignore" });
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("隔离重启回收检查超时。"));
    }, 20_000);
    child.once("error", (error) => { clearTimeout(timeout); reject(error); });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve();
      else reject(new Error(`隔离重启回收检查进程退出码 ${code ?? "unknown"}。`));
    });
  });
}
