/**
 * Intent Result Handlers
 *
 * Handlers for processing intent results
 */

import { createDACPSuccessResponse } from "../../../dacp-protocol/dacp-message-creators"
import { DACP_ERROR_TYPES } from "../../../dacp-protocol/dacp-constants"
import { type DACPHandlerContext, type DACPMessage } from "../../types"
import { sendDACPResponse, sendDACPErrorResponse } from "../utils/dacp-response-utils"
import { getPendingIntent } from "../../../state/selectors"
import { resolvePendingIntent } from "../../../state/mutators"
import { pendingIntentPromises } from "./intent-helpers"

export function handleIntentResultRequest(message: DACPMessage, context: DACPHandlerContext): void {
  const { transport, instanceId, getState, setState, logger } = context

  try {
    const payload = message.payload as {
      raiseIntentRequestUuid: string
      intentResult?: unknown
    }

    logger.info("DACP: Processing intent result request", {
      requestUuid: message.meta.requestUuid,
      raiseIntentRequestUuid: payload.raiseIntentRequestUuid,
    })

    // Get the original request ID from payload.raiseIntentRequestUuid
    const originalRequestId = payload.raiseIntentRequestUuid

    // Check if there's a pending intent for this request
    const state = getState()
    const pendingIntent = getPendingIntent(state, originalRequestId)

    if (!pendingIntent) {
      throw new Error(`No pending intent found for request: ${originalRequestId}`)
    }

    // Verify that the instanceId matches the target instance
    if (pendingIntent.targetInstanceId !== instanceId) {
      throw new Error(
        `Intent result from wrong instance. Expected ${pendingIntent.targetInstanceId}, got ${instanceId}`
      )
    }

    // Note: Errors are communicated via error responses, not via message.payload.error
    // If the intent handler failed, it would send an error response directly,
    // not an intentResultRequest with an error field

    // Resolve the pending intent with the result
    const intentResult = payload.intentResult

    // Get promise functions from Map and resolve
    const promiseData = pendingIntentPromises.get(originalRequestId)
    if (promiseData) {
      if (promiseData.timeoutHandle) {
        clearTimeout(promiseData.timeoutHandle)
      }
      promiseData.resolve(intentResult)
      pendingIntentPromises.delete(originalRequestId)
    }

    // Remove from state
    setState(state => resolvePendingIntent(state, originalRequestId))

    // Send acknowledgment response
    const response = createDACPSuccessResponse(message, "intentResultResponse")
    sendDACPResponse({ response, instanceId, transport })

    logger.info("DACP: Intent result processed successfully", {
      originalRequestId,
      hasResult: !!intentResult,
    })
  } catch (error) {
    logger.error("DACP: Intent result request failed", error)
    sendDACPErrorResponse({
      message,
      errorType: DACP_ERROR_TYPES.INTENT_DELIVERY_FAILED,
      errorMessage: error instanceof Error ? error.message : "Failed to process intent result",
      instanceId,
      transport,
    })
  }
}
