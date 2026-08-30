import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { resolveApplicationDataPaths, resolveApplicationNameFromSourceRoot } from "@selplat/node-common-core/path";
import { resolveSelectedWorkspaceRoot } from "./selected-workspace-root.mjs";

const require = createRequire(import.meta.url);
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = resolveSelectedWorkspaceRoot(path.resolve(appRoot, "../.."));
const projectPaths = resolveApplicationDataPaths({ selplatRoot: projectRoot, applicationName: resolveApplicationNameFromSourceRoot(appRoot) });
const packageRoot = path.join(projectPaths.buildRoot, "package", "developer");
const macDirectory = existsSync(packageRoot)
  ? readdirSync(packageRoot, { withFileTypes: true }).find((entry) => entry.isDirectory() && entry.name.startsWith("mac"))
  : null;
if (!macDirectory) throw new Error(`Packaged developer application is unavailable: ${packageRoot}`);
const asarPath = path.join(packageRoot, macDirectory.name, "AI Desktop.app", "Contents", "Resources", "app.asar");
const resourcesRoot = path.dirname(asarPath);
if (!existsSync(asarPath)) throw new Error(`Electron asar is unavailable: ${asarPath}`);
for (const ruleResource of ["manifest.json", "rules.json"]) {
  const rulePath = path.join(resourcesRoot, "ruleengine", ruleResource);
  if (!existsSync(rulePath)) throw new Error(`Packaged production rule resource is missing: ${rulePath}`);
}

const listing = execFileSync(process.execPath, [require.resolve("@electron/asar/bin/asar.js"), "list", asarPath], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
const entries = listing.split("\n").filter(Boolean);
const required = [
  "/node_modules/@selplat/node-common-core/package.json",
  "/node_modules/@selplat/node-common-core/dist/index.js",
  "/node_modules/@selplat/node-common-core/dist/path/application-paths.js",
  "/node_modules/tar/package.json",
  "/node_modules/@isaacs/fs-minipass/package.json",
  "/node_modules/chownr/package.json",
  "/node_modules/minipass/package.json",
  "/node_modules/minizlib/package.json",
];
for (const entry of required) if (!entries.includes(entry)) throw new Error(`Packaged Node common runtime is missing: ${entry}`);

const forbidden = entries.filter((entry) =>
  /(?:^|\/)(?:shared\/backend|rule-engine|ruleengine|__pycache__|OPTION\/temp)(?:\/|$)|\.(?:java|class|jar|py|pyc)$|(?:^|\/)build\.gradle$/.test(entry)
  || /\/node_modules\/@selplat\/node-common-core\/(?:src|tests)(?:\/|$)/.test(entry)
  || /\/node_modules\/@selplat\/node-common-core\/.*(?:\.map|\.d\.ts)$/.test(entry)
  || /\/node_modules\/@selplat\/sel-ui(?:\/|$)/.test(entry)
);
if (forbidden.length > 0) throw new Error(`Forbidden source, temporary, or non-runtime content entered Electron package:\n${forbidden.slice(0, 20).join("\n")}`);
console.log(`Electron package content verified: ${entries.length} runtime entries, no source, temporary, or cross-language leakage.`);
