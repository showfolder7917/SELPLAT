import path from "node:path";

import { validateSafeIdentifier } from "../validation/safe-identifier.js";

export interface ApplicationDataPaths {
  selplatRoot: string;
  applicationName: string;
  sourceRoot: string;
  cacheRoot: string;
  dependencyCacheRoot: string;
  buildRoot: string;
  tempRoot: string;
  executionLogRoot: string;
  pendingExecutionRoot: string;
  pendingTestRoot: string;
  runningExecutionRoot: string;
  runningTestRoot: string;
  temporaryMaterialsRoot: string;
  archiveLogRoot: string;
  executionArchiveRoot: string;
  testArchiveRoot: string;
  collaborationArchiveRoot: string;
  approvalArchiveRoot: string;
  diagnosticArchiveRoot: string;
}

export interface ResolveApplicationDataPathsRequest {
  selplatRoot: string;
  applicationName: string;
  pathApi?: path.PlatformPath;
}

/** 根据已验证工程根和真实应用名返回完整数据域；本方法没有创建、移动或删除副作用。 */
export function resolveApplicationDataPaths(request: ResolveApplicationDataPathsRequest): ApplicationDataPaths {
  const pathApi = request.pathApi || path;
  const applicationName = validateSafeIdentifier(request.applicationName, "applicationName");
  const selplatRoot = pathApi.resolve(request.selplatRoot);
  const sourceRoot = inside(pathApi, selplatRoot, "apps", applicationName);
  const cacheRoot = inside(pathApi, selplatRoot, "cache", applicationName);
  const buildRoot = inside(pathApi, selplatRoot, "build", applicationName);
  const tempRoot = inside(pathApi, selplatRoot, "OPTION", "temp", applicationName);
  const executionLogRoot = inside(pathApi, tempRoot, "执行日志");
  const temporaryMaterialsRoot = inside(pathApi, tempRoot, "临时材料");
  const archiveLogRoot = inside(pathApi, selplatRoot, "log", applicationName, "归档日志");
  return {
    selplatRoot,
    applicationName,
    sourceRoot,
    cacheRoot,
    dependencyCacheRoot: inside(pathApi, cacheRoot, "dependencies"),
    buildRoot,
    tempRoot,
    executionLogRoot,
    pendingExecutionRoot: inside(pathApi, executionLogRoot, "待执行", "执行"),
    pendingTestRoot: inside(pathApi, executionLogRoot, "待执行", "测试"),
    runningExecutionRoot: inside(pathApi, executionLogRoot, "运行中", "执行"),
    runningTestRoot: inside(pathApi, executionLogRoot, "运行中", "测试"),
    temporaryMaterialsRoot,
    archiveLogRoot,
    executionArchiveRoot: inside(pathApi, archiveLogRoot, "执行归档"),
    testArchiveRoot: inside(pathApi, archiveLogRoot, "测试归档"),
    collaborationArchiveRoot: inside(pathApi, archiveLogRoot, "协同归档"),
    approvalArchiveRoot: inside(pathApi, archiveLogRoot, "审批归档"),
    diagnosticArchiveRoot: inside(pathApi, archiveLogRoot, "诊断归档"),
  };
}

/** 从已验证的应用源码根目录名解析应用名，禁止调用方把示例名当成公共默认值。 */
export function resolveApplicationNameFromSourceRoot(sourceRoot: string, pathApi: path.PlatformPath = path): string {
  return validateSafeIdentifier(pathApi.basename(pathApi.resolve(sourceRoot)), "applicationName");
}

/** 为归档创建安全的年月分区，不接受调用方任意路径文本。 */
export function resolveArchiveMonth(isoTimestamp: string): string {
  const timestamp = new Date(isoTimestamp);
  if (!Number.isFinite(timestamp.getTime())) throw new Error("archive timestamp is invalid");
  return timestamp.toISOString().slice(0, 7);
}

function inside(pathApi: path.PlatformPath, root: string, ...segments: string[]): string {
  const resolvedRoot = pathApi.resolve(root);
  const candidate = pathApi.resolve(resolvedRoot, ...segments);
  const relative = pathApi.relative(resolvedRoot, candidate);
  if (relative === "" || (!relative.startsWith(`..${pathApi.sep}`) && relative !== ".." && !pathApi.isAbsolute(relative))) return candidate;
  throw new Error(`Resolved path escaped its data root: ${candidate}`);
}
