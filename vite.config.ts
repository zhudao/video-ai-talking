import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { resolveSrcDir } from "./src-dir.ts";

const apiPort = Number(process.env.PORT || 8789);
const webPort = Number(process.env.WEB_PORT || 5175);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": resolveSrcDir(import.meta.url) },
  },
  server: {
    host: "127.0.0.1",
    port: webPort,
    proxy: {
      "/api": `http://127.0.0.1:${apiPort}`,
      "/files": `http://127.0.0.1:${apiPort}`,
    },
  },
});
