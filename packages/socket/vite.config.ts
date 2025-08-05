import { defineConfig } from "vitest/config"
import { resolve } from "path"

export default defineConfig({
  plugins: [],
  build: {
    target: "node20",
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      input: "src/main.ts",
      output: {
        format: "esm",
        entryFileNames: "[name].js",
      },
      external: ["express", "socket.io"],
    },
  },
})
