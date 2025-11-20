import {
  validateDACPMessage,
  createDACPEvent,
  generateEventUuid,
} from "../validation/dacp-validator"
import { HeartbeatAcknowledgmentRequestSchema } from "../validation/dacp-schemas"
import { type DACPHandlerContext, logger } from "../types"

/**
 * Heartbeat configuration
 */
const HEARTBEAT_INTERVAL = 30000 // 30 seconds
const HEARTBEAT_TIMEOUT = 60000 // 60 seconds (2 missed heartbeats)

/**
 * Tracks heartbeat state for instances
 */
interface HeartbeatState {
  lastHeartbeatSent: number
  lastAcknowledgmentReceived: number
  intervalHandle?: NodeJS.Timeout
  missedHeartbeats: number
}

/**
 * Heartbeat registry - tracks heartbeat state per instance
 */
class HeartbeatRegistry {
  private heartbeats = new Map<string, HeartbeatState>()

  /**
   * Start heartbeat for an instance
   */
  start(instanceId: string, sendHeartbeat: () => void, onTimeout: () => void): void {
    // Clear any existing heartbeat
    this.stop(instanceId)

    const state: HeartbeatState = {
      lastHeartbeatSent: Date.now(),
      lastAcknowledgmentReceived: Date.now(),
      missedHeartbeats: 0,
    }

    // Set up periodic heartbeat
    state.intervalHandle = setInterval(() => {
      const now = Date.now()
      const timeSinceLastAck = now - state.lastAcknowledgmentReceived

      // Check if instance has timed out
      if (timeSinceLastAck > HEARTBEAT_TIMEOUT) {
        logger.warn("Instance heartbeat timeout", {
          instanceId,
          timeSinceLastAck,
          missedHeartbeats: state.missedHeartbeats,
        })
        this.stop(instanceId)
        onTimeout()
        return
      }

      // Send heartbeat
      sendHeartbeat()
      state.lastHeartbeatSent = now
      state.missedHeartbeats++

      logger.debug("Heartbeat sent", {
        instanceId,
        missedHeartbeats: state.missedHeartbeats,
      })
    }, HEARTBEAT_INTERVAL)

    this.heartbeats.set(instanceId, state)

    logger.info("Heartbeat started for instance", { instanceId })
  }

  /**
   * Record acknowledgment received
   */
  acknowledge(instanceId: string): void {
    const state = this.heartbeats.get(instanceId)
    if (state) {
      state.lastAcknowledgmentReceived = Date.now()
      state.missedHeartbeats = 0
      logger.debug("Heartbeat acknowledged", { instanceId })
    }
  }

  /**
   * Stop heartbeat for an instance
   */
  stop(instanceId: string): void {
    const state = this.heartbeats.get(instanceId)
    if (state?.intervalHandle) {
      clearInterval(state.intervalHandle)
      this.heartbeats.delete(instanceId)
      logger.info("Heartbeat stopped for instance", { instanceId })
    }
  }

  /**
   * Get heartbeat state for an instance
   */
  getState(instanceId: string): HeartbeatState | undefined {
    return this.heartbeats.get(instanceId)
  }

  /**
   * Stop all heartbeats
   */
  stopAll(): void {
    for (const instanceId of this.heartbeats.keys()) {
      this.stop(instanceId)
    }
  }
}

// Singleton instance
const heartbeatRegistry = new HeartbeatRegistry()

/**
 * Start heartbeat for an instance
 * Called when an instance connects
 */
export function startHeartbeat(instanceId: string, context: DACPHandlerContext): void {
  const { transport, appInstanceRegistry } = context

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
  }

  const onTimeout = () => {
    logger.warn("Instance failed heartbeat check, removing", { instanceId })
    // Remove instance from registry
    appInstanceRegistry.removeInstance(instanceId)
  }

  heartbeatRegistry.start(instanceId, sendHeartbeat, onTimeout)
}

/**
 * Handle heartbeatAcknowledgmentRequest
 */
export function handleHeartbeatAcknowledgmentRequest(
  message: unknown,
  context: DACPHandlerContext
): void {
  const { instanceId } = context

  try {
    validateDACPMessage(message, HeartbeatAcknowledgmentRequestSchema)

    // Record acknowledgment
    heartbeatRegistry.acknowledge(instanceId)

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
export function stopHeartbeat(instanceId: string): void {
  heartbeatRegistry.stop(instanceId)
}

/**
 * Stop all heartbeats (for testing/shutdown)
 */
export function stopAllHeartbeats(): void {
  heartbeatRegistry.stopAll()
}

/**
 * Get heartbeat state (for testing/monitoring)
 */
export function getHeartbeatState(instanceId: string): HeartbeatState | undefined {
  return heartbeatRegistry.getState(instanceId)
}
