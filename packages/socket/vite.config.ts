import { defineConfig } from "vite"
import { resolve } from "path"

export default defineConfig({
  plugins: [],
  test: {
    globals: true,
    environment: "node",
    testTimeout: 10000,
    // setupFiles: [resolve(__dirname, "./__tests__/setup.ts")],
    onConsoleLog(warning) {
      if (warning.includes("Sourcemap")) {
        return false
      }
    },
  },
  build: {
    target: "node20",
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      input: "src/server.ts",
      output: {
        format: "esm",
        entryFileNames: "[name].js",
      },
      external: ["express", "socket.io"],
    },
  },
})
