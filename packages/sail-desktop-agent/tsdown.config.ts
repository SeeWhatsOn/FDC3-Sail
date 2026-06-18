import { defineConfig } from "tsdown"

export default defineConfig({
  entry: [
    "./src/index.ts",
    "./src/app-connection/index.ts",
    "./src/transports/index.ts",
    "./src/presets/index.ts",
  ],
  sourcemap: true,
})
