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
  joinUserChannel,
  addContextListener,
  removeContextListener,
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
  updatePendingIntentTarget,
  resolvePendingIntent,
} from "./intent"

// Channel mutators
export { createAppChannel, removeAppChannel, storeContext, clearChannelContexts } from "./channel"

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
  addPrivateChannelLifecycleCatchAllListener,
  removePrivateChannelLifecycleCatchAllListener,
  setPrivateChannelLastContext,
} from "./private-channel"

// Event mutators
export { addEventListener, removeEventListener, removeEventListenersForInstance } from "./event"

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
  migratePendingOpenWithContextTarget,
} from "./open-with-context"

// App directory mutators
export {
  addApplication,
  addApplications,
  addDirectoryUrl,
  removeDirectoryUrl,
  clearDirectoryUrls,
  loadDirectoryIntoState,
  replaceAppDirectories,
} from "./app-directory"
