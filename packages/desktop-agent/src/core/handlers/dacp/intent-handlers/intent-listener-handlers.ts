/**
 * Intent Listener Handlers
 *
 * Handlers for adding and removing intent listeners
 */

import { createDACPSuccessResponse } from "../../../dacp-protocol/dacp-message-creators"
import { generateEventUuid } from "../../../dacp-protocol/dacp-utils"
import { DACP_ERROR_TYPES } from "../../../dacp-protocol/dacp-constants"
import { type DACPHandlerContext, type DACPMessage } from "../../types"
import { sendDACPResponse, sendDACPErrorResponse } from "../utils/dacp-response-utils"
import { getInstance } from "../../../state/selectors"
import {
  registerIntentListener,
  unregisterIntentListener,
} from "../../../state/mutators"

export function handleAddIntentListener(message: DACPMessage, context: DACPHandlerContext): void {
  const { transport, instanceId, getState, setState, logger } = context

  try {
    const payload = message.payload as { intent: string; contextTypes?: string[] }
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
        contextTypes: payload.contextTypes ?? [],
      })
    )

    // FDC3 spec requires listenerUUID (not listenerId) in the response payload
    //TODO: change the var to match the spec - listenerId -> listenerUUID
    const response = createDACPSuccessResponse(message, "addIntentListenerResponse", {
      listenerUUID: listenerId,
    })

    sendDACPResponse({ response, instanceId, transport })
  } catch (error) {
    logger.error("DACP: Add intent listener failed", error)
    sendDACPErrorResponse({
      message,
      errorType: DACP_ERROR_TYPES.LISTENER_ERROR,
      errorMessage: error instanceof Error ? error.message : "Failed to add intent listener",
      instanceId,
      transport,
    })
  }
}

export function handleIntentListenerUnsubscribe(
  message: DACPMessage,
  context: DACPHandlerContext
): void {
  const { transport, instanceId, getState, setState, logger } = context

  try {
    const listenerUUID = (message.payload as { listenerUUID: string }).listenerUUID

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
    sendDACPErrorResponse({
      message,
      errorType: DACP_ERROR_TYPES.LISTENER_ERROR,
      errorMessage: error instanceof Error ? error.message : "Failed to unsubscribe intent listener",
      instanceId,
      transport,
    })
  }
}
