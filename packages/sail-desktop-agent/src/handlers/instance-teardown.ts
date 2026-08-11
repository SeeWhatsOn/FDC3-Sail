import { ResultError } from "@finos/fdc3"
import { createDACPErrorResponse } from "../dacp/dacp-message-creators"
import { resolvePendingIntent, removeListenersForInstance, removeInstance } from "../state/mutators"
import { type DACPHandlerContext } from "./types"
import * as eventHandlers from "./events/handlers"
import * as privateChannelHandlers from "./private-channels/handlers"
import { resolveLinkedInstanceId } from "../state/selectors/wcp-handshake-routing"
import { clearHandshakeRoutingIdsForInstance } from "../state/mutators/wcp-handshake-routing"
import { getActiveHeartbeatInstanceIds, stopHeartbeat } from "./heartbeat/runtime"
import {
  clearPendingOpenWithContextForInstance,
  clearPendingOpenWithContextForSourceInstance,
} from "./utils/open-with-context"
import { sendDACPResponse } from "./utils/dacp-response-utils"
import { pruneInstanceIdentity } from "../app-connection/wcp/instance-identity-registry"
import type { AgentState } from "../state/types"
import { clearPendingIntentTimeoutHandle } from "./intents/intent-pending-timeout-registry"

/**
 * WCP4 validation runs under a temp connection id while heartbeat and instance state
 * use the validated WCP5 instanceId (see wcp-handlers startHeartbeat call).
 */
function resolveTeardownInstanceId(context: DACPHandlerContext): string {
  const { instanceId, getState } = context
  const state = getState()

  if (state.heartbeats[instanceId] || getActiveHeartbeatInstanceIds().includes(instanceId)) {
    return instanceId
  }

  if (instanceId.startsWith("temp-")) {
    const linkedInstanceId = resolveLinkedInstanceId(state, instanceId)
    if (
      linkedInstanceId &&
      (state.heartbeats[linkedInstanceId] ||
        getActiveHeartbeatInstanceIds().includes(linkedInstanceId) ||
        state.instances[linkedInstanceId])
    ) {
      return linkedInstanceId
    }
  }

  return instanceId
}

function instanceHasTeardownWork(state: AgentState, instanceId: string): boolean {
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
    pending => pending.targetInstanceId === instanceId || pending.sourceInstanceId === instanceId,
  )
}

/**
 * Tear down DACP-owned agent state for a disconnected instance (WCP6Goodbye, heartbeat
 * timeout, or `disconnectInstance`). Peer entry point to `routeDACPMessage` — not a router
 * helper. Kept in a leaf module so callers do not import the DACP router `index.ts`,
 * avoiding circular module graphs.
 */
export function cleanupInstanceDacpState(context: DACPHandlerContext): void {
  const resolvedContext = {
    ...context,
    instanceId: resolveTeardownInstanceId(context),
  }
  const { instanceId, getState, setState, logger } = resolvedContext

  if (!instanceHasTeardownWork(getState(), instanceId)) {
    logger.debug("Skipping teardown for already-removed instance", { instanceId })
    return
  }

  logger.info("Tearing down DACP state for instance", { instanceId })

  // Cancel any pending intents involving this instance (as source or target)
  const state = getState()
  const pendingIntents = Object.values(state.intents.pending).filter(
    p => p.targetInstanceId === instanceId || p.sourceInstanceId === instanceId,
  )
  pendingIntents.forEach(pending => {
    // Reject promise if it exists (from intent-helpers Map)
    const promiseData = resolvedContext.pendingIntentPromises.get(pending.requestId)
    if (promiseData) {
      clearPendingIntentTimeoutHandle(promiseData.timeoutHandle)
      clearPendingIntentTimeoutHandle(promiseData.deliveryTimeoutHandle)
      const disconnectRole = pending.sourceInstanceId === instanceId ? "source" : "target"
      promiseData.reject(new Error(`Intent cancelled - ${disconnectRole} instance disconnected`))
      resolvedContext.pendingIntentPromises.delete(pending.requestId)
    }
    // Terminal raiseIntentResultResponse so IntentResolution.getResult() settles (same as
    // open-with-context AppTimeout on disconnect). Only when the *target* is the one going away:
    // the response is addressed to the raiser, so if the raiser is itself the disconnecting
    // instance there is nobody left to settle and this would post to a closed instance.
    if (pending.sourceInstanceId !== instanceId) {
      try {
        const response = createDACPErrorResponse(
          { type: "raiseIntentRequest", meta: { requestUuid: pending.requestId } },
          ResultError.ApiTimeout,
          "raiseIntentResultResponse",
        )
        sendDACPResponse({
          response,
          instanceId: pending.sourceInstanceId,
          responses: resolvedContext.responses,
        })
      } catch (error) {
        logger.warn("Failed to send pending-intent timeout response on disconnect", {
          requestId: pending.requestId,
          sourceInstanceId: pending.sourceInstanceId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
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

  setState(state => clearHandshakeRoutingIdsForInstance(state, instanceId))

  // Remove intent listeners
  setState(state => removeListenersForInstance(state, instanceId))

  // Remove instance from state
  setState(state => removeInstance(state, instanceId))

  pruneInstanceIdentity(resolvedContext.responses.connectionOwner, instanceId)

  logger.info("DACP instance teardown completed", { instanceId })
}

/**
 * Unified instance teardown when available; DACP-only state cleanup for headless ingest tests.
 */
export function teardownInstance(context: DACPHandlerContext, instanceId: string): void {
  if (context.disconnectInstance) {
    context.disconnectInstance(instanceId)
    return
  }
  cleanupInstanceDacpState({ ...context, instanceId })
}
