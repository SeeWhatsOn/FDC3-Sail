import { createDACPSuccessResponse } from "../../dacp-protocol/dacp-message-creators"
import { generateEventUuid } from "../../dacp-protocol/dacp-utils"
import { type DACPHandlerContext } from "../types"
import { sendDACPResponse, sendDACPErrorResponse } from "./utils/dacp-response-utils"
import type { BrowserTypes } from "@finos/fdc3"
import { ChannelError } from "@finos/fdc3"
import { FDC3ChannelError } from "../../errors/fdc3-errors"
import { getInstance, getEventListenersForType } from "../../state/selectors"
import { addEventListener, removeEventListener, removeEventListenersForInstance } from "../../state/mutators"
import type { AgentState } from "../../state/types"

/**
 * Handles addEventListenerRequest for DA-level events
 */
export function handleAddEventListenerRequest(
  message: BrowserTypes.AddEventListenerRequest,
  context: DACPHandlerContext
): void {
  const { transport, instanceId, getState, setState, logger } = context

  try {
    const instance = getInstance(getState(), instanceId)

    if (!instance) {
      throw new Error(`Instance ${instanceId} not found for adding event listener`)
    }

    const { type: eventType } = message.payload
    if (!eventType) {
      throw new Error("Event type is required")
    }

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
    
    // Extract FDC3 error type from error instance
    let errorType: ChannelError = ChannelError.ApiTimeout
    const errorMessage = error instanceof Error ? error.message : "Failed to add event listener"
    
    if (error instanceof FDC3ChannelError) {
      errorType = error.errorType
    } else if (errorMessage.includes("Access denied") || errorMessage.includes("denied")) {
      errorType = ChannelError.AccessDenied
    }

    sendDACPErrorResponse({
      message,
      errorType,
      errorMessage,
      instanceId,
      transport,
    })
  }
}

/**
 * Handles eventListenerUnsubscribeRequest
 */
export function handleEventListenerUnsubscribeRequest(
  message: BrowserTypes.EventListenerUnsubscribeRequest,
  context: DACPHandlerContext
): void {
  const { transport, instanceId, getState, setState, logger } = context

  try {
    const { listenerUUID } = message.payload

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
    
    // Extract FDC3 error type from error instance
    let errorType: ChannelError = ChannelError.ApiTimeout
    const errorMessage = error instanceof Error ? error.message : "Failed to unsubscribe event listener"
    
    if (error instanceof FDC3ChannelError) {
      errorType = error.errorType
    } else if (errorMessage.includes("Access denied") || errorMessage.includes("denied")) {
      errorType = ChannelError.AccessDenied
    }

    sendDACPErrorResponse({
      message,
      errorType,
      errorMessage,
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
