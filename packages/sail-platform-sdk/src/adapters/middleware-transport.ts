/**
 * Middleware Transport Wrapper
 *
 * Wraps any Transport implementation with middleware capabilities for
 * intercepting and processing messages before they are sent or received.
 *
 * This allows adding cross-cutting concerns like logging, authentication,
 * metrics, and message transformation without modifying the core Desktop Agent.
 *
 * @example
 * ```typescript
 * import { MiddlewareTransport } from "@finos/sail-platform-sdk"
 * import { SocketIOTransport } from "@finos/sail-platform-sdk"
 *
 * const baseTransport = new SocketIOTransport(socket)
 *
 * const transport = new MiddlewareTransport(baseTransport, {
 *   onSend: [(message) => {
 *     console.log("Sending:", message)
 *     return message
 *   }],
 *   onReceive: [(message) => {
 *     console.log("Received:", message)
 *     return message
 *   }],
 * })
 * ```
 */

import type { Transport, MessageHandler, DisconnectHandler } from "@finos/fdc3-sail-desktop-agent"

/**
 * Middleware function for transforming/intercepting messages.
 * Returns the (possibly modified) message, or null to drop the message.
 */
export type TransportMiddleware = (message: unknown) => unknown | Promise<unknown>

/**
 * Configuration for MiddlewareTransport
 */
export interface MiddlewareTransportOptions {
  /**
   * Middlewares to apply when sending messages.
   * Executed in order before the message is sent to the underlying transport.
   * Return null from any middleware to drop the message.
   */
  onSend?: TransportMiddleware[]

  /**
   * Middlewares to apply when receiving messages.
   * Executed in order before the message is passed to the handler.
   * Return null from any middleware to drop the message.
   */
  onReceive?: TransportMiddleware[]
}

/**
 * Transport wrapper that applies middleware to all messages.
 *
 * Use this to add cross-cutting concerns to any transport:
 * - Logging
 * - Authentication/authorization
 * - Metrics collection
 * - Message transformation
 * - Message filtering
 */
export class MiddlewareTransport implements Transport {
  private inner: Transport
  private sendMiddlewares: TransportMiddleware[]
  private receiveMiddlewares: TransportMiddleware[]
  private messageHandler: MessageHandler | null = null

  constructor(inner: Transport, options: MiddlewareTransportOptions = {}) {
    this.inner = inner
    this.sendMiddlewares = options.onSend ?? []
    this.receiveMiddlewares = options.onReceive ?? []
  }

  /**
   * Send a message through the middleware chain, then to the underlying transport.
   */
  send(message: unknown): void {
    // Apply send middlewares synchronously (fire-and-forget for performance)
    void this.applySendMiddlewares(message)
  }

  private async applySendMiddlewares(message: unknown): Promise<void> {
    let current: unknown | null = message

    for (const middleware of this.sendMiddlewares) {
      current = await middleware(current)
      if (current === null) {
        // Message dropped by middleware
        return
      }
    }

    this.inner.send(current)
  }

  /**
   * Register a message handler. Messages will pass through receive middlewares first.
   */
  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler

    this.inner.onMessage(async (message: unknown) => {
      let current: unknown | null = message

      for (const middleware of this.receiveMiddlewares) {
        current = await middleware(current)
        if (current === null) {
          // Message dropped by middleware
          return
        }
      }

      if (this.messageHandler) {
        await this.messageHandler(current)
      }
    })
  }

  /**
   * Register a disconnect handler. Passes through to inner transport.
   */
  onDisconnect(handler: DisconnectHandler): void {
    this.inner.onDisconnect(handler)
  }

  /**
   * Check if the underlying transport is connected.
   */
  isConnected(): boolean {
    return this.inner.isConnected()
  }

  /**
   * Get the instance ID from the underlying transport.
   */
  getInstanceId(): string | null {
    return this.inner.getInstanceId()
  }

  /**
   * Disconnect the underlying transport.
   */
  disconnect(): void {
    this.inner.disconnect()
  }

  /**
   * Add a send middleware dynamically.
   */
  addSendMiddleware(middleware: TransportMiddleware): this {
    this.sendMiddlewares.push(middleware)
    return this
  }

  /**
   * Add a receive middleware dynamically.
   */
  addReceiveMiddleware(middleware: TransportMiddleware): this {
    this.receiveMiddlewares.push(middleware)
    return this
  }
}

// ============================================================================
// EXAMPLE MIDDLEWARES
// ============================================================================

/**
 * Creates a logging middleware that logs all messages.
 *
 * @param options - Logging options
 * @returns A TransportMiddleware function
 *
 * @example
 * ```typescript
 * const transport = new MiddlewareTransport(baseTransport, {
 *   onSend: [createLoggingMiddleware({ prefix: "SEND" })],
 *   onReceive: [createLoggingMiddleware({ prefix: "RECV" })],
 * })
 * ```
 */
export function createLoggingMiddleware(options?: {
  prefix?: string
  logFn?: (message: string, data: unknown) => void
}): TransportMiddleware {
  const prefix = options?.prefix ?? "DACP"
  const logFn = options?.logFn ?? ((msg, data) => console.log(msg, data))

  return (message: unknown) => {
    const messageType =
      typeof message === "object" && message !== null && "type" in message
        ? (message as { type: string }).type
        : "unknown"

    logFn(`[${prefix}] ${messageType}`, message)
    return message
  }
}

/**
 * Creates a message filter middleware.
 *
 * @param predicate - Function that returns true to keep the message, false to drop it
 * @returns A TransportMiddleware function
 *
 * @example
 * ```typescript
 * // Only allow broadcast and intent messages
 * const filter = createFilterMiddleware((msg) =>
 *   msg.type?.includes("broadcast") || msg.type?.includes("intent")
 * )
 * ```
 */
export function createFilterMiddleware(
  predicate: (message: unknown) => boolean
): TransportMiddleware {
  return (message: unknown) => {
    return predicate(message) ? message : null
  }
}

/**
 * Creates a message transformer middleware.
 *
 * @param transform - Function that transforms the message
 * @returns A TransportMiddleware function
 *
 * @example
 * ```typescript
 * // Add timestamp to all outgoing messages
 * const addTimestamp = createTransformMiddleware((msg) => ({
 *   ...msg,
 *   meta: { ...msg.meta, sentAt: Date.now() }
 * }))
 * ```
 */
export function createTransformMiddleware(
  transform: (message: unknown) => unknown
): TransportMiddleware {
  return (message: unknown) => {
    return transform(message)
  }
}

/**
 * Creates a metrics collection middleware (placeholder).
 *
 * @param options - Metrics options
 * @returns A TransportMiddleware function
 *
 * @example
 * ```typescript
 * const metrics = createMetricsMiddleware({
 *   onMessage: (type, duration) => {
 *     myMetricsCollector.record("dacp.message", { type, duration })
 *   }
 * })
 * ```
 */
export function createMetricsMiddleware(options: {
  onMessage?: (messageType: string, processingTimeMs: number) => void
}): TransportMiddleware {
  return (message: unknown) => {
    const startTime = Date.now()
    const messageType =
      typeof message === "object" && message !== null && "type" in message
        ? (message as { type: string }).type
        : "unknown"

    // Log metrics (fire-and-forget)
    queueMicrotask(() => {
      const duration = Date.now() - startTime
      options.onMessage?.(messageType, duration)
    })

    return message
  }
}
