import {
  resolvePendingIntent,
  removeListenersForInstance,
  removeInstance,
} from "../../state/mutators"
import { type DACPHandlerContext } from "../types"
import * as eventHandlers from "./event-handlers"
import * as privateChannelHandlers from "./private-channel-handlers"
import {
  getActiveHeartbeatInstanceIds,
  stopHeartbeat,
  notifyBrowserEdgeInstanceDisconnected,
} from "./heartbeat-runtime"
import { resolveCanonicalInstanceId } from "../../../protocols/wcp/wcp-instance-id-resolver"
import {
  clearPendingOpenWithContextForInstance,
  clearPendingOpenWithContextForSourceInstance,
} from "./utils/open-with-context"
import { pruneInstanceIdentity } from "./instance-identity-registry"
import type { AgentState } from "../../state/types"
import { AppInstanceState } from "../../state/types"

/**
 * WCP4 validation runs under a temp connection id while instance state uses the
 * canonical WCP5 instanceId (linked at WCP5 success in wcp-handlers).
 */
function resolveCleanupInstanceId(context: DACPHandlerContext): string {
  const { instanceId, getState } = context
  const state = getState()

  if (
    state.instances[instanceId] ||
    state.heartbeats[instanceId] ||
    getActiveHeartbeatInstanceIds().includes(instanceId)
  ) {
    return instanceId
  }

  if (instanceId.startsWith("temp-")) {
    const canonicalId = resolveCanonicalInstanceId(instanceId)
    if (
      canonicalId &&
      (state.instances[canonicalId] ||
        state.heartbeats[canonicalId] ||
        getActiveHeartbeatInstanceIds().includes(canonicalId))
    ) {
      return canonicalId
    }

    // Production records mapping at WCP5; when only one app is CONNECTED, temp disconnect
    // still targets that canonical id (heartbeat-disabled paths without heartbeat link).
    const soleConnectedInstanceId = findSoleConnectedInstanceId(state)
    if (soleConnectedInstanceId) {
      return soleConnectedInstanceId
    }
  }

  return instanceId
}

function findSoleConnectedInstanceId(state: AgentState): string | undefined {
  const connected = Object.values(state.instances).filter(
    instance => instance.state === AppInstanceState.CONNECTED
  )
  if (connected.length === 1) {
    return connected[0].instanceId
  }
  return undefined
}

function instanceHasCleanupWork(state: AgentState, instanceId: string): boolean {
  if (state.instances[instanceId] || state.heartbeats[instanceId]) {
    return true
  }

  if (getActiveHeartbeatInstanceIds().includes(instanceId)) {
    return true
  }

  if ((state.open.pendingWithContext[instanceId]?.length ?? 0) > 0) {
    return true
  }

  return Object.values(state.intents.pending).some(
    pending => pending.targetInstanceId === instanceId || pending.sourceInstanceId === instanceId
  )
}

/**
 * Cleanup when a DACP connection is closed, heartbeat times out, or the app sends WCP6Goodbye.
 * Kept in a leaf module so callers (heartbeat-handlers, wcp-handlers, desktop-agent) do not
 * import the DACP router `index.ts`, avoiding circular module graphs.
 */
export function cleanupDACPHandlers(context: DACPHandlerContext): void {
  const resolvedContext = {
    ...context,
    instanceId: resolveCleanupInstanceId(context),
  }
  const { instanceId, getState, setState, logger } = resolvedContext

  if (!instanceHasCleanupWork(getState(), instanceId)) {
    logger.debug("Skipping cleanup for already-removed instance", { instanceId })
    return
  }

  logger.info("Cleaning up DACP handlers for instance", { instanceId })

  // Cancel any pending intents involving this instance (as source or target)
  const state = getState()
  const pendingIntents = Object.values(state.intents.pending).filter(
    p => p.targetInstanceId === instanceId || p.sourceInstanceId === instanceId
  )
  pendingIntents.forEach(pending => {
    // Reject promise if it exists (from intent-helpers Map)
    const promiseData = resolvedContext.pendingIntentPromises.get(pending.requestId)
    if (promiseData) {
      if (promiseData.timeoutHandle) {
        clearTimeout(promiseData.timeoutHandle)
      }
      if (promiseData.deliveryTimeoutHandle) {
        clearTimeout(promiseData.deliveryTimeoutHandle)
      }
      const disconnectRole = pending.sourceInstanceId === instanceId ? "source" : "target"
      promiseData.reject(new Error(`Intent cancelled - ${disconnectRole} instance disconnected`))
      resolvedContext.pendingIntentPromises.delete(pending.requestId)
    }
    setState(state => resolvePendingIntent(state, pending.requestId))
  })
  if (pendingIntents.length > 0) {
    logger.info(`Cancelled ${pendingIntents.length} pending intents for disconnected instance`, {
      instanceId,
    })
  }

  clearPendingOpenWithContextForInstance(instanceId, resolvedContext)
  clearPendingOpenWithContextForSourceInstance(instanceId, resolvedContext)

  // Remove event listeners
  eventHandlers.removeInstanceEventListeners(instanceId, setState)
  logger.info("Removed event listeners for disconnected instance", { instanceId })

  // Remove private channels
  const removedPrivateChannels =
    privateChannelHandlers.removeInstancePrivateChannels(resolvedContext)
  if (removedPrivateChannels > 0) {
    logger.info(`Removed ${removedPrivateChannels} private channels for disconnected instance`, {
      instanceId,
    })
  }

  // Stop heartbeat
  stopHeartbeat(instanceId, setState)

  // Remove intent listeners
  setState(state => removeListenersForInstance(state, instanceId))

  // Remove instance from state
  setState(state => removeInstance(state, instanceId))

  pruneInstanceIdentity(resolvedContext.transport, instanceId)

  notifyBrowserEdgeInstanceDisconnected(resolvedContext.transport, instanceId)

  logger.info("DACP handlers cleanup completed", { instanceId })
}
