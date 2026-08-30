import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveApplicationDataPaths, resolveApplicationNameFromSourceRoot } from "@selplat/node-common-core/path";
import { resolveDependencyCache } from "./dependency-cache.mjs";
import { resolveSelectedWorkspaceRoot } from "./selected-workspace-root.mjs";

const applicationRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceProjectRoot = path.resolve(applicationRoot, "..", "..");
const selplatRoot = resolveSelectedWorkspaceRoot(sourceProjectRoot);
const applicationName = resolveApplicationNameFromSourceRoot(applicationRoot);
const paths = resolveApplicationDataPaths({ selplatRoot, applicationName });
const dependency = resolveDependencyCache();
if (dependency.applicationName !== applicationName || dependency.appRoot !== applicationRoot) {
  throw new Error("Dependency lease application identity does not match the diagnosed source root");
}

// 源码仍来自当前候选工作树；统一配置只把数据、缓存、日志、证据和发布产物解析到用户选择的工作区。
process.stdout.write(`${JSON.stringify({
  name: applicationName,
  applicationName,
  applicationRoot,
  sourceProjectRoot,
  selplatRoot,
  ...paths,
  dependencyCacheRoot: dependency.dependencyCacheRoot,
  dependencyCacheScope: dependency.dependencyLeaseId ? "managed-worktree-shared" : "project-local",
}, null, 2)}\n`);
