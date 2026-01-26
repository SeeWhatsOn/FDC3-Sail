/**
 * DACP Message Creators
 *
 * Factory functions for creating DACP protocol messages following the FDC3 specification.
 */

import type { BrowserTypes, ResolveError, OpenError, ChannelError } from "@finos/fdc3"
import type { DACPResponseType } from "./dacp-messages"
import type { DACPErrorType } from "./dacp-constants"

export interface DACPRequestLike {
  type: string
  meta: {
    requestUuid: string
  }
}

/**
 * Creates a DACP error response following the specification format.
 * Accepts any object with meta.requestUuid (typically a DACPMessage).
 * errorType can be a DACPErrorType or an FDC3 error enum value (string).
 *
 * Note: DACP protocol may use some error strings that differ from FDC3 API enums:
 * - DACP uses "AppLaunchFailed" but FDC3 uses "ErrorOnLaunch" for the same concept
 * - DACP uses generic "ChannelError" which doesn't map to a specific FDC3 enum value
 */
export function createDACPErrorResponse(
  originalRequest: DACPRequestLike,
  errorType: DACPErrorType | ResolveError | OpenError | ChannelError,
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
