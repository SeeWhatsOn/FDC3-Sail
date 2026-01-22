import type { DACPMessage } from "../../types"
import type { Transport } from "../../../interfaces/transport"
import { createDACPErrorResponse } from "../../../dacp-protocol/dacp-message-creators"
import type { DACPErrorType } from "../../../dacp-protocol/dacp-constants"
import type { DACPResponseType } from "../../../dacp-protocol/dacp-messages"
import type { ResolveError, OpenError, ChannelError } from "@finos/fdc3"

/**
 * Options for sending a DACP response
 */
export interface SendDACPResponseOptions {
  /** The DACP response message to send */
  response: DACPMessage
  /** The target instance ID for routing */
  instanceId: string
  /** The transport to send the message through */
  transport: Transport
}

/**
 * Adds routing metadata to a DACP response and sends it via transport.
 * This eliminates the repeated pattern of adding destination metadata.
 */
export function sendDACPResponse(options: SendDACPResponseOptions): void {
  const { response, instanceId, transport } = options
  const responseWithRouting = {
    ...response,
    meta: {
      ...response.meta,
      destination: { instanceId },
    },
  }
  transport.send(responseWithRouting)
}

/**
 * Options for sending a DACP error response
 */
export interface SendDACPErrorResponseOptions {
  /** Original request message (must have type and meta.requestUuid) */
  message: DACPMessage
  /** DACP error type or FDC3 error enum (e.g., DACP_ERROR_TYPES.LISTENER_ERROR, ResolveError.NoAppsFound, OpenError.AppNotFound, ChannelError.NoChannelFound) */
  errorType: DACPErrorType | ResolveError | OpenError | ChannelError
  /** Human-readable error message */
  errorMessage: string
  /** The target instance ID for routing */
  instanceId: string
  /** The transport to send the message through */
  transport: Transport
}

/**
 * Derives response type from request type.
 * Converts "addEventListenerRequest" → "addEventListenerResponse"
 */
function deriveResponseType(requestType: string): string {
  if (requestType.endsWith("Request")) {
    return requestType.replace("Request", "Response")
  }
  // Fallback: if it doesn't end with "Request", assume it's already a response type
  return requestType
}

/**
 * Creates and sends a DACP error response with routing metadata.
 * Automatically derives the response type from the request message type.
 */
export function sendDACPErrorResponse(options: SendDACPErrorResponseOptions): void {
  const { message, errorType, errorMessage, instanceId, transport } = options
  const responseType = deriveResponseType(message.type) as DACPResponseType
  const errorResponse = createDACPErrorResponse(message, errorType, responseType, errorMessage)
  sendDACPResponse({ response: errorResponse, instanceId, transport })
}
