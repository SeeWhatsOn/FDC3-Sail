import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    projects: [
      "packages/sail-desktop-agent/vitest.config.ts",
      "packages/sail-platform-api/vitest.config.ts",
      "packages/sail-web/vitest.config.ts",
      "packages/sail-conformance-harness/vitest.config.ts",
    ],
  },
})
