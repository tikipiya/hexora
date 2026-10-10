import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

function wasmMimeType(): Plugin {
  return {
    name: "hexora-wasm-mime",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.includes(".wasm")) {
          res.setHeader("Content-Type", "application/wasm");
        }
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.includes(".wasm")) {
          res.setHeader("Content-Type", "application/wasm");
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), wasmMimeType()],
  resolve: {
    alias: {
      "@hexora/shared": path.resolve(__dirname, "../shared/src/index.ts"),
    },
  },
  assetsInclude: ["**/*.wasm"],
  worker: {
    format: "es",
  },
  optimizeDeps: {
    include: ["fzstd", "xz-decompress"],
    exclude: ["compressjs"],
  },
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8788",
        changeOrigin: true,
      },
    },
  },
});
