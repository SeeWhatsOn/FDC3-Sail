import { defineConfig, devices } from "@playwright/test"

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    trace: "on-first-retry",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    // webkit omitted - not supported on macOS 13
  ],

  webServer: {
    command: "VITE_E2E_TEST=1 npm run dev",
    url: "http://localhost:8090/html/index.html",
    reuseExistingServer: !process.env.CI,
    timeout: 90_000,
  },
})
