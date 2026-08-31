import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { resolveSrcDir } from "./src-dir.ts";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": resolveSrcDir(import.meta.url) },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
  },
});
