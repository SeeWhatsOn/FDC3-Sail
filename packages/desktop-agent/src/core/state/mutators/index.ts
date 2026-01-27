/**
 * Mutators Index
 *
 * Re-exports all mutator functions for convenient importing.
 */

// Instance mutators
export {
  connectInstance,
  updateInstanceState,
  updateInstanceActivity,
  removeInstance,
  joinChannel,
  addContextListener,
  removeContextListener,
  addIntentListener,
  removeIntentListener,
  addPrivateChannel,
  removePrivateChannel,
} from "./instance"

// Intent mutators
export {
  registerIntentListener,
  unregisterIntentListener,
  removeListenersForInstance,
  updateIntentListenerActivity,
  setIntentListenerActive,
  addPendingIntent,
  resolvePendingIntent,
  recordIntentResolution,
} from "./intent"

// Channel mutators
export {
  createAppChannel,
  removeAppChannel,
  storeContext,
  clearChannelContexts,
} from "./channel"

// Private channel mutators
export {
  createPrivateChannel,
  connectInstanceToPrivateChannel,
  disconnectInstanceFromPrivateChannel,
  addPrivateChannelContextListener,
  addPrivateChannelAddContextListenerListener,
  removePrivateChannelAddContextListenerListener,
  addPrivateChannelUnsubscribeListener,
  removePrivateChannelUnsubscribeListener,
  removePrivateChannelContextListener,
  addPrivateChannelDisconnectListener,
  removePrivateChannelDisconnectListener,
  setPrivateChannelLastContext,
} from "./private-channel"

// Event mutators
export {
  addEventListener,
  removeEventListener,
  removeEventListenersForInstance,
} from "./event"

// Heartbeat mutators
export {
  startHeartbeat,
  acknowledgeHeartbeat,
  updateHeartbeatSent,
  stopHeartbeat,
} from "./heartbeat"

// Open-with-context mutators
export {
  addPendingOpenWithContext,
  setPendingOpenWithContextForInstance,
  removePendingOpenWithContextByRequest,
} from "./open-with-context"
