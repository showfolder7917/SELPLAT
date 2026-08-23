import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { app } from "electron";
import { validateSafeIdentifier } from "@selplat/node-common-core/validation";

import type { AppVariant } from "../../shared/contracts/desktop.js";

export function resolveAppVariant(): AppVariant {
  const variantArgument = process.argv.find((argument) => argument.startsWith("--ai-desktop-variant="))?.split("=", 2)[1];
  if (variantArgument === "developer" || variantArgument === "office") return variantArgument;
  if (process.env.AI_DESKTOP_VARIANT === "developer") return "developer";
  if (process.env.AI_DESKTOP_VARIANT === "office") return "office";
  return app.getName().toLowerCase().includes("office") ? "office" : "developer";
}

export function resolveProjectRoot(): string {
  const configuredRoot = process.argv.find((argument) => argument.startsWith("--selplat-root="))?.slice("--selplat-root=".length)
    || process.env.SELPLAT_ROOT;
  const projectRoot = path.resolve(configuredRoot || path.join(app.getAppPath(), "../.."));
  if (!existsSync(projectRoot) || !existsSync(path.join(projectRoot, ".git"))) {
    throw new Error(`SELPLAT project root is unavailable: ${projectRoot}`);
  }
  return projectRoot;
}

/** 从当前应用清单读取真实工程名，禁止把示例应用名固化到公共路径解析逻辑。 */
export function resolveApplicationName(): string {
  const manifestPath = path.join(app.getAppPath(), "package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { name?: unknown };
  if (typeof manifest.name !== "string") throw new Error(`Application manifest name is unavailable: ${manifestPath}`);
  return validateSafeIdentifier(manifest.name, "applicationName");
}
