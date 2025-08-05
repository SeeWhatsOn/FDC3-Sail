import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    // Test setup
    setupFiles: ["./src/__tests__/test-setup.ts"],

    // Timeout configuration
    testTimeout: 10000, // 10 seconds for individual tests
    hookTimeout: 30000, // 30 seconds for setup/teardown hooks (server startup can be slow)

    // Test execution
    sequence: {
      hooks: "stack", // Run hooks in LIFO order for proper cleanup
    },

    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "src/__tests__/",
        "**/*.d.ts",
        "**/*.config.ts",
      ],
    },

    // Environment
    environment: "node",

    // Global test concurrency
    pool: "forks", // Use separate processes to avoid port conflicts
    poolOptions: {
      forks: {
        singleFork: true, // Use single process to avoid port conflicts
      },
    },
    reporters: ["html"],
  },
})
