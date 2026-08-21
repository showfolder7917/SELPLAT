import { existsSync } from "node:fs";
import path from "node:path";

import { app } from "electron";

import type { AppVariant } from "../../shared/contracts/desktop.js";

export function resolveAppVariant(): AppVariant {
  if (process.env.AI_DESKTOP_VARIANT === "developer") return "developer";
  if (process.env.AI_DESKTOP_VARIANT === "office") return "office";
  return app.getName().toLowerCase().includes("developer") ? "developer" : "office";
}

export function resolveProjectRoot(): string {
  const configuredRoot = process.env.SELPLAT_ROOT;
  const projectRoot = path.resolve(configuredRoot || path.join(app.getAppPath(), "../.."));
  if (!existsSync(projectRoot) || !existsSync(path.join(projectRoot, ".git"))) {
    throw new Error(`SELPLAT project root is unavailable: ${projectRoot}`);
  }
  return projectRoot;
}
