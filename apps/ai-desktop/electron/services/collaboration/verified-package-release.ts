import { existsSync, readdirSync } from "node:fs";
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
