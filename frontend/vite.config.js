import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    /** Avoid publishing source maps for public deployments (reduces exposed internals). */
    sourcemap: false,
  },
  /**
   * SPA history fallback: `vite preview` serves index.html for unknown paths.
   * On production (e.g. https://taeen-aljawdah.com), configure the host to return
   * `index.html` for client routes — e.g. Nginx `try_files $uri $uri/ /index.html;`.
   */
  css: {
    postcss: "./postcss.config.js",
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});
