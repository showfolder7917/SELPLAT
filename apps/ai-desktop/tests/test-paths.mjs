import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveApplicationDataPaths, resolveApplicationNameFromSourceRoot } from "@selplat/node-common-core/path";
import { assertWorkspaceDataPath, resolveSelectedWorkspaceRoot } from "../scripts/selected-workspace-root.mjs";

export const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const sourceProjectRoot = path.resolve(appRoot, "../..");
export const projectRoot = resolveSelectedWorkspaceRoot(sourceProjectRoot);
export const projectPaths = resolveApplicationDataPaths({ selplatRoot: projectRoot, applicationName: resolveApplicationNameFromSourceRoot(appRoot) });
export const controlledTestRoot = assertWorkspaceDataPath(projectRoot, path.join(projectPaths.temporaryMaterialsRoot, "测试证据", "正式测试"));
mkdirSync(controlledTestRoot, { recursive: true });
