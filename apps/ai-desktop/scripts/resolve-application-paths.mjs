import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveApplicationDataPaths, resolveApplicationNameFromSourceRoot } from "@selplat/node-common-core/path";
import { resolveDependencyCache } from "./dependency-cache.mjs";

const applicationRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const selplatRoot = path.resolve(applicationRoot, "..", "..");
const applicationName = resolveApplicationNameFromSourceRoot(applicationRoot);
const paths = resolveApplicationDataPaths({ selplatRoot, applicationName });
const dependency = resolveDependencyCache();
if (dependency.applicationName !== applicationName || dependency.appRoot !== applicationRoot) {
  throw new Error("Dependency lease application identity does not match the diagnosed source root");
}

// 源码、构建和任务证据保持工作树隔离；只有依赖缓存可以在 Git 登记与锁哈希验证后指向主工程共享根。
process.stdout.write(`${JSON.stringify({
  name: applicationName,
  applicationName,
  applicationRoot,
  selplatRoot,
  ...paths,
  dependencyCacheRoot: dependency.dependencyCacheRoot,
  dependencyCacheScope: dependency.dependencyLeaseId ? "managed-worktree-shared" : "project-local",
}, null, 2)}\n`);
