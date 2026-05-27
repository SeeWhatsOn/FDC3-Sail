import {
  resolvePendingIntent,
  removeListenersForInstance,
  removeInstance,
} from "../../state/mutators"
import { type DACPHandlerContext } from "../types"
import * as eventHandlers from "./event-handlers"
import * as privateChannelHandlers from "./private-channel-handlers"
import { stopHeartbeat } from "./heartbeat-runtime"
import { clearPendingOpenWithContextForInstance } from "./utils/open-with-context"

/**
 * Cleanup when a DACP connection is closed, heartbeat times out, or the app sends WCP6Goodbye.
 * Kept in a leaf module so callers (heartbeat-handlers, wcp-handlers, desktop-agent) do not
 * import the DACP router `index.ts`, avoiding circular module graphs.
 */
export function cleanupDACPHandlers(context: DACPHandlerContext): void {
  const { instanceId, getState, setState, logger } = context

  logger.info("Cleaning up DACP handlers for instance", { instanceId })

  // Cancel any pending intents involving this instance (as source or target)
  const state = getState()
  const pendingIntents = Object.values(state.intents.pending).filter(
    p => p.targetInstanceId === instanceId || p.sourceInstanceId === instanceId
  )
  pendingIntents.forEach(pending => {
    // Reject promise if it exists (from intent-helpers Map)
    const promiseData = context.pendingIntentPromises.get(pending.requestId)
    if (promiseData) {
      if (promiseData.timeoutHandle) {
        clearTimeout(promiseData.timeoutHandle)
      }
      if (promiseData.deliveryTimeoutHandle) {
        clearTimeout(promiseData.deliveryTimeoutHandle)
      }
      const disconnectRole =
        pending.sourceInstanceId === instanceId ? "source" : "target"
      promiseData.reject(
        new Error(`Intent cancelled - ${disconnectRole} instance disconnected`)
      )
      context.pendingIntentPromises.delete(pending.requestId)
    }
    setState(state => resolvePendingIntent(state, pending.requestId))
  })
  if (pendingIntents.length > 0) {
    logger.info(`Cancelled ${pendingIntents.length} pending intents for disconnected instance`, {
      instanceId,
    })
  }

  clearPendingOpenWithContextForInstance(instanceId, context)

  // Remove event listeners
  eventHandlers.removeInstanceEventListeners(instanceId, setState)
  logger.info("Removed event listeners for disconnected instance", { instanceId })

  // Remove private channels
  const removedPrivateChannels = privateChannelHandlers.removeInstancePrivateChannels(context)
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

  logger.info("DACP handlers cleanup completed", { instanceId })
}
