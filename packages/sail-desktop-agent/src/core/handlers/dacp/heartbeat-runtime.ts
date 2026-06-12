/**
 * Heartbeat timer map and stop/clear helpers.
 *
 * Lives in a separate module from `heartbeat-handlers.ts` so `cleanup.ts` can call
 * `stopHeartbeat` without importing the full heartbeat module (avoids circular imports:
 * cleanup → heartbeat-handlers → cleanup).
 */

import {
  clearAllWcpInstanceIdMappingsForTesting,
  linkTempToCanonical,
  resolveCanonicalInstanceId,
  unlinkCanonical,
} from "../../../protocols/wcp/wcp-instance-id-resolver"
import { stopHeartbeat as stopHeartbeatTransform } from "../../state/mutators"
import type { StateSetter } from "../../state/types"
import type { Transport } from "../../interfaces/transport"

const heartbeatIntervals = new Map<string, NodeJS.Timeout>()

/** Browser preset: tear down WCP MessagePort wiring when DA removes an instance. */
const browserEdgeDisconnectByTransport = new WeakMap<Transport, (instanceId: string) => void>()

export function registerBrowserEdgeInstanceDisconnect(
  transport: Transport,
  disconnect: (instanceId: string) => void
): void {
  browserEdgeDisconnectByTransport.set(transport, disconnect)
}

export function notifyBrowserEdgeInstanceDisconnected(
  transport: Transport,
  instanceId: string
): void {
  browserEdgeDisconnectByTransport.get(transport)?.(instanceId)
}

/** @deprecated Use {@link linkTempToCanonical} from wcp-instance-id-resolver. */
export function linkWcpTempInstanceId(tempInstanceId: string, canonicalInstanceId: string): void {
  linkTempToCanonical(tempInstanceId, canonicalInstanceId)
}

/** @deprecated Use {@link resolveCanonicalInstanceId} from wcp-instance-id-resolver. */
export function resolveWcpTempInstanceId(tempInstanceId: string): string | undefined {
  return resolveCanonicalInstanceId(tempInstanceId)
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
  clearAllWcpInstanceIdMappingsForTesting()
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
  unlinkCanonical(instanceId)
  setState(state => stopHeartbeatTransform(state, instanceId))
}
