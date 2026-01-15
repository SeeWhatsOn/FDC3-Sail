import { type Tracer, SpanStatusCode, type Span } from "@opentelemetry/api"
import type { Middleware } from "../middleware"

/**
 * Options for OpenTelemetry middleware
 */
export interface OpenTelemetryMiddlewareOptions {
  /**
   * The OpenTelemetry tracer to use
   */
  tracer: Tracer

  /**
   * Name of the span to create.
   * Can be a string or a function that derives the name from the message.
   */
  spanName: string | ((message: unknown) => string)

  /**
   * Optional hook to add attributes to the span based on the message
   */
  addAttribute?: (span: Span, message: unknown) => void
}

/**
 * Creates a middleware that wraps message processing in an OpenTelemetry span.
 *
 * @param options Configuration options
 * @returns Middleware function
 */
export function createOpenTelemetryMiddleware<T = unknown>(
  options: OpenTelemetryMiddlewareOptions
): Middleware<T> {
  return async (context, next) => {
    const { message } = context
    const spanName =
      typeof options.spanName === "function" ? options.spanName(message) : options.spanName

    const span = options.tracer.startSpan(spanName)

    try {
      // Add standard attributes
      span.setAttribute("component", "sail-api")

      // Add custom attributes if provided
      if (options.addAttribute) {
        options.addAttribute(span, message)
      }

      // Execute next middleware
      await next()

      span.setStatus({ code: SpanStatusCode.OK })
    } catch (error) {
      span.recordException(error as Error)
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: (error as Error).message,
      })
      throw error
    } finally {
      span.end()
    }
  }
}
