import path from "node:path";
export interface LockSpecificDependencyPaths {
    lockHash: string;
    cacheRoot: string;
    nodeModulesRoot: string;
}
/** 根据锁文件原始内容解析独立依赖缓存；不创建目录，也不建立链接。 */
export declare function resolveLockSpecificDependencyPaths(dependencyCacheRoot: string, lockFileContent: Uint8Array | string, pathApi?: path.PlatformPath): LockSpecificDependencyPaths;
//# sourceMappingURL=dependency-cache.d.ts.map