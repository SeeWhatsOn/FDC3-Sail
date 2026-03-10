import type { BrowserTypes } from "@finos/fdc3"
import type { Transport } from "../../../interfaces/transport"
import {
  createDACPErrorResponse,
  type DACPRequestLike,
} from "../../../dacp-protocol/dacp-message-creators"
import type { DACPResponseType } from "../../../dacp-protocol/dacp-messages"

/**
 * Options for sending a DACP response
 */
export interface SendDACPResponseOptions {
  /** The DACP response message to send */
  response: BrowserTypes.AgentResponseMessage | BrowserTypes.WebConnectionProtocolMessage
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
  message: DACPRequestLike
  /** FDC3 response payload error (use OpenError, ResolveError, ChannelError, ResultError, BridgingError from @finos/fdc3) */
  errorType: BrowserTypes.ResponsePayloadError
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
