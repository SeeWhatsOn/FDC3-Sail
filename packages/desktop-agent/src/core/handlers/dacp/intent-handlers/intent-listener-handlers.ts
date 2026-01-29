/**
 * Intent Listener Handlers
 *
 * Handlers for adding and removing intent listeners
 */

import { createDACPSuccessResponse } from "../../../dacp-protocol/dacp-message-creators"
import { generateEventUuid } from "../../../dacp-protocol/dacp-utils"
import { type DACPHandlerContext } from "../../types"
import { sendDACPResponse, sendDACPErrorResponse } from "../utils/dacp-response-utils"
import type { BrowserTypes } from "@finos/fdc3"
import { ResolveError } from "@finos/fdc3"
import { getInstance } from "../../../state/selectors"
import { registerIntentListener, unregisterIntentListener } from "../../../state/mutators"
import { deliverPendingIntentsForListener } from "./intent-delivery-helpers"

export function handleAddIntentListener(
  message: BrowserTypes.AddIntentListenerRequest,
  context: DACPHandlerContext
): void {
  const { transport, instanceId, getState, setState, logger } = context

  try {
    const payload = message.payload
    const instance = getInstance(getState(), instanceId)

    if (!instance) {
      throw new Error(`Instance ${instanceId} not found for adding intent listener`)
    }

    const listenerId = generateEventUuid()

    setState(state =>
      registerIntentListener(state, {
        listenerId,
        intentName: payload.intent,
        instanceId,
        appId: instance.appId,
        contextTypes: [],
      })
    )

    const response = createDACPSuccessResponse(message, "addIntentListenerResponse", {
      listenerUUID: listenerId,
    })

    sendDACPResponse({ response, instanceId, transport })

    deliverPendingIntentsForListener(context, payload.intent)
  } catch (error) {
    logger.error("DACP: Add intent listener failed", error)

    // Use ResolveError for intent listener errors (AddIntentListenerResponse validates ResolveError enum values)
    let errorType: ResolveError = ResolveError.ApiTimeout
    const errorMessage = error instanceof Error ? error.message : "Failed to add intent listener"

    // Intent listener errors typically map to ApiTimeout or other ResolveError values
    if (errorMessage.includes("not found") || errorMessage.includes("does not exist")) {
      errorType = ResolveError.TargetInstanceUnavailable
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

export function handleIntentListenerUnsubscribe(
  message: BrowserTypes.IntentListenerUnsubscribeRequest,
  context: DACPHandlerContext
): void {
  const { transport, instanceId, getState, setState, logger } = context

  try {
    const { listenerUUID } = message.payload

    // Check if listener exists before removing
    const state = getState()
    const listener = state.intents.listeners[listenerUUID]
    if (!listener) {
      throw new Error(`Intent listener ${listenerUUID} not found`)
    }

    setState(state => unregisterIntentListener(state, listenerUUID))

    const response = createDACPSuccessResponse(message, "intentListenerUnsubscribeResponse")
    sendDACPResponse({ response, instanceId, transport })
  } catch (error) {
    logger.error("DACP: Intent listener unsubscribe failed", error)

    // Use ResolveError for intent listener errors
    let errorType: ResolveError = ResolveError.ApiTimeout
    const errorMessage =
      error instanceof Error ? error.message : "Failed to unsubscribe intent listener"

    if (errorMessage.includes("not found") || errorMessage.includes("does not exist")) {
      errorType = ResolveError.TargetInstanceUnavailable
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
