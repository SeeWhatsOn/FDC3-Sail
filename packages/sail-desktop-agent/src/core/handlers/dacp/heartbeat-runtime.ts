/**
 * Heartbeat timer map and stop/clear helpers.
 *
 * Lives in a separate module from `heartbeat-handlers.ts` so `cleanup.ts` can call
 * `stopHeartbeat` without importing the full heartbeat module (avoids circular imports:
 * cleanup → heartbeat-handlers → cleanup).
 */

import { stopHeartbeat as stopHeartbeatTransform } from "../../state/mutators"
import type { StateSetter } from "../../state/types"

const heartbeatIntervals = new Map<string, NodeJS.Timeout>()

/** WCP4 temp connection ids (temp-{uuid}) → canonical WCP5 instance ids used by startHeartbeat. */
const wcpTempToCanonicalInstanceIds = new Map<string, string>()

/** Record temp→canonical mapping when heartbeat starts during WCP4 validation. */
export function linkWcpTempInstanceId(tempInstanceId: string, canonicalInstanceId: string): void {
  wcpTempToCanonicalInstanceIds.set(tempInstanceId, canonicalInstanceId)
}

/** Resolve canonical instance id from a WCP4 temp connection id, if linked. */
export function resolveWcpTempInstanceId(tempInstanceId: string): string | undefined {
  return wcpTempToCanonicalInstanceIds.get(tempInstanceId)
}

function unlinkWcpTempMappingsForCanonical(canonicalInstanceId: string): void {
  for (const [tempId, canonicalId] of wcpTempToCanonicalInstanceIds) {
    if (canonicalId === canonicalInstanceId) {
      wcpTempToCanonicalInstanceIds.delete(tempId)
    }
  }
}

/** @internal Returns active heartbeat interval count (for tests and diagnostics). */
export function getActiveHeartbeatTimerCount(): number {
  return heartbeatIntervals.size
}

/** @internal Returns instanceIds with active heartbeat interval timers. */
export function getActiveHeartbeatInstanceIds(): string[] {
  return [...heartbeatIntervals.keys()]
}

/** @internal Clears all heartbeat intervals without touching agent state (tests only). */
export function clearAllHeartbeatTimersForTesting(): void {
  for (const instanceId of [...heartbeatIntervals.keys()]) {
    clearHeartbeatTimer(instanceId)
  }
  wcpTempToCanonicalInstanceIds.clear()
}

/** Clear the Node interval only (no Immer state change). */
export function clearHeartbeatTimer(instanceId: string): void {
  const intervalHandle = heartbeatIntervals.get(instanceId)
  if (intervalHandle) {
    clearInterval(intervalHandle)
    heartbeatIntervals.delete(instanceId)
  }
}

export function setHeartbeatTimer(instanceId: string, intervalHandle: NodeJS.Timeout): void {
  clearHeartbeatTimer(instanceId)
  heartbeatIntervals.set(instanceId, intervalHandle)
}

/**
 * Stop heartbeat for an instance (clear interval + remove heartbeat slice from agent state).
 */
export function stopHeartbeat(instanceId: string, setState: StateSetter): void {
  clearHeartbeatTimer(instanceId)
  unlinkWcpTempMappingsForCanonical(instanceId)
  setState(state => stopHeartbeatTransform(state, instanceId))
}
