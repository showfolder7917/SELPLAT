import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { app } from "electron";
import { validateSafeIdentifier } from "@selplat/node-common-core/validation";

import type { AppVariantValue } from "../../../contracts/foundation/index.js";
import { resolveAiMemoryPaths as resolveConfiguredAiMemoryPaths, type ResolvedAiMemoryPaths } from "./ai-memory-path-resolver.js";

type ApplicationMetadata = {
  name?: unknown;
  selplatDevelopmentRoot?: unknown;
};

function readApplicationMetadata(): ApplicationMetadata {
  const manifestPath = path.join(app.getAppPath(), "package.json");
  return JSON.parse(readFileSync(manifestPath, "utf8")) as ApplicationMetadata;
}

export function resolveAppVariant(): AppVariantValue {
  return "developer";
}

export function resolveProjectRoot(): string {
  const argumentRoot = process.argv.find((argument) => argument.startsWith("--selplat-root="))?.slice("--selplat-root=".length);
  const packagedDevelopmentRoot = app.isPackaged
    ? readApplicationMetadata().selplatDevelopmentRoot
    : undefined;
  // 显式启动参数和环境变量优先；包内开发根只在客户机器上仍然存在时继续使用。
  const explicitRoot = argumentRoot || process.env.SELPLAT_ROOT;
  const metadataRoot = typeof packagedDevelopmentRoot === "string" ? packagedDevelopmentRoot : undefined;
  const defaultDevelopmentRoot = path.resolve(app.getAppPath(), "../..");
  const packagedWorkspaceRoot = path.join(app.getPath("userData"), "workspace");
  // 开发包在构建机继续使用已登记工程；该路径不存在时回落到独立用户数据工作区。
  const fallbackRoot = app.isPackaged
    ? metadataRoot && existsSync(metadataRoot) ? metadataRoot : packagedWorkspaceRoot
    : defaultDevelopmentRoot;
  const projectRoot = path.resolve(explicitRoot || fallbackRoot);
  if (app.isPackaged && !explicitRoot && projectRoot === path.resolve(packagedWorkspaceRoot)) mkdirSync(projectRoot, { recursive: true });
  if (!existsSync(projectRoot) || (!app.isPackaged && !existsSync(path.join(projectRoot, ".git")))) {
    throw new Error(`SELPLAT project root is unavailable: ${projectRoot}`);
  }
  return projectRoot;
}

/** 从当前应用清单读取真实工程名，禁止把示例应用名固化到公共路径解析逻辑。 */
export function resolveApplicationName(): string {
  const manifest = readApplicationMetadata();
  if (typeof manifest.name !== "string") throw new Error(`Application manifest name is unavailable: ${path.join(app.getAppPath(), "package.json")}`);
  return validateSafeIdentifier(manifest.name, "applicationName");
}

/** 开发启动与 Developer 打包版都经稳定 SELPLAT 根读取同一份 AI Memory 路径配置。 */
export function resolveAiMemoryPaths(): ResolvedAiMemoryPaths {
  return resolveConfiguredAiMemoryPaths(resolveProjectRoot());
}
