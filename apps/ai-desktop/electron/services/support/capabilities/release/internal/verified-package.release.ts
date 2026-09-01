import { cpSync, existsSync, mkdirSync, readlinkSync, readdirSync, symlinkSync, unlinkSync } from "node:fs";
import path from "node:path";

/** 只解析已经由固定打包与签名验证门禁生成的应用，不回退到源码、外部 build 或旧安装。 */
export function resolveVerifiedDeveloperExecutable(buildRoot: string): string {
  if (process.platform !== "darwin") throw new Error("当前仅支持发布已验证的 macOS 开发版。");
  const releaseRoot = path.join(buildRoot, "package", "developer");
  const directory = readdirSync(releaseRoot, { withFileTypes: true }).find((entry) => entry.isDirectory() && entry.name.startsWith("mac"));
  if (!directory) throw new Error("未找到已验证的 macOS 开发版目录。");
  const executable = path.join(releaseRoot, directory.name, "AI Desktop.app", "Contents", "MacOS", "AI Desktop");
  if (!existsSync(executable)) throw new Error("已验证开发版缺少启动程序。");
  return executable;
}

/** 把候选工作区内已验证的应用提升到工程稳定构建域，候选回收后仍可发布和重启。 */
export function stageVerifiedDeveloperExecutable(sourceExecutable: string, stableBuildRoot: string, releaseBatchId: string): string {
  const safeBatchId = releaseBatchId.toLowerCase().replaceAll(/[^a-z0-9._-]+/g, "-").replaceAll(/^-+|-+$/g, "");
  if (!safeBatchId) throw new Error("发布批次 ID 无法用于稳定发布目录。");
  // 启动程序位于 App/Contents/MacOS，两级向上才是应用包根；多退一层会复制整个架构目录并丢失目标启动程序。
  const sourceApp = path.resolve(path.dirname(sourceExecutable), "../..");
  const destinationRoot = path.join(path.resolve(stableBuildRoot), "package", "published", safeBatchId);
  const destinationApp = path.join(destinationRoot, "AI Desktop.app");
  const destinationExecutable = path.join(destinationApp, "Contents", "MacOS", "AI Desktop");
  if (!existsSync(sourceExecutable)) throw new Error("候选工作区内的已验证启动程序不存在。");
  if (existsSync(destinationApp)) throw new Error(`发布批次稳定应用已存在，禁止覆盖：${destinationApp}`);
  mkdirSync(destinationRoot, { recursive: true });
  // macOS 应用包大量使用相对符号链接；禁止 cpSync 把它们改写为候选 worktree 的绝对路径，
  // 否则候选回收后 Electron Framework 会变成断链，已发布应用无法启动。
  cpSync(sourceApp, destinationApp, { recursive: true, preserveTimestamps: true, verbatimSymlinks: true });
  rewriteBundleSymlinks(sourceApp, destinationApp);
  if (!existsSync(destinationExecutable)) throw new Error("稳定发布目录缺少启动程序。");
  return destinationExecutable;
}

/** 将打包器生成的候选绝对链接转换为稳定应用内的相对链接，拒绝任何指向应用包外部的依赖。 */
function rewriteBundleSymlinks(sourceApp: string, destinationApp: string): void {
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const linkPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(linkPath);
        continue;
      }
      if (!entry.isSymbolicLink()) continue;
      const target = readlinkSync(linkPath);
      if (!path.isAbsolute(target)) continue;
      const sourceRelativeTarget = path.relative(sourceApp, target);
      if (sourceRelativeTarget === "" || sourceRelativeTarget.startsWith(`..${path.sep}`) || path.isAbsolute(sourceRelativeTarget)) {
        throw new Error(`候选应用包含指向包外的绝对符号链接，禁止发布：${linkPath}`);
      }
      const stableTarget = path.join(destinationApp, sourceRelativeTarget);
      const relativeTarget = path.relative(path.dirname(linkPath), stableTarget) || ".";
      unlinkSync(linkPath);
      symlinkSync(relativeTarget, linkPath);
    }
  };
  visit(destinationApp);
}
