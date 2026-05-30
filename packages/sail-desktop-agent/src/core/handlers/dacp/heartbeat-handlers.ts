import { createDACPEvent } from "../../dacp-protocol/dacp-message-creators"
import { generateEventUuid } from "../../dacp-protocol/dacp-utils"
import { type DACPHandlerContext } from "../types"
import type { BrowserTypes } from "@finos/fdc3"
import { getHeartbeatState } from "../../state/selectors"
import {
  startHeartbeat as startHeartbeatTransform,
  acknowledgeHeartbeat,
  updateHeartbeatSent,
} from "../../state/mutators"
import { cleanupDACPHandlers } from "./cleanup"
import {
  stopHeartbeat,
  setHeartbeatTimer,
  clearHeartbeatTimer,
  linkWcpTempInstanceId,
} from "./heartbeat-runtime"

/** Re-export for callers that imported `stopHeartbeat` from this module. */
export { stopHeartbeat } from "./heartbeat-runtime"

/**
 * Start heartbeat for an instance
 * Called when an instance connects
 */
export function startHeartbeat(instanceId: string, context: DACPHandlerContext): void {
  const { transport, getState, setState, logger } = context
  const heartbeatIntervalMs = context.heartbeatIntervalMs
  const heartbeatTimeoutMs = context.heartbeatTimeoutMs

  // Stop any existing heartbeat
  stopHeartbeat(instanceId, setState)

  if (context.instanceId.startsWith("temp-") && context.instanceId !== instanceId) {
    linkWcpTempInstanceId(context.instanceId, instanceId)
  }

  // Initialize heartbeat state
  setState(state => startHeartbeatTransform(state, instanceId))

  const sendHeartbeat = () => {
    const heartbeatEvent = createDACPEvent("heartbeatEvent", {
      eventId: generateEventUuid(),
    })

    // Add routing metadata
    const heartbeatEventWithRouting = {
      ...heartbeatEvent,
      meta: {
        ...heartbeatEvent.meta,
        destination: { instanceId },
      },
    }

    transport.send(heartbeatEventWithRouting)

    // Update heartbeat sent timestamp
    setState(state => updateHeartbeatSent(state, instanceId))
  }

  const onTimeout = () => {
    logger.warn("Instance failed heartbeat check, removing", { instanceId })
    // WCP4 validation runs under a temp connection context; heartbeat is keyed by the real instanceId.
    cleanupDACPHandlers({ ...context, instanceId })
  }

  // Send an initial heartbeat immediately for short test intervals.
  if (heartbeatIntervalMs <= 1000) {
    sendHeartbeat()
  }

  // Set up periodic heartbeat
  const intervalHandle = setInterval(() => {
    const state = getState()
    const heartbeat = getHeartbeatState(state, instanceId)
    if (!heartbeat) {
      clearHeartbeatTimer(instanceId)
      return
    }

    const now = Date.now()
    const timeSinceLastAck = now - heartbeat.lastAcknowledgmentReceived

    // Check if instance has timed out
    if (timeSinceLastAck > heartbeatTimeoutMs) {
      logger.warn("Instance heartbeat timeout", {
        instanceId,
        timeSinceLastAck,
        missedHeartbeats: heartbeat.missedHeartbeats,
      })
      clearHeartbeatTimer(instanceId)
      onTimeout()
      return
    }

    // Send heartbeat
    sendHeartbeat()

    logger.debug("Heartbeat sent", {
      instanceId,
      missedHeartbeats: heartbeat.missedHeartbeats,
    })
  }, heartbeatIntervalMs)

  setHeartbeatTimer(instanceId, intervalHandle)
  logger.info("Heartbeat started for instance", { instanceId })
}

/**
 * Handle heartbeatAcknowledgmentRequest
 */
export function handleHeartbeatAcknowledgmentRequest(
  _message: BrowserTypes.HeartbeatAcknowledgementRequest,
  context: DACPHandlerContext
): void {
  const { instanceId, setState, logger } = context

  try {
    // Record acknowledgment (message is pre-validated by router)
    setState(state => acknowledgeHeartbeat(state, instanceId))

    logger.debug("Heartbeat acknowledgment received", { instanceId })
  } catch (error) {
    logger.error("Invalid heartbeat acknowledgment", {
      instanceId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
