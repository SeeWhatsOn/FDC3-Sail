/**
 * Desktop Agent Communication Protocol (DACP) Message Types
 * FDC3 2.2 Standard Protocol Messages
 */

/**
 * Union type of all DACP request message types
 * These are the request messages that follow FDC3 2.2 specification
 */
export type DACPRequestType =
  | "broadcastRequest"
  | "addContextListenerRequest"
  | "contextListenerUnsubscribeRequest"
  | "getCurrentContextRequest"
  | "getCurrentChannelRequest"
  | "joinUserChannelRequest"
  | "leaveCurrentChannelRequest"
  | "getUserChannelsRequest"
  | "getOrCreateChannelRequest"
  | "raiseIntentRequest"
  | "raiseIntentForContextRequest"
  | "addIntentListenerRequest"
  | "intentListenerUnsubscribeRequest"
  | "findIntentRequest"
  | "findIntentsByContextRequest"
  | "getInfoRequest"
  | "openRequest"
  | "findInstancesRequest"
  | "getAppMetadataRequest"
  | "createPrivateChannelRequest"
  | "privateChannelDisconnectRequest"
  | "addEventListenerRequest"
  | "eventListenerUnsubscribeRequest"

/**
 * Union type of all DACP response message types
 * These are the response messages that follow FDC3 2.2 specification
 */
export type DACPResponseType =
  | "broadcastResponse"
  | "addContextListenerResponse"
  | "contextListenerUnsubscribeResponse"
  | "getCurrentContextResponse"
  | "getCurrentChannelResponse"
  | "joinUserChannelResponse"
  | "leaveCurrentChannelResponse"
  | "getUserChannelsResponse"
  | "getOrCreateChannelResponse"
  | "raiseIntentResponse"
  | "raiseIntentForContextResponse"
  | "addIntentListenerResponse"
  | "intentListenerUnsubscribeResponse"
  | "findIntentResponse"
  | "findIntentsByContextResponse"
  | "getInfoResponse"
  | "openResponse"
  | "findInstancesResponse"
  | "getAppMetadataResponse"
  | "createPrivateChannelResponse"
  | "privateChannelDisconnectResponse"
  | "addEventListenerResponse"
  | "eventListenerUnsubscribeResponse"

/**
 * Union type of all DACP event message types
 * These are the event messages that follow FDC3 2.2 specification
 */
export type DACPEventType =
  | "intentEvent"
  | "broadcastEvent"
  | "channelChangedEvent"
  | "heartbeatEvent"
  | "privateChannelDisconnectEvent"
  | "privateChannelUnsubscribeEvent"
  | "privateChannelAddContextListenerEvent"

/**
 * Union type of all DACP message types (requests, responses, and events)
 */
export type DACPMessageType = DACPRequestType | DACPResponseType | DACPEventType
