/**
 * Tracks pending-intent raise/delivery timeout handles so Cucumber can clear them
 * after each scenario (same pattern as heartbeat/runtime.ts).
 */

const pendingIntentTimeoutHandles = new Set<ReturnType<typeof setTimeout>>()

export function registerPendingIntentTimeoutHandle(handle: ReturnType<typeof setTimeout>): void {
  pendingIntentTimeoutHandles.add(handle)
}

export function clearPendingIntentTimeoutHandle(
  handle: ReturnType<typeof setTimeout> | undefined,
): void {
  if (!handle) {
    return
  }
  clearTimeout(handle)
  pendingIntentTimeoutHandles.delete(handle)
}

/** Called when a tracked timeout fires naturally (already consumed by the event loop). */
export function releasePendingIntentTimeoutHandle(handle: ReturnType<typeof setTimeout>): void {
  pendingIntentTimeoutHandles.delete(handle)
}

/** @internal Returns active pending-intent timeout count (for tests and diagnostics). */
export function getActivePendingIntentTimeoutCount(): number {
  return pendingIntentTimeoutHandles.size
}

/** @internal Clears all tracked pending-intent timeouts (Cucumber / tests only). */
export function clearAllPendingIntentTimeoutsForTesting(): void {
  for (const handle of pendingIntentTimeoutHandles) {
    clearTimeout(handle)
  }
  pendingIntentTimeoutHandles.clear()
}
