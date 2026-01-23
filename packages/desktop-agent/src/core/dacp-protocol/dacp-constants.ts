/**
 * DACP Constants
 *
 * Standard timeouts and error types for the DACP protocol.
 * 
 * IMPORTANT: For FDC3-compliant error handling, use FDC3 error enums directly:
 * - Use `OpenError` enum for app launch errors (e.g., `OpenError.ErrorOnLaunch`, not "AppLaunchFailed")
 * - Use `ChannelError` enum for channel errors (e.g., `ChannelError.NoChannelFound`, `ChannelError.AccessDenied`)
 * - Use `ResolveError` enum for intent errors (e.g., `ResolveError.NoAppsFound`, `ResolveError.IntentDeliveryFailed`)
 * 
 * The values below are kept for protocol-specific errors or backward compatibility.
 * New code should use FDC3 error enums from `@finos/fdc3` package.
 */

// Standard DACP timeouts
export const DACP_TIMEOUTS = {
  DEFAULT: 10000, // 10 seconds
  APP_LAUNCH: 100000, // 100 seconds
  MINIMUM_APP_LAUNCH: 15000, // 15 seconds minimum
} as const

// DACP error types (FDC3-compliant values only)
// NOTE: For FDC3 compliance, prefer using FDC3 error enums directly:
// - OpenError (for app operations)
// - ChannelError (for channel operations)  
// - ResolveError (for intent operations)
// - ResultError (for intent result operations)
export const DACP_ERROR_TYPES = {
  // Protocol-specific errors (not in FDC3 enums)
  MALFORMED_MESSAGE: "MalformedMessage",

  // FDC3-compliant error values (kept for convenience, but prefer using FDC3 enums)
  // These match FDC3 enum values exactly
  APP_TIMEOUT: "AppTimeout", // OpenError.AppTimeout
  API_TIMEOUT: "ApiTimeout", // Common across all error enums
  NO_CHANNEL_FOUND: "NoChannelFound", // ChannelError.NoChannelFound
  INTENT_DELIVERY_FAILED: "IntentDeliveryFailed", // ResolveError.IntentDeliveryFailed
  NO_APPS_FOUND: "NoAppsFound", // ResolveError.NoAppsFound
  RESOLVER_UNAVAILABLE: "ResolverUnavailable", // ResolveError.ResolverUnavailable | OpenError.ResolverUnavailable
  ACCESS_DENIED: "AccessDenied", // ChannelError.AccessDenied
  APP_NOT_FOUND: "AppNotFound", // OpenError.AppNotFound
  TARGET_APP_UNAVAILABLE: "TargetAppUnavailable", // ResolveError.TargetAppUnavailable
  TARGET_INSTANCE_UNAVAILABLE: "TargetInstanceUnavailable", // ResolveError.TargetInstanceUnavailable
} as const

export type DACPErrorType = (typeof DACP_ERROR_TYPES)[keyof typeof DACP_ERROR_TYPES]
