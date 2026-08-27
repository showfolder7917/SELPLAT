import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const applicationRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputFile = path.resolve(applicationRoot, "../../build/ai-desktop/electron/electron/preload.cjs");

await mkdir(path.dirname(outputFile), { recursive: true });
// 沙箱 preload 的 require 只能访问 Electron 和少量内置模块；领域源码必须在交付前合并成一个物理文件。
await build({
  entryPoints: [path.join(applicationRoot, "electron/preload.cts")],
  outfile: outputFile,
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  external: ["electron"],
  sourcemap: true,
  sourcesContent: false,
  logLevel: "info",
});
