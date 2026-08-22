import { existsSync } from "node:fs";
import path from "node:path";

import { app } from "electron";

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
