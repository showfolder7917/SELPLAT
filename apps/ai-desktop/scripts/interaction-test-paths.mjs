import path from "node:path";

import { resolveDependencyCache } from "./dependency-cache.mjs";

/**
 * 交互测试在公共 Node 包尚未编译时也必须能建立隔离证据目录。
 * 工程根和应用名复用依赖缓存入口的安全解析结果，避免从 worktree 名或调用目录猜测身份。
 */
export function resolveInteractionTestPaths() {
  const { projectRoot, applicationName } = resolveDependencyCache();
  const tempRoot = path.join(projectRoot, "OPTION", "temp", applicationName);
  return {
    temporaryMaterialsRoot: path.join(tempRoot, "临时材料"),
    archiveLogRoot: path.join(projectRoot, "log", applicationName, "归档日志"),
  };
}
