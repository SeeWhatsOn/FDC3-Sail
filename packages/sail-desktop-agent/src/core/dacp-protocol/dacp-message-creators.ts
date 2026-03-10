/**
 * DACP Message Creators
 *
 * Factory functions for creating DACP protocol messages following the FDC3 specification.
 */

import type { BrowserTypes } from "@finos/fdc3"
import type { DACPResponseType } from "./dacp-messages"

export interface DACPRequestLike {
  type: string
  meta: {
    requestUuid: string
  }
}

/**
 * Creates a DACP error response following the specification format.
 * Accepts any object with meta.requestUuid (typically a DACPMessage).
 * errorType must be a valid ResponsePayloadError from the FDC3 schema (use
 * OpenError, ResolveError, ChannelError, ResultError, BridgingError from @finos/fdc3).
 */
export function createDACPErrorResponse(
  originalRequest: DACPRequestLike,
  errorType: BrowserTypes.ResponsePayloadError,
  responseType: DACPResponseType,
  errorMessage?: string
): BrowserTypes.AgentResponseMessage {
  const response = {
    type: responseType,
    payload: {
      error: errorType,
      ...(errorMessage && { message: errorMessage }),
    },
    meta: {
      responseUuid: crypto.randomUUID(),
      requestUuid: originalRequest.meta.requestUuid,
      timestamp: new Date().toISOString(),
    },
  }

  // BrowserTypes currently type meta.timestamp as Date, but wire schema expects ISO string.
  // TODO: Raise GitHub issue to align generated types with schema (timestamp as string).
  return response as unknown as BrowserTypes.AgentResponseMessage
}

/**
 * Creates a DACP success response following the specification format.
 * Accepts any object with meta.requestUuid (typically a DACPMessage).
 */
export function createDACPSuccessResponse(
  originalRequest: DACPRequestLike,
  responseType: DACPResponseType,
  payload: Record<string, unknown> = {}
): BrowserTypes.AgentResponseMessage {
  const response = {
    type: responseType,
    payload,
    meta: {
      responseUuid: crypto.randomUUID(),
      requestUuid: originalRequest.meta.requestUuid,
      timestamp: new Date().toISOString(),
    },
  }

  // BrowserTypes currently type meta.timestamp as Date, but wire schema expects ISO string.
  // TODO: Raise GitHub issue to align generated types with schema (timestamp as string).
  return response as unknown as BrowserTypes.AgentResponseMessage
}

/**
 * Creates a DACP event message.
 */
export function createDACPEvent(
  eventType: BrowserTypes.EventMessageType,
  payload: Record<string, unknown> = {}
): BrowserTypes.AgentEventMessage {
  const response = {
    type: eventType,
    payload,
    meta: {
      eventUuid: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  }

  // BrowserTypes currently type meta.timestamp as Date, but wire schema expects ISO string.
  // TODO: Raise GitHub issue to align generated types with schema (timestamp as string).
  return response as unknown as BrowserTypes.AgentEventMessage
}

/**
 * Creates an intent event with requestUuid link for correlation.
 */
export function createIntentEvent(
  intent: string,
  context: unknown,
  requestUuid: string,
  originatingApp: { appId: string; instanceId?: string; desktopAgent?: string }
): BrowserTypes.IntentEvent {
  const response = {
    type: "intentEvent",
    payload: {
      intent,
      context,
      originatingApp: {
        appId: originatingApp.appId,
        ...(originatingApp.instanceId && { instanceId: originatingApp.instanceId }),
        ...(originatingApp.desktopAgent && { desktopAgent: originatingApp.desktopAgent }),
      },
      raiseIntentRequestUuid: requestUuid,
    },
    meta: {
      eventUuid: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  }

  // BrowserTypes currently type meta.timestamp as Date, but wire schema expects ISO string.
  // TODO: Raise GitHub issue to align generated types with schema (timestamp as string).
  return response as unknown as BrowserTypes.IntentEvent
}
