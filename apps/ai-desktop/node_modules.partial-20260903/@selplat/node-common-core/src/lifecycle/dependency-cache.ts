import { createHash } from "node:crypto";
import path from "node:path";

export interface LockSpecificDependencyPaths {
  lockHash: string;
  cacheRoot: string;
  nodeModulesRoot: string;
}

/** 根据锁文件原始内容解析独立依赖缓存；不创建目录，也不建立链接。 */
export function resolveLockSpecificDependencyPaths(
  dependencyCacheRoot: string,
  lockFileContent: Uint8Array | string,
  pathApi: path.PlatformPath = path,
): LockSpecificDependencyPaths {
  const lockHash = createHash("sha256").update(lockFileContent).digest("hex");
  const resolvedRoot = pathApi.resolve(dependencyCacheRoot);
  const cacheRoot = pathApi.resolve(resolvedRoot, lockHash);
  const relative = pathApi.relative(resolvedRoot, cacheRoot);
  if (relative.startsWith(`..${pathApi.sep}`) || relative === ".." || pathApi.isAbsolute(relative)) throw new Error("dependency cache path escaped its root");
  return { lockHash, cacheRoot, nodeModulesRoot: pathApi.join(cacheRoot, "node_modules") };
}
