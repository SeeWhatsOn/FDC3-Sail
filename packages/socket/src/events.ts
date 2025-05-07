// events.ts
// Re-export all event constants from FDC3-Sail common
export {
  DA_HELLO,
  APP_HELLO,
  DA_DIRECTORY_LISTING,
  DA_REGISTER_APP_LAUNCH,
  FDC3_APP_EVENT,
  SAIL_CHANNEL_CHANGE,
  SAIL_APP_STATE,
  SAIL_CLIENT_STATE,
  CHANNEL_RECEIVER_UPDATE,
  CHANNEL_RECEIVER_HELLO,
  SAIL_INTENT_RESOLVE_ON_CHANNEL,
  ELECTRON_HELLO,
} from "@finos/fdc3-sail-common"

// Add any additional server-specific events
export const SERVER_READY = "server:ready"
export const SESSION_EXPIRED = "session:expired"
