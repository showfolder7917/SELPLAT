#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveApplicationDataPaths, resolveApplicationNameFromSourceRoot } from "@selplat/node-common-core/path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = path.resolve(root, "../..");
const projectPaths = resolveApplicationDataPaths({ selplatRoot: projectRoot, applicationName: resolveApplicationNameFromSourceRoot(root) });
const sitesBuild = path.join(projectPaths.buildRoot, "sites");
const index = path.join(sitesBuild, "client", "index.html");
const worker = path.join(root, "worker", "index.js");
const hosting = path.join(root, ".openai", "hosting.json");

for (const file of [index, worker, hosting]) {
  if (!existsSync(file)) throw new Error("Missing Sites build input: " + file);
}

mkdirSync(path.join(sitesBuild, "server"), { recursive: true });
mkdirSync(path.join(sitesBuild, ".openai"), { recursive: true });
copyFileSync(worker, path.join(sitesBuild, "server", "index.js"));
copyFileSync(hosting, path.join(sitesBuild, ".openai", "hosting.json"));

console.log(`Prepared Sites build: ${sitesBuild}`);
