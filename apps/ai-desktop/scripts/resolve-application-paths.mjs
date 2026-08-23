import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveApplicationDataPaths, resolveApplicationNameFromSourceRoot } from "@selplat/node-common-core/path";

const applicationRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const selplatRoot = path.resolve(applicationRoot, "..", "..");
const applicationName = resolveApplicationNameFromSourceRoot(applicationRoot);
const paths = resolveApplicationDataPaths({ selplatRoot, applicationName });

console.log(JSON.stringify({ applicationName, applicationRoot, selplatRoot, ...paths }, null, 2));
