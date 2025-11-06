import { z } from "zod"
import { v4 as uuidv4 } from "uuid"
import {
  BaseDACPMessageSchema,
  type BaseDACPMessage,
  BroadcastrequestSchema,
  AddcontextlistenerrequestSchema,
  RaiseintentrequestSchema,
  GetcurrentchannelrequestSchema,
  JoinuserchannelrequestSchema,
} from "./dacp-schemas"

// Custom error types
export class DACPValidationError extends Error {
  constructor(
    message: string,
    public readonly zodError?: z.ZodError
  ) {
    super(message)
    this.name = "DACPValidationError"
  }
}

export class DACPTimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DACPTimeoutError"
  }
}

export class DACPProcessingError extends Error {
  constructor(
    message: string,
    public readonly originalError?: Error
  ) {
    super(message)
    this.name = "DACPProcessingError"
  }
}

// Standard DACP timeouts
export const DACP_TIMEOUTS = {
  DEFAULT: 10000, // 10 seconds
  APP_LAUNCH: 100000, // 100 seconds
  MINIMUM_APP_LAUNCH: 15000, // 15 seconds minimum
} as const

// Standard DACP error types (from specification)
export const DACP_ERROR_TYPES = {
  // Generic errors
  APP_TIMEOUT: "AppTimeout",
  API_TIMEOUT: "ApiTimeout",
  MALFORMED_MESSAGE: "MalformedMessage",

  // Context errors
  BROADCAST_ERROR: "BroadcastError",
  LISTENER_ERROR: "ListenerError",
  NO_CHANNEL_FOUND: "NoChannelFound",

  // Intent errors
  INTENT_DELIVERY_FAILED: "IntentDeliveryFailed",
  NO_APPS_FOUND: "NoAppsFound",
  RESOLVER_UNAVAILABLE: "ResolverUnavailable",

  // Channel errors
  CHANNEL_ERROR: "ChannelError",
  ACCESS_DENIED: "AccessDenied",

  // App errors
  APP_NOT_FOUND: "AppNotFound",
  APP_LAUNCH_FAILED: "AppLaunchFailed",
} as const

export type DACPErrorType = (typeof DACP_ERROR_TYPES)[keyof typeof DACP_ERROR_TYPES]

// Validation utility function
export function validateDACPMessage<T>(message: unknown, schema: z.ZodSchema<T>): T {
  try {
    return schema.parse(message)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorDetails = error.issues
        .map((e: z.ZodIssue) => `${e.path.join(".")}: ${e.message}`)
        .join(", ")
      throw new DACPValidationError(`Invalid DACP message structure: ${errorDetails}`, error)
    }
    throw new DACPValidationError(`Unknown validation error: ${error as string}`)
  }
}

// Safe validation that returns result instead of throwing
export function safeParseDACPMessage<T>(
  message: unknown,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; error: DACPValidationError } {
  try {
    const data = validateDACPMessage(message, schema)
    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof DACPValidationError ? error : new DACPValidationError(`${error as string}`),
    }
  }
}

// Error response creator following DACP specification
export function createDACPErrorResponse(
  originalRequest: { meta: { requestUuid: string } },
  errorType: DACPErrorType,
  responseType: string,
  errorMessage?: string
) {
  return {
    type: responseType,
    payload: {
      error: errorType,
      ...(errorMessage && { message: errorMessage }),
    },
    meta: {
      responseUuid: uuidv4(),
      requestUuid: originalRequest.meta.requestUuid,
      timestamp: new Date(),
    },
  }
}

// Success response creator
export function createDACPSuccessResponse(
  originalRequest: { meta: { requestUuid: string } },
  responseType: string,
  payload: Record<string, unknown> = {}
) {
  return {
    type: responseType,
    payload,
    meta: {
      responseUuid: uuidv4(),
      requestUuid: originalRequest.meta.requestUuid,
      timestamp: new Date(),
    },
  }
}

// Event message creator
export function createDACPEvent(eventType: string, payload: Record<string, unknown> = {}) {
  return {
    type: eventType,
    payload,
    meta: {
      eventUuid: uuidv4(),
      timestamp: new Date(),
    },
  }
}

// Intent event creator with requestUuid link
export function createIntentEvent(
  intent: string,
  context: unknown,
  requestUuid: string,
  originFdc3InstanceId?: string
) {
  return {
    type: "intentEvent",
    payload: {
      intent,
      context,
      ...(originFdc3InstanceId && { originFdc3InstanceId }),
    },
    meta: {
      eventUuid: uuidv4(),
      requestUuid, // Links back to the raiseIntentRequest
      timestamp: new Date(),
    },
  }
}

// Message type guards using the generated schemas
export function isBroadcastRequest(message: unknown): boolean {
  return safeParseDACPMessage(message, BroadcastrequestSchema).success
}

export function isAddContextListenerRequest(message: unknown): boolean {
  return safeParseDACPMessage(message, AddcontextlistenerrequestSchema).success
}

export function isRaiseIntentRequest(message: unknown): boolean {
  return safeParseDACPMessage(message, RaiseintentrequestSchema).success
}

export function isGetCurrentChannelRequest(message: unknown): boolean {
  return safeParseDACPMessage(message, GetcurrentchannelrequestSchema).success
}

export function isJoinUserChannelRequest(message: unknown): boolean {
  return safeParseDACPMessage(message, JoinuserchannelrequestSchema).success
}

// Generic type guards from base schema
export function isDACPRequest(message: unknown): message is BaseDACPMessage {
  const result = safeParseDACPMessage(message, BaseDACPMessageSchema)
  return (
    result.success && typeof result.data.type === "string" && result.data.type.endsWith("Request")
  )
}

export function isDACPResponse(message: unknown): message is BaseDACPMessage {
  const result = safeParseDACPMessage(message, BaseDACPMessageSchema)
  return (
    result.success && typeof result.data.type === "string" && result.data.type.endsWith("Response")
  )
}

export function isDACPEvent(message: unknown): message is BaseDACPMessage {
  const result = safeParseDACPMessage(message, BaseDACPMessageSchema)
  return (
    result.success && typeof result.data.type === "string" && result.data.type.endsWith("Event")
  )
}

// Timeout utility for DACP operations
export function withDACPTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = DACP_TIMEOUTS.DEFAULT,
  operation: string = "DACP operation"
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new DACPTimeoutError(`${operation} timed out after ${timeoutMs}ms`))
      }, timeoutMs)
    }),
  ])
}

// UUID generator utility
export function generateRequestUuid(): string {
  return uuidv4()
}

export function generateResponseUuid(): string {
  return uuidv4()
}

export function generateEventUuid(): string {
  return uuidv4()
}

// Logging utility for DACP messages (with sensitive data filtering)
export function logDACPMessage(
  direction: "incoming" | "outgoing",
  message: unknown,
  source?: string
): void {
  try {
    const baseMessage = safeParseDACPMessage(message, BaseDACPMessageSchema)
    if (baseMessage.success) {
      const { type, meta } = baseMessage.data
      const logEntry = {
        direction,
        type,
        requestUuid: meta.requestUuid,
        responseUuid: meta.responseUuid,
        eventUuid: meta.eventUuid,
        timestamp: meta.timestamp,
        source,
      }

      console.log(`[DACP ${direction.toUpperCase()}]`, logEntry)
    } else {
      console.warn(`[DACP INVALID ${direction.toUpperCase()}]`, {
        error: baseMessage.error.message,
        source,
      })
    }
  } catch (error) {
    console.error(`[DACP LOG ERROR]`, error)
  }
}
