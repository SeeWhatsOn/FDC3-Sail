import { AfterAll } from "@cucumber/cucumber"

/**
 * Force process exit after all tests complete.
 *
 * The DesktopAgent registers setInterval heartbeat timers per connected app instance.
 * These timers are stored in a module-level map in heartbeat-handlers.ts and persist
 * across scenarios since there is no explicit cleanup between them. Without this hook
 * the Node.js event loop stays alive for up to 90 seconds (30s interval × 3 missed
 * heartbeats before timeout) after the last scenario finishes.
 */
AfterAll(function () {
  setImmediate(() => process.exit(0))
})
