/**
 * Sail Platform Protocol Messages
 * Proprietary Sail platform communication protocol
 */

import type { Context } from "@finos/fdc3-context"
import type { AppIntent, IntentMetadata, AppMetadata } from "@finos/fdc3-standard"
import type { AppRegistration, DirectoryApp, TabDetail, AppHosting } from "../types/sail-types"

// ============================================================================
// SAIL MESSAGE TYPES
// ============================================================================

/**
 * Sail platform message types (camelCase for consistency)
 */
export const SailMessages = {
  // Handshake & Connection
  DA_HELLO: "daHello",
  SAIL_CLIENT_STATE: "sailClientState",
  APP_HELLO: "appHello",

  // App Management
  DA_REGISTER_APP_LAUNCH: "daRegisterAppLaunch",
  DA_DIRECTORY_LISTING: "daDirectoryListing",
  SAIL_APP_OPEN: "sailAppOpen",
  SAIL_APP_STATE: "sailAppState",

  // Intent Resolution
  SAIL_INTENT_RESOLVE: "sailIntentResolve",
  SAIL_INTENT_RESOLVE_ON_CHANNEL: "sailIntentResolveOnChannel",

  // Channel Management
  SAIL_CHANNEL_SETUP: "sailChannelSetup",
  SAIL_CHANNEL_CHANGE: "sailChannelChange",
  CHANNEL_RECEIVER_HELLO: "channelReceiverHello",
  CHANNEL_RECEIVER_UPDATE: "channelReceiverUpdate",

  // Context Management
  SAIL_BROADCAST_CONTEXT: "sailBroadcastContext",

  // Protocol Event Names
  SAIL_EVENT: "sail_event", // Socket.IO event for all Sail platform messages
  FDC3_EVENT: "fdc3_event", // Socket.IO event for all DACP messages
} as const

// ============================================================================
// SAIL MESSAGE INTERFACE
// ============================================================================

/**
 * Unified Sail message structure following DACP-style format
 * All Sail messages use this consistent structure
 */
export interface SailMessage<TPayload = Record<string, unknown>> {
  /** Message type - matches Sail protocol event name */
  type: (typeof SailMessages)[keyof typeof SailMessages]
  /** Message payload containing actual data */
  payload: TPayload
  /** Message metadata */
  meta: {
    /** Unique identifier for request messages */
    requestUuid?: string
    /** Links response to original request */
    responseUuid?: string
    /** Message timestamp */
    timestamp: string | Date
    /** Source instance/session identifier */
    source?: string
    /** Connection attempt UUID for handshake messages */
    connectionAttemptUuid?: string
  }
}

// ============================================================================
// SAIL MESSAGE PAYLOAD TYPES
// ============================================================================

// Handshake Types
export interface DesktopAgentHelloPayload<T = unknown> {
  directories: string[]
  channels: TabDetail[]
  panels: T[]
  customApps: DirectoryApp[]
  contextHistory: { [id: string]: Context[] }
}

export interface SailClientStatePayload<T = unknown> extends DesktopAgentHelloPayload<T> {
  type: keyof typeof SailMessages
}

export interface AppHelloPayload {
  instanceId: string
  appId: string
  userSessionId?: string
}

// App Management Types
export interface DesktopAgentRegisterAppLaunchPayload {
  appId: string
  hosting: AppHosting
  channel: string | null
  instanceTitle: string
}

export interface DesktopAgentDirectoryListingPayload {
  // Empty payload - request for directory listing
  type: keyof typeof SailMessages
}

export interface SailAppOpenPayload {
  appDRecord: DirectoryApp
  channel: string | null
  approach: AppHosting
}

export interface SailAppOpenResponsePayload {
  instanceId: string
  instanceTitle: string
}

export interface SailAppStatePayload {
  registrations: AppRegistration[]
}

// Intent Resolution Types
export interface AugmentedAppMetadata extends AppMetadata {
  channelData: TabDetail | null
  instanceTitle?: string
}

export interface AugmentedAppIntent {
  intent: IntentMetadata
  apps: AugmentedAppMetadata[]
}

export interface SailIntentResolvePayload {
  appIntents: AugmentedAppIntent[]
  context: Context
  requestId: string
}

export interface SailIntentResolveResponsePayload {
  appIntents: AppIntent[]
  requestId: string
  channel: string | null
  error: string | null
}

export interface SailIntentResolveOpenChannelPayload {
  channel: string
  appId: string
}

// Channel Management Types
export interface SailChannelChangePayload {
  channel: string | null
  instanceId: string
}

export interface ChannelReceiverHelloPayload {
  instanceId: string
  userSessionId?: string
}

export interface ChannelReceiverUpdatePayload {
  tabs: TabDetail[]
}

// Context Management Types
export interface SailBroadcastContextPayload {
  context: Context
  channelId: string
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

// Export specific message types
export const DA_HELLO = SailMessages.DA_HELLO
export const SAIL_CLIENT_STATE = SailMessages.SAIL_CLIENT_STATE
export const APP_HELLO = SailMessages.APP_HELLO
export const SAIL_APP_OPEN = SailMessages.SAIL_APP_OPEN
export const SAIL_APP_STATE = SailMessages.SAIL_APP_STATE
export const CHANNEL_RECEIVER_HELLO = SailMessages.CHANNEL_RECEIVER_HELLO
export const CHANNEL_RECEIVER_UPDATE = SailMessages.CHANNEL_RECEIVER_UPDATE
export const SAIL_INTENT_RESOLVE = SailMessages.SAIL_INTENT_RESOLVE
export const SAIL_EVENT = SailMessages.SAIL_EVENT
export const FDC3_EVENT = SailMessages.FDC3_EVENT

// Type helpers
export type SailMessageType = keyof typeof SailMessages
export type SailHandshakeMessage =
  | typeof SailMessages.DA_HELLO
  | typeof SailMessages.SAIL_CLIENT_STATE
  | typeof SailMessages.APP_HELLO
export type SailAppMessage = typeof SailMessages.SAIL_APP_OPEN | typeof SailMessages.SAIL_APP_STATE
export type SailChannelMessage =
  | typeof SailMessages.SAIL_CHANNEL_SETUP
  | typeof SailMessages.SAIL_CHANNEL_CHANGE
