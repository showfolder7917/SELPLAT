import path from "node:path";
import { execFileSync } from "node:child_process";
import { prepareIsolatedAcceptanceProject } from "./prepare-isolated-acceptance-project.mjs";

/** 准备独立源码及其自有依赖；任何准备失败都阻止随后启动应用。 */
export function prepareIsolatedAcceptanceRuntime(sourceRoot, projectRoot) {
  const project = prepareIsolatedAcceptanceProject(sourceRoot, projectRoot);
  const applicationRoot = path.join(projectRoot, "apps", "ai-desktop");
  // 复用应用受控入口，补齐锁文件缓存与共通运行包；不连接正式工程缓存。
  // 空命令只验证准备链成功，后续真实任务仍由正式租约入口管理工作树依赖。
  execFileSync(process.execPath, ["scripts/run-with-dependencies.mjs", "node", "--version"], {
    cwd: applicationRoot,
    stdio: "inherit",
    env: { ...process.env, AI_DESKTOP_DEPENDENCY_LEASE_ID: "" },
  });
  return project;
}
