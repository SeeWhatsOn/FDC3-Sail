import { After, AfterAll } from "@cucumber/cucumber"
import { getActiveHeartbeatTimerCount } from "../../src/core/handlers/dacp/heartbeat-runtime"

/**
 * P0: Scenarios tagged @p0-cleanup must leave no module-level heartbeat timers behind.
 */
After({ tags: "@p0-cleanup" }, function () {
  const activeTimers = getActiveHeartbeatTimerCount()
  if (activeTimers > 0) {
    throw new Error(
      `${activeTimers} heartbeat timer(s) still active after scenario — expected 0 (see heartbeat-runtime.ts)`
    )
  }
})

/**
 * Force process exit after all tests complete when stray timers remain.
 * Prefer the After hook above passing so the process exits naturally.
 */
AfterAll(function () {
  const activeTimers = getActiveHeartbeatTimerCount()
  if (activeTimers === 0) {
    return
  }
  setImmediate(() => process.exit(0))
})
