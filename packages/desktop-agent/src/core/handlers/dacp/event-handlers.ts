import {
  createDACPSuccessResponse,
  DACP_ERROR_TYPES,
  generateEventUuid,
} from "../../protocol/dacp-utilities"
import { type DACPHandlerContext, type DACPMessage } from "../types"
import { sendDACPResponse, sendDACPErrorResponse } from "./utils/dacp-response-utils"
import { getInstance, getEventListenersForType } from "../../state/selectors"
import { addEventListener, removeEventListener, removeEventListenersForInstance } from "../../state/transforms"
import type { AgentState } from "../../state/types"

/**
 * Handles addEventListenerRequest for DA-level events
 */
export function handleAddEventListenerRequest(message: DACPMessage, context: DACPHandlerContext): void {
  const { transport, instanceId, getState, setState, logger } = context

  try {
    const instance = getInstance(getState(), instanceId)

    if (!instance) {
      throw new Error(`Instance ${instanceId} not found for adding event listener`)
    }

    const payload = message.payload as { type: string }
    const eventType = payload.type

    // Validate event type
    // FDC3 2.2 supports USER_CHANNEL_CHANGED event type
    // We also support "channelChanged" as an alias for compatibility
    const validEventTypes = ["channelChanged", "USER_CHANNEL_CHANGED"]
    if (!validEventTypes.includes(eventType)) {
      throw new Error(`Unsupported event type: ${eventType}`)
    }

    // Normalize event type: USER_CHANNEL_CHANGED -> channelChanged
    // This ensures listeners registered with either name receive the same events
    const normalizedEventType = eventType === "USER_CHANNEL_CHANGED" ? "channelChanged" : eventType

    const listenerId = generateEventUuid()

    setState(state =>
      addEventListener(state, {
        listenerId,
        instanceId,
        eventType: normalizedEventType,
      })
    )

    // FDC3 spec requires listenerUUID (not listenerId) in the response payload
    const response = createDACPSuccessResponse(message, "addEventListenerResponse", {
      listenerUUID: listenerId,
    })

    sendDACPResponse({ response, instanceId, transport })

    logger.info("DACP: Event listener added", { instanceId, eventType, listenerId })
  } catch (error) {
    logger.error("DACP: Add event listener failed", error)
    sendDACPErrorResponse({
      message,
      errorType: DACP_ERROR_TYPES.LISTENER_ERROR,
      errorMessage: error instanceof Error ? error.message : "Failed to add event listener",
      instanceId,
      transport,
    })
  }
}

/**
 * Handles eventListenerUnsubscribeRequest
 */
export function handleEventListenerUnsubscribeRequest(
  message: DACPMessage,
  context: DACPHandlerContext
): void {
  const { transport, instanceId, getState, setState, logger } = context

  try {
    const listenerUUID = (message.payload as { listenerUUID: string }).listenerUUID

    // Check if listener exists before removing
    const listener = getState().events.listeners[listenerUUID]
    if (!listener) {
      throw new Error(`Event listener ${listenerUUID} not found`)
    }

    setState(state => removeEventListener(state, listenerUUID))

    const response = createDACPSuccessResponse(message, "eventListenerUnsubscribeResponse")

    sendDACPResponse({ response, instanceId, transport })

    logger.info("DACP: Event listener unsubscribed", { instanceId, listenerUUID })
  } catch (error) {
    logger.error("DACP: Event listener unsubscribe failed", error)
    sendDACPErrorResponse({
      message,
      errorType: DACP_ERROR_TYPES.LISTENER_ERROR,
      errorMessage: error instanceof Error ? error.message : "Failed to unsubscribe event listener",
      instanceId,
      transport,
    })
  }
}

/**
 * Get listeners for an event type (exported for use by other handlers)
 * Note: This function now requires state to be passed in
 */
export function getEventListeners(
  eventType: string,
  getState: () => AgentState
): string[] {
  return getEventListenersForType(getState(), eventType)
}

/**
 * Remove all event listeners for an instance (called on disconnect)
 */
export function removeInstanceEventListeners(
  instanceId: string,
  setState: (fn: (state: AgentState) => AgentState) => void
): void {
  setState(state => removeEventListenersForInstance(state, instanceId))
}
