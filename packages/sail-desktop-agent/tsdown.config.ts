import { defineConfig } from "tsdown"

export default defineConfig({
  entry: [
    "./src/index.ts",
    "./src/connectors/browser/index.ts",
    "./src/transports/index.ts",
    "./src/presets/index.ts",
  ],
  sourcemap: true,
})
