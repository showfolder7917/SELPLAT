import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const runtimeRoot = process.argv.find((argument) => argument.startsWith("--ai-desktop-runtime-root="))
  ?.slice("--ai-desktop-runtime-root=".length);

if (runtimeRoot) {
  const externalMain = path.join(runtimeRoot, "dist-electron", "electron", "main.js");
  if (!existsSync(externalMain)) throw new Error(`AI Desktop external runtime is unavailable: ${externalMain}`);
  await import(pathToFileURL(externalMain).href);
} else {
  await import("./main.js");
}
