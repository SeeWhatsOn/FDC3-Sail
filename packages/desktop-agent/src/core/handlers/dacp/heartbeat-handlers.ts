import { createDACPEvent, generateEventUuid } from "../../protocol/dacp-utilities"
import { type DACPHandlerContext, type DACPMessage } from "../types"
import { getHeartbeatState } from "../../state/selectors"
import {
  startHeartbeat as startHeartbeatTransform,
  acknowledgeHeartbeat,
  updateHeartbeatSent,
  stopHeartbeat as stopHeartbeatTransform,
  removeInstance,
} from "../../state/transforms"

/**
 * Heartbeat configuration
 */
const HEARTBEAT_INTERVAL = 30000 // 30 seconds
const HEARTBEAT_TIMEOUT = 60000 // 60 seconds (2 missed heartbeats)

/**
 * Map of instanceId -> interval handle
 * Interval handles are runtime state, not part of persistent state
 */
const heartbeatIntervals = new Map<string, NodeJS.Timeout>()

/**
 * Start heartbeat for an instance
 * Called when an instance connects
 */
export function startHeartbeat(instanceId: string, context: DACPHandlerContext): void {
  const { transport, getState, setState, logger } = context

  // Stop any existing heartbeat
  stopHeartbeat(instanceId, setState)

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
    // Remove instance using state transform
    setState(state => removeInstance(state, instanceId))
    stopHeartbeat(instanceId, setState)
  }

  // Set up periodic heartbeat
  const intervalHandle = setInterval(() => {
    const state = getState()
    const heartbeat = getHeartbeatState(state, instanceId)
    if (!heartbeat) {
      clearInterval(intervalHandle)
      heartbeatIntervals.delete(instanceId)
      return
    }

    const now = Date.now()
    const timeSinceLastAck = now - heartbeat.lastAcknowledgmentReceived

    // Check if instance has timed out
    if (timeSinceLastAck > HEARTBEAT_TIMEOUT) {
      logger.warn("Instance heartbeat timeout", {
        instanceId,
        timeSinceLastAck,
        missedHeartbeats: heartbeat.missedHeartbeats,
      })
      clearInterval(intervalHandle)
      heartbeatIntervals.delete(instanceId)
      onTimeout()
      return
    }

    // Send heartbeat
    sendHeartbeat()

    logger.debug("Heartbeat sent", {
      instanceId,
      missedHeartbeats: heartbeat.missedHeartbeats,
    })
  }, HEARTBEAT_INTERVAL)

  heartbeatIntervals.set(instanceId, intervalHandle)
  logger.info("Heartbeat started for instance", { instanceId })
}

/**
 * Handle heartbeatAcknowledgmentRequest
 */
export function handleHeartbeatAcknowledgmentRequest(
  _message: DACPMessage,
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

/**
 * Stop heartbeat for an instance
 * Called when an instance disconnects
 */
export function stopHeartbeat(instanceId: string, setState: (fn: (state: import("../../state/types").AgentState) => import("../../state/types").AgentState) => void): void {
  // Clear interval
  const intervalHandle = heartbeatIntervals.get(instanceId)
  if (intervalHandle) {
    clearInterval(intervalHandle)
    heartbeatIntervals.delete(instanceId)
  }

  // Remove from state
  setState(state => stopHeartbeatTransform(state, instanceId))
}

/**
 * Stop all heartbeats (for testing/shutdown)
 */
export function stopAllHeartbeats(setState: (fn: (state: import("../../state/types").AgentState) => import("../../state/types").AgentState) => void): void {
  for (const instanceId of heartbeatIntervals.keys()) {
    stopHeartbeat(instanceId, setState)
  }
}
