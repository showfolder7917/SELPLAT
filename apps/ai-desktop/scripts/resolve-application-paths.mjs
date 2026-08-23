import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveApplicationDataPaths, resolveApplicationNameFromSourceRoot } from "@selplat/node-common-core/path";

const applicationRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const selplatRoot = path.resolve(applicationRoot, "..", "..");
const applicationName = resolveApplicationNameFromSourceRoot(applicationRoot);
const paths = resolveApplicationDataPaths({ selplatRoot, applicationName });

// 从脚本位置而非调用方 cwd 解析，确保工程根和应用内调用得到同一组权威路径。
process.stdout.write(`${JSON.stringify({ name: applicationName, applicationName, applicationRoot, selplatRoot, ...paths }, null, 2)}\n`);
