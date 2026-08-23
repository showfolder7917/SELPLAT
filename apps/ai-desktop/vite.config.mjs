import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveApplicationDataPaths, resolveApplicationNameFromSourceRoot } from "@selplat/node-common-core/path";

const variant = process.env.VITE_APP_VARIANT === "developer" ? "developer" : "office";
const appRoot = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(appRoot, "../..");
const projectPaths = resolveApplicationDataPaths({ selplatRoot: projectRoot, applicationName: resolveApplicationNameFromSourceRoot(appRoot) });

export default defineConfig({
  base: "./",
  build: {
    outDir: variant === "developer" ? path.join(projectPaths.buildRoot, "renderer", "developer") : path.join(projectPaths.buildRoot, "sites", "client"),
    emptyOutDir: true,
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
