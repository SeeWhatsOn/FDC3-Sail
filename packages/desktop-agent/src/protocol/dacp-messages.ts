/**
 * Desktop Agent Communication Protocol (DACP) Message Types
 * FDC3 2.2 Standard Protocol Messages
 */

// ============================================================================
// DACP MESSAGE TYPES
// ============================================================================

/**
 * All DACP message types following FDC3 2.2 specification
 * Event names are camelCase for Socket.IO compatibility
 */
export const DACPMessages = {
  // Context Management
  BROADCAST_REQUEST: "broadcastRequest",
  BROADCAST_RESPONSE: "broadcastResponse",
  ADD_CONTEXT_LISTENER_REQUEST: "addContextListenerRequest",
  ADD_CONTEXT_LISTENER_RESPONSE: "addContextListenerResponse",
  GET_CURRENT_CONTEXT_REQUEST: "getCurrentContextRequest",
  GET_CURRENT_CONTEXT_RESPONSE: "getCurrentContextResponse",

  // Channel Management
  GET_CURRENT_CHANNEL_REQUEST: "getCurrentChannelRequest",
  GET_CURRENT_CHANNEL_RESPONSE: "getCurrentChannelResponse",
  JOIN_USER_CHANNEL_REQUEST: "joinUserChannelRequest",
  JOIN_USER_CHANNEL_RESPONSE: "joinUserChannelResponse",
  LEAVE_CURRENT_CHANNEL_REQUEST: "leaveCurrentChannelRequest",
  LEAVE_CURRENT_CHANNEL_RESPONSE: "leaveCurrentChannelResponse",
  GET_USER_CHANNELS_REQUEST: "getUserChannelsRequest",
  GET_USER_CHANNELS_RESPONSE: "getUserChannelsResponse",
  GET_OR_CREATE_CHANNEL_REQUEST: "getOrCreateChannelRequest",
  GET_OR_CREATE_CHANNEL_RESPONSE: "getOrCreateChannelResponse",

  // Intent Management
  RAISE_INTENT_REQUEST: "raiseIntentRequest",
  RAISE_INTENT_RESPONSE: "raiseIntentResponse",
  RAISE_INTENT_FOR_CONTEXT_REQUEST: "raiseIntentForContextRequest",
  RAISE_INTENT_FOR_CONTEXT_RESPONSE: "raiseIntentForContextResponse",
  ADD_INTENT_LISTENER_REQUEST: "addIntentListenerRequest",
  ADD_INTENT_LISTENER_RESPONSE: "addIntentListenerResponse",
  FIND_INTENT_REQUEST: "findIntentRequest",
  FIND_INTENT_RESPONSE: "findIntentResponse",
  FIND_INTENTS_BY_CONTEXT_REQUEST: "findIntentsByContextRequest",
  FIND_INTENTS_BY_CONTEXT_RESPONSE: "findIntentsByContextResponse",

  // App Management
  GET_INFO_REQUEST: "getInfoRequest",
  GET_INFO_RESPONSE: "getInfoResponse",
  OPEN_REQUEST: "openRequest",
  OPEN_RESPONSE: "openResponse",
  FIND_INSTANCES_REQUEST: "findInstancesRequest",
  FIND_INSTANCES_RESPONSE: "findInstancesResponse",
  GET_APP_METADATA_REQUEST: "getAppMetadataRequest",
  GET_APP_METADATA_RESPONSE: "getAppMetadataResponse",

  // Private Channels
  CREATE_PRIVATE_CHANNEL_REQUEST: "createPrivateChannelRequest",
  CREATE_PRIVATE_CHANNEL_RESPONSE: "createPrivateChannelResponse",
  PRIVATE_CHANNEL_DISCONNECT_REQUEST: "privateChannelDisconnectRequest",
  PRIVATE_CHANNEL_DISCONNECT_RESPONSE: "privateChannelDisconnectResponse",

  // Event Messages
  CONTEXT_EVENT: "contextEvent",
  INTENT_EVENT: "intentEvent",
  LISTENER_EVENT: "listenerEvent",

  // Connection Protocol (WCP over DACP)
  WCP_HELLO: "wcpHello",
  WCP_HANDSHAKE: "wcpHandshake",
  WCP_VALIDATE_APP_IDENTITY: "wcpValidateAppIdentity",
  WCP_GOODBYE: "wcpGoodbye",
} as const

// ============================================================================
// DACP MESSAGE INTERFACE
// ============================================================================

/**
 * Standard DACP message structure following FDC3 specification
 * All DACP messages must conform to this structure
 */
export interface DACPMessage<TPayload = Record<string, any>> {
  /** Message type - matches DACP specification */
  type: keyof typeof DACPMessages | string
  /** Message payload containing request/response data */
  payload: TPayload
  /** Message metadata */
  meta: {
    /** Unique identifier for request messages */
    requestUuid?: string
    /** Links response to original request */
    responseUuid?: string
    /** Message timestamp */
    timestamp: string | Date
    /** Source instance identifier */
    source?: string
    /** Connection attempt UUID for WCP messages */
    connectionAttemptUuid?: string
  }
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

// Export specific message types for easy access
export const BROADCAST_REQUEST = DACPMessages.BROADCAST_REQUEST
export const BROADCAST_RESPONSE = DACPMessages.BROADCAST_RESPONSE
export const RAISE_INTENT_REQUEST = DACPMessages.RAISE_INTENT_REQUEST
export const RAISE_INTENT_RESPONSE = DACPMessages.RAISE_INTENT_RESPONSE
export const GET_CURRENT_CHANNEL_REQUEST = DACPMessages.GET_CURRENT_CHANNEL_REQUEST
export const GET_CURRENT_CHANNEL_RESPONSE = DACPMessages.GET_CURRENT_CHANNEL_RESPONSE
export const ADD_CONTEXT_LISTENER_REQUEST = DACPMessages.ADD_CONTEXT_LISTENER_REQUEST
export const ADD_CONTEXT_LISTENER_RESPONSE = DACPMessages.ADD_CONTEXT_LISTENER_RESPONSE
export const GET_INFO_REQUEST = DACPMessages.GET_INFO_REQUEST
export const GET_INFO_RESPONSE = DACPMessages.GET_INFO_RESPONSE
export const CONTEXT_EVENT = DACPMessages.CONTEXT_EVENT
export const INTENT_EVENT = DACPMessages.INTENT_EVENT

// Type helpers
export type DACPMessageType = keyof typeof DACPMessages
export type DACPRequestType = DACPMessageType extends `${infer T}Request` ? `${T}Request` : never
export type DACPResponseType = DACPMessageType extends `${infer T}Response` ? `${T}Response` : never
export type DACPEventType = DACPMessageType extends `${infer T}Event` ? `${T}Event` : never