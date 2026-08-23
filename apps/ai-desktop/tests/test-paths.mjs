import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveApplicationDataPaths, resolveApplicationNameFromSourceRoot } from "@selplat/node-common-core/path";

export const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const projectRoot = path.resolve(appRoot, "../..");
export const projectPaths = resolveApplicationDataPaths({ selplatRoot: projectRoot, applicationName: resolveApplicationNameFromSourceRoot(appRoot) });
export const controlledTestRoot = path.join(projectPaths.temporaryMaterialsRoot, "测试证据", "正式测试");
