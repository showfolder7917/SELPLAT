import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveApplicationDataPaths, resolveApplicationNameFromSourceRoot } from "@selplat/node-common-core/path";

const variant = "developer";
const appRoot = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(appRoot, "../..");
const projectPaths = resolveApplicationDataPaths({ selplatRoot: projectRoot, applicationName: resolveApplicationNameFromSourceRoot(appRoot) });

export default defineConfig({
  base: "./",
  build: {
    outDir: path.join(projectPaths.buildRoot, "renderer", variant),
    emptyOutDir: true,
    // 桌面应用统一输出一个 CSS，保证 SELUI 基础样式与宿主覆盖在开发、构建和安装包中保持同一顺序。
    cssCodeSplit: false,
  },
  cacheDir: path.join(projectPaths.cacheRoot, "transforms", "vite", variant),
  optimizeDeps: {
    include: ["react", "react-dom/client", "@fluentui/react-icons"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.tsx"],
    },
  },
  plugins: [react()],
});
