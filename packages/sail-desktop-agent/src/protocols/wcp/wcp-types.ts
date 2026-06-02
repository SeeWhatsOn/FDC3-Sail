import type { AppMetadata, BrowserTypes } from "@finos/fdc3"
import type { Logger } from "../../core/interfaces/logger"
import type {
  AppRequestMessage,
  AgentEventMessage,
  AgentResponseMessage,
  WebConnectionProtocolMessage,
} from "@finos/fdc3-schema/dist/generated/api/BrowserTypes"

export type WCP1HelloMessage = BrowserTypes.WebConnectionProtocol1Hello
export type WCP3HandshakeMessage = BrowserTypes.WebConnectionProtocol3Handshake

/**
 * Union type for all DACP and WCP messages
 * Uses official FDC3 schema types for full type safety
 */
export type DACPMessage =
  | AppRequestMessage
  | AgentResponseMessage
  | AgentEventMessage
  | WebConnectionProtocolMessage

/**
 * Type guard to check if a message has the basic structure of a DACP message
 *
 * Note: Type guard parameters MUST be 'unknown' per TypeScript type narrowing requirements.
 * This is the correct pattern for validating untrusted external input.
 */
export function isDACPMessage(message: unknown): message is DACPMessage {
  return (
    message !== null &&
    typeof message === "object" &&
    "type" in message &&
    typeof message.type === "string" &&
    "meta" in message &&
    message.meta !== null &&
    typeof message.meta === "object"
  )
}

/**
 * Type guard to check if a message is from an app (request or WCP message)
 *
 * Note: Type guard parameters MUST be 'unknown' per TypeScript type narrowing requirements.
 */
export function isAppMessage(
  message: unknown
): message is AppRequestMessage | WebConnectionProtocolMessage {
  return (
    isDACPMessage(message) && (message.type.endsWith("Request") || message.type.startsWith("WCP"))
  )
}

/**
 * Type guard to check if a message is from Desktop Agent (response or event)
 *
 * Note: Type guard parameters MUST be 'unknown' per TypeScript type narrowing requirements.
 */
export function isAgentMessage(
  message: unknown
): message is AgentResponseMessage | AgentEventMessage | WebConnectionProtocolMessage {
  return (
    isDACPMessage(message) &&
    (message.type.endsWith("Response") ||
      message.type.endsWith("Event") ||
      message.type.startsWith("WCP"))
  )
}

/**
 * Configuration options for WCPConnector
 */
export interface WCPConnectorOptions {
  /**
   * Function to generate intent resolver URL for a given app instance.
   * Return undefined or false to indicate Sail-controlled UI (no injected iframe).
   *
   * @param instanceId - The app instance ID
   * @returns URL for intent resolver iframe, or undefined/false for Sail-controlled UI
   */
  getIntentResolverUrl?: (instanceId: string) => string | undefined | false

  /**
   * Function to generate channel selector URL for a given app instance.
   * Return undefined or false to indicate Sail-controlled UI (no injected iframe).
   *
   * @param instanceId - The app instance ID
   * @returns URL for channel selector iframe, or undefined/false for Sail-controlled UI
   */
  getChannelSelectorUrl?: (instanceId: string) => string | undefined | false

  /**
   * FDC3 version to advertise in WCP3Handshake.
   * Defaults to "2.2"
   */
  fdc3Version?: string

  /**
   * Timeout for WCP handshake completion (ms).
   * Defaults to 5000ms.
   */
  handshakeTimeout?: number

  /**
   * Grace period for app disconnection after WCP6Goodbye (ms).
   * Allows reconnection during false-positive pagehide events (e.g., tab moves).
   * Defaults to 2000ms.
   */
  disconnectGracePeriod?: number

  /**
   * Timeout for intent resolution UI response (ms).
   * Defaults to 60000ms (60 seconds).
   */
  intentResolutionTimeout?: number

  /**
   * Enable debug logging.
   * Defaults to false.
   */
  debug?: boolean

  /**
   * Logger instance for WCP connector operations.
   * OPTIONAL - defaults to consoleLogger if not provided.
   */
  logger?: Logger
}

/**
 * Metadata about a connected app instance
 */
export interface AppConnectionMetadata {
  /**
   * Unique instance ID for this app connection
   */
  instanceId: string

  /**
   * App ID from app directory
   */
  appId: string

  /**
   * Connection attempt UUID from WCP1Hello
   */
  connectionAttemptUuid: string

  /**
   * MessageEvent.origin from the original WCP1Hello message
   * Used for WCP4 app identity validation
   */
  messageOrigin: string

  /**
   * Source window/iframe that initiated connection
   */
  source: Window

  /**
   * MessagePort for communication with this app
   */
  port: MessagePort

  /**
   * Timestamp when connection was established
   */
  connectedAt: Date

  /**
   * Optional identifier from the iframe's name attribute.
   * Can be used by hosting applications to correlate connections with UI elements.
   */
  hostIdentifier?: string
}

/**
 * Handler option for intent resolution
 */
export type IntentHandler = AppMetadata & {
  /** Whether this is a running instance (has active listener) */
  isRunning: boolean
}

/**
 * Payload for intent resolution request to UI
 */
export interface IntentResolverPayload {
  /** Unique request ID for correlation */
  requestId: string
  /** Intent name being raised */
  intent: string
  /** Context being passed with intent */
  context: unknown
  /** Available handlers to choose from */
  handlers: IntentHandler[]
}

/**
 * Response from UI with user's handler selection
 */
export interface IntentResolverResponse {
  /** Request ID this is responding to */
  requestId: string
  /** Selected handler, or null if cancelled */
  selectedHandler: { instanceId?: string; appId: string } | null
}

/**
 * Event types emitted by WCPConnector
 */
export interface WCPConnectorEvents {
  /**
   * Fired when a new app successfully completes WCP handshake
   */
  appConnected: (metadata: AppConnectionMetadata) => void

  /**
   * Fired when an app disconnects
   */
  appDisconnected: (instanceId: string) => void

  /**
   * Fired when handshake fails
   */
  handshakeFailed: (error: Error, connectionAttemptUuid: string) => void

  /**
   * Fired when an app's channel membership changes
   * channelId is null when app leaves all channels
   */
  channelChanged: (instanceId: string, channelId: string | null) => void

  /**
   * Fired when intent resolution UI is needed
   * UI should display handler options and call resolveIntentSelection()
   */
  intentResolverNeeded: (payload: IntentResolverPayload) => void
}
