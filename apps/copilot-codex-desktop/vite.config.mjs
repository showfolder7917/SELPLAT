import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const variant = process.env.VITE_APP_VARIANT === "developer" ? "developer" : "office";

export default defineConfig({
  base: "./",
  build: {
    outDir: variant === "developer" ? "dist/developer" : "dist/client",
  },
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
