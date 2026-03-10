import { defineConfig } from "tsdown"

export default defineConfig({
  entry: ["./src/index.ts", "./src/browser/index.ts", "./src/transports/index.ts"],
  sourcemap: true,
})
