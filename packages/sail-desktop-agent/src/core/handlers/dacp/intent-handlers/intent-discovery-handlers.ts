/**
 * Intent Discovery Handlers
 *
 * Handlers for finding intents and apps that handle intents
 */

import { createDACPSuccessResponse } from "../../../dacp-protocol/dacp-message-creators"
import { DACP_ERROR_TYPES } from "../../../dacp-protocol/dacp-constants"
import { type DACPHandlerContext } from "../../types"
import { sendDACPResponse, sendDACPErrorResponse } from "../utils/dacp-response-utils"
import type { BrowserTypes } from "@finos/fdc3"
import { createAppIntents, findIntentsByContext } from "./intent-helpers"

export function handleFindIntentRequest(
  message: BrowserTypes.FindIntentRequest,
  context: DACPHandlerContext
): void {
  const { transport, instanceId, getState, appDirectory, logger } = context

  try {
    const payload = message.payload
    const intent = payload.intent
    const contextType = payload.context?.type
    const resultType = payload.resultType

    const appIntents = createAppIntents(getState(), appDirectory, intent, contextType, resultType)

    if (appIntents.length === 0) {
      throw new Error(`No apps found to handle intent: ${intent}`)
    }

    const response = createDACPSuccessResponse(message, "findIntentResponse", {
      appIntent: appIntents[0],
    })

    sendDACPResponse({ response, instanceId, transport })
  } catch (error) {
    logger.error("DACP: Find intent request failed", error)
    sendDACPErrorResponse({
      message,
      errorType: DACP_ERROR_TYPES.NO_APPS_FOUND,
      errorMessage: error instanceof Error ? error.message : "Failed to find apps for intent",
      instanceId,
      transport,
    })
  }
}

export function handleFindIntentsByContextRequest(
  message: BrowserTypes.FindIntentsByContextRequest,
  context: DACPHandlerContext
): void {
  const { transport, instanceId, getState, appDirectory, logger } = context

  try {
    const payload = message.payload
    const contextType = payload.context?.type
    const resultType = payload.resultType ?? undefined

    if (!contextType) {
      throw new Error("Context type is required for findIntentsByContext")
    }

    logger.info("DACP: Finding intents for context type", { contextType, resultType })

    // Find all intents that can handle this context type
    const intentMetadata = findIntentsByContext(getState(), appDirectory, contextType)

    // Convert to AppIntent[] format, applying resultType filter via createAppIntents
    const appIntents = intentMetadata
      .map(
        metadata =>
          createAppIntents(getState(), appDirectory, metadata.name, contextType, resultType)[0]
      )
      .filter((appIntent): appIntent is NonNullable<typeof appIntent> => !!appIntent)
      .filter(appIntent => appIntent.apps.length > 0)

    if (appIntents.length === 0) {
      throw new Error(`No apps found to handle context type: ${contextType}`)
    }

    const response = createDACPSuccessResponse(message, "findIntentsByContextResponse", {
      appIntents,
    })

    sendDACPResponse({ response, instanceId, transport })
  } catch (error) {
    logger.error("DACP: Find intents by context request failed", error)
    sendDACPErrorResponse({
      message,
      errorType: DACP_ERROR_TYPES.NO_APPS_FOUND,
      errorMessage:
        error instanceof Error ? error.message : "Failed to find intents for context type",
      instanceId,
      transport,
    })
  }
}
