import {
  validateDACPMessage,
  createDACPErrorResponse,
  createDACPSuccessResponse,
  DACP_ERROR_TYPES,
  generateEventUuid,
} from "../validation/dacp-validator"
import {
  AddEventListenerRequestSchema,
  EventListenerUnsubscribeRequestSchema,
} from "../validation/dacp-schemas"
import { type DACPHandlerContext, logger } from "../types"

/**
 * Desktop Agent Event Listener Registry
 * Tracks which apps are subscribed to which DA-level events
 */
class EventListenerRegistry {
  // Map of eventType -> Set of instanceIds
  private listeners = new Map<string, Set<string>>()

  // Map of listenerId -> { instanceId, eventType }
  private listenerDetails = new Map<string, { instanceId: string; eventType: string }>()

  /**
   * Register an event listener
   */
  register(listenerId: string, instanceId: string, eventType: string): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set())
    }
    this.listeners.get(eventType)!.add(instanceId)
    this.listenerDetails.set(listenerId, { instanceId, eventType })

    logger.debug("Event listener registered", { listenerId, instanceId, eventType })
  }

  /**
   * Unregister an event listener
   */
  unregister(listenerId: string): boolean {
    const details = this.listenerDetails.get(listenerId)
    if (!details) {
      return false
    }

    const { instanceId, eventType } = details
    const listeners = this.listeners.get(eventType)
    if (listeners) {
      listeners.delete(instanceId)
      if (listeners.size === 0) {
        this.listeners.delete(eventType)
      }
    }

    this.listenerDetails.delete(listenerId)
    logger.debug("Event listener unregistered", { listenerId, instanceId, eventType })
    return true
  }

  /**
   * Get all instances subscribed to an event type
   */
  getListeners(eventType: string): Set<string> {
    return this.listeners.get(eventType) || new Set()
  }

  /**
   * Remove all listeners for an instance (on disconnect)
   */
  removeInstanceListeners(instanceId: string): number {
    let count = 0
    for (const [listenerId, details] of this.listenerDetails.entries()) {
      if (details.instanceId === instanceId) {
        this.unregister(listenerId)
        count++
      }
    }
    return count
  }

  /**
   * Clear all listeners (for testing)
   */
  clear(): void {
    this.listeners.clear()
    this.listenerDetails.clear()
  }
}

// Singleton instance
const eventListenerRegistry = new EventListenerRegistry()

/**
 * Handles addEventListenerRequest for DA-level events
 */
export function handleAddEventListenerRequest(
  message: unknown,
  context: DACPHandlerContext
): void {
  const { transport, instanceId, appInstanceRegistry } = context

  try {
    const request = validateDACPMessage(message, AddEventListenerRequestSchema)
    const instance = appInstanceRegistry.getInstance(instanceId)

    if (!instance) {
      throw new Error(`Instance ${instanceId} not found for adding event listener`)
    }

    const payload = request.payload as { type: string }
    const eventType = payload.type

    // Validate event type
    const validEventTypes = ["channelChanged"]
    if (!validEventTypes.includes(eventType)) {
      throw new Error(`Unsupported event type: ${eventType}`)
    }

    const listenerId = generateEventUuid()

    eventListenerRegistry.register(listenerId, instanceId, eventType)

    const response = createDACPSuccessResponse(request, "addEventListenerResponse", {
      listenerId,
    })

    transport.send(instanceId, response)

    logger.info("DACP: Event listener added", { instanceId, eventType, listenerId })
  } catch (error) {
    logger.error("DACP: Add event listener failed", error)
    const errorResponse = createDACPErrorResponse(
      message as { meta: { requestUuid: string } },
      DACP_ERROR_TYPES.LISTENER_ERROR,
      "addEventListenerResponse",
      error instanceof Error ? error.message : "Failed to add event listener"
    )
    transport.send(instanceId, errorResponse)
  }
}

/**
 * Handles eventListenerUnsubscribeRequest
 */
export function handleEventListenerUnsubscribeRequest(
  message: unknown,
  context: DACPHandlerContext
): void {
  const { transport, instanceId } = context

  try {
    const request = validateDACPMessage(message, EventListenerUnsubscribeRequestSchema)
    const listenerUUID = request.payload.listenerUUID

    const unregistered = eventListenerRegistry.unregister(listenerUUID)
    if (!unregistered) {
      throw new Error(`Event listener ${listenerUUID} not found`)
    }

    const response = createDACPSuccessResponse(request, "eventListenerUnsubscribeResponse")
    transport.send(instanceId, response)

    logger.info("DACP: Event listener unsubscribed", { instanceId, listenerUUID })
  } catch (error) {
    logger.error("DACP: Event listener unsubscribe failed", error)
    const errorResponse = createDACPErrorResponse(
      message as { meta: { requestUuid: string } },
      DACP_ERROR_TYPES.LISTENER_ERROR,
      "eventListenerUnsubscribeResponse",
      error instanceof Error ? error.message : "Failed to unsubscribe event listener"
    )
    transport.send(instanceId, errorResponse)
  }
}

/**
 * Get listeners for an event type (exported for use by other handlers)
 */
export function getEventListeners(eventType: string): Set<string> {
  return eventListenerRegistry.getListeners(eventType)
}

/**
 * Remove all event listeners for an instance (called on disconnect)
 */
export function removeInstanceEventListeners(instanceId: string): number {
  return eventListenerRegistry.removeInstanceListeners(instanceId)
}

/**
 * Clear all event listeners (for testing)
 */
export function clearEventListeners(): void {
  eventListenerRegistry.clear()
}
