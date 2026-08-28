import path from "node:path";
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
export declare function resolveApplicationDataPaths(request: ResolveApplicationDataPathsRequest): ApplicationDataPaths;
/** 从已验证的应用源码根目录名解析应用名，禁止调用方把示例名当成公共默认值。 */
export declare function resolveApplicationNameFromSourceRoot(sourceRoot: string, pathApi?: path.PlatformPath): string;
/** 为归档创建安全的年月分区，不接受调用方任意路径文本。 */
export declare function resolveArchiveMonth(isoTimestamp: string): string;
//# sourceMappingURL=application-paths.d.ts.map