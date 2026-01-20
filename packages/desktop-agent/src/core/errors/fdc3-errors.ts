import { ResolveError, OpenError, ChannelError } from "@finos/fdc3"

/**
 * Base class for FDC3-specific errors with error type information
 */
export class FDC3ResolveError extends Error {
  constructor(
    public readonly errorType: ResolveError,
    message: string
  ) {
    super(message)
    this.name = "FDC3ResolveError"
  }
}

/**
 * Error thrown when no apps are found to handle an intent
 */
export class NoAppsFoundError extends FDC3ResolveError {
  constructor(message: string) {
    super(ResolveError.NoAppsFound, message)
  }
}

/**
 * Error thrown when target app is not available
 */
export class TargetAppUnavailableError extends FDC3ResolveError {
  constructor(message: string) {
    super(ResolveError.TargetAppUnavailable, message)
  }
}

/**
 * Error thrown when target instance is not available
 */
export class TargetInstanceUnavailableError extends FDC3ResolveError {
  constructor(message: string) {
    super(ResolveError.TargetInstanceUnavailable, message)
  }
}

/**
 * Error thrown when intent delivery fails
 */
export class IntentDeliveryFailedError extends FDC3ResolveError {
  constructor(message: string) {
    super(ResolveError.IntentDeliveryFailed, message)
  }
}

/**
 * Error thrown when user cancels intent resolution
 */
export class UserCancelledError extends FDC3ResolveError {
  constructor(message: string) {
    super(ResolveError.UserCancelled, message)
  }
}
