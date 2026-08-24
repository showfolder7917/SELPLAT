import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { app } from "electron";
import { validateSafeIdentifier } from "@selplat/node-common-core/validation";

import type { AppVariant } from "../../shared/contracts/desktop.js";

type ApplicationMetadata = {
  name?: unknown;
  selplatDevelopmentRoot?: unknown;
};

function readApplicationMetadata(): ApplicationMetadata {
  const manifestPath = path.join(app.getAppPath(), "package.json");
  return JSON.parse(readFileSync(manifestPath, "utf8")) as ApplicationMetadata;
}

export function resolveAppVariant(): AppVariant {
  return "developer";
}

/** 只在已打包进程显式带入 archive 参数时开启免工程压缩包运行边界。 */
export function resolveDistributionMode(): "standard" | "archive" {
  const distributionArgument = process.argv.find((argument) => argument.startsWith("--ai-desktop-distribution="))?.split("=", 2)[1];
  return distributionArgument === "archive" && resolveAppVariant() === "developer" ? "archive" : "standard";
}

export function resolveProjectRoot(): string {
  const argumentRoot = process.argv.find((argument) => argument.startsWith("--selplat-root="))?.slice("--selplat-root=".length);
  const packagedDevelopmentRoot = app.isPackaged
    ? readApplicationMetadata().selplatDevelopmentRoot
    : undefined;
  // 显式启动参数和环境变量始终可以覆盖包内开发根；发布变体不读取开发版专属元数据。
  const configuredRoot = argumentRoot
    || process.env.SELPLAT_ROOT
    || (typeof packagedDevelopmentRoot === "string" ? packagedDevelopmentRoot : undefined);
  const projectRoot = path.resolve(configuredRoot || path.join(app.getAppPath(), "../.."));
  const archiveDataRoot = resolveDistributionMode() === "archive";
  if (!existsSync(projectRoot) || (!archiveDataRoot && !existsSync(path.join(projectRoot, ".git")))) {
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
