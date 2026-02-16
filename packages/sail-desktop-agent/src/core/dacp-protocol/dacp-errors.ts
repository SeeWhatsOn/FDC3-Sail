/**
 * DACP Error Classes
 *
 * Custom error classes for DACP protocol operations.
 * These extend Error to provide proper stack traces and error handling.
 */

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
