
// ============================================================================
// ERROR CLASSES
// ============================================================================

export class DACPValidationError extends Error {
  constructor(
    message: string,
    public readonly zodError?: unknown
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

// ============================================================================
// CONSTANTS
// ============================================================================

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
  TARGET_APP_UNAVAILABLE: "TargetAppUnavailable",
} as const

export type DACPErrorType = (typeof DACP_ERROR_TYPES)[keyof typeof DACP_ERROR_TYPES]

// ============================================================================
// MESSAGE CREATORS
// ============================================================================

/**
 * Creates a DACP error response following the specification format.
 * Accepts any object with meta.requestUuid (typically a DACPMessage).
 */
export function createDACPErrorResponse(
  originalRequest: { meta: { requestUuid: string; [key: string]: unknown } },
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
      responseUuid: crypto.randomUUID(),
      requestUuid: originalRequest.meta.requestUuid,
      timestamp: new Date(),
    },
  }
}

/**
 * Creates a DACP success response following the specification format.
 * Accepts any object with meta.requestUuid (typically a DACPMessage).
 */
export function createDACPSuccessResponse(
  originalRequest: { meta: { requestUuid: string; [key: string]: unknown } },
  responseType: string,
  payload: Record<string, unknown> = {}
) {
  return {
    type: responseType,
    payload,
    meta: {
      responseUuid: crypto.randomUUID(),
      requestUuid: originalRequest.meta.requestUuid,
      timestamp: new Date(),
    },
  }
}

/**
 * Creates a DACP event message.
 */
export function createDACPEvent(eventType: string, payload: Record<string, unknown> = {}) {
  return {
    type: eventType,
    payload,
    meta: {
      eventUuid: crypto.randomUUID(),
      timestamp: new Date(),
    },
  }
}

/**
 * Creates an intent event with requestUuid link for correlation.
 */
export function createIntentEvent(
  intent: string,
  context: unknown,
  requestUuid: string,
  originatingApp: { appId: string; instanceId?: string; desktopAgent?: string }
) {
  return {
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
      timestamp: new Date(),
    },
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Wraps a promise with a timeout, rejecting with DACPTimeoutError if exceeded.
 */
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

/**
 * Generates a UUID for events.
 */
export function generateEventUuid(): string {
  return crypto.randomUUID()
}

/**
 * Logs DACP messages for debugging (with sensitive data filtering).
 */
export function logDACPMessage(
  direction: "incoming" | "outgoing",
  message: unknown,
  source?: string
): void {
  try {
    // Basic message logging without validation dependency
    if (typeof message === "object" && message !== null) {
      const msg = message as Record<string, unknown>
      const logEntry = {
        direction,
        type: msg.type,
        meta: msg.meta,
        source,
      }

      console.log(`[DACP ${direction.toUpperCase()}]`, logEntry)
    } else {
      console.warn(`[DACP INVALID ${direction.toUpperCase()}]`, {
        message: "Invalid message format",
        source,
      })
    }
  } catch (error) {
    console.error(`[DACP LOG ERROR]`, error)
  }
}
