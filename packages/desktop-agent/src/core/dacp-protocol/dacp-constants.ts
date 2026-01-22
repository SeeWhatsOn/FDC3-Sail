/**
 * DACP Constants
 *
 * Standard timeouts and error types for the DACP protocol.
 */

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
  TARGET_INSTANCE_UNAVAILABLE: "TargetInstanceUnavailable",
} as const

export type DACPErrorType = (typeof DACP_ERROR_TYPES)[keyof typeof DACP_ERROR_TYPES]
