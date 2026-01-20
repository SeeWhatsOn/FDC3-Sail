/**
 * State Selectors
 *
 * Pure functions for querying state. All selectors take `AgentState` as the first
 * parameter and return derived data. No side effects, no mutations.
 */

import type { Context, BrowserTypes } from "@finos/fdc3"
import type {
  AgentState,
  AppInstance,
  IntentListener,
  PendingIntent,
  IntentResolution,
  PrivateChannel,
  StoredContext,
  EventListener,
  HeartbeatState,
} from "./types"
import { AppInstanceState } from "./types"

type Channel = BrowserTypes.Channel

// ============================================================================
// INSTANCE SELECTORS
// ============================================================================

export const getInstance = (state: AgentState, instanceId: string): AppInstance | undefined =>
  state.instances[instanceId]

export const getAllInstances = (state: AgentState): AppInstance[] =>
  Object.values(state.instances)

export const getInstancesByAppId = (state: AgentState, appId: string): AppInstance[] =>
  Object.values(state.instances).filter(i => i.appId === appId)

export const getInstancesOnChannel = (state: AgentState, channelId: string): AppInstance[] =>
  Object.values(state.instances).filter(i => i.currentChannel === channelId)

export const getConnectedInstances = (state: AgentState): AppInstance[] =>
  Object.values(state.instances).filter(i => i.state === AppInstanceState.CONNECTED)

export const getInstancesByState = (
  state: AgentState,
  instanceState: AppInstanceState | AppInstanceState[]
): AppInstance[] => {
  const states = Array.isArray(instanceState) ? instanceState : [instanceState]
  return Object.values(state.instances).filter(i => states.includes(i.state))
}

export const getInstancesWithContextListener = (
  state: AgentState,
  contextType: string
): AppInstance[] =>
  Object.values(state.instances).filter(i => i.contextListeners.includes(contextType))

export const getInstancesWithIntentListener = (
  state: AgentState,
  intentName: string
): AppInstance[] =>
  Object.values(state.instances).filter(i => i.intentListeners.includes(intentName))

export const getInstancesWithPrivateChannel = (
  state: AgentState,
  channelId: string
): AppInstance[] =>
  Object.values(state.instances).filter(i => i.privateChannels.includes(channelId))

// ============================================================================
// INTENT SELECTORS
// ============================================================================

export const getIntentListener = (
  state: AgentState,
  listenerId: string
): IntentListener | undefined => state.intents.listeners[listenerId]

export const getAllIntentListeners = (state: AgentState): IntentListener[] =>
  Object.values(state.intents.listeners)

export const getActiveListenersForIntent = (
  state: AgentState,
  intentName: string
): IntentListener[] =>
  Object.values(state.intents.listeners).filter(
    l => l.intentName === intentName && l.active
  )

export const getListenersForInstance = (
  state: AgentState,
  instanceId: string
): IntentListener[] =>
  Object.values(state.intents.listeners).filter(l => l.instanceId === instanceId)

export const getListenersForApp = (state: AgentState, appId: string): IntentListener[] =>
  Object.values(state.intents.listeners).filter(l => l.appId === appId)

export const getListenersForContextType = (
  state: AgentState,
  contextType: string
): IntentListener[] =>
  Object.values(state.intents.listeners).filter(
    l => l.contextTypes.length === 0 || l.contextTypes.includes(contextType)
  )

export const getPendingIntent = (
  state: AgentState,
  requestId: string
): PendingIntent | undefined => state.intents.pending[requestId]

export const getAllPendingIntents = (state: AgentState): PendingIntent[] =>
  Object.values(state.intents.pending)

export const getIntentResolution = (
  state: AgentState,
  requestId: string
): IntentResolution | undefined => state.intents.history[requestId]

export const getAllIntentResolutions = (state: AgentState): IntentResolution[] =>
  Object.values(state.intents.history)

// ============================================================================
// CHANNEL SELECTORS
// ============================================================================

export const getUserChannel = (state: AgentState, channelId: string): Channel | undefined =>
  state.channels.user[channelId]

export const getAllUserChannels = (state: AgentState): Channel[] =>
  Object.values(state.channels.user)

export const getAppChannel = (state: AgentState, channelId: string): Channel | undefined =>
  state.channels.app[channelId]

export const getAllAppChannels = (state: AgentState): Channel[] =>
  Object.values(state.channels.app)

export const getPrivateChannel = (
  state: AgentState,
  channelId: string
): PrivateChannel | undefined => state.channels.private[channelId]

export const getAllPrivateChannels = (state: AgentState): PrivateChannel[] =>
  Object.values(state.channels.private)

export const getChannelContext = (
  state: AgentState,
  channelId: string,
  contextType?: string
): Context | null => {
  const channelContexts = state.channels.contexts[channelId]
  if (!channelContexts) return null

  if (contextType) {
    return channelContexts[contextType]?.context ?? null
  }

  // Return most recent context
  const allContexts = Object.values(channelContexts)
  if (allContexts.length === 0) return null
  return allContexts.reduce((latest, current) =>
    current.timestamp > latest.timestamp ? current : latest
  ).context
}

export const getStoredContext = (
  state: AgentState,
  channelId: string,
  contextType: string
): StoredContext | null => {
  const channelContexts = state.channels.contexts[channelId]
  if (!channelContexts) return null
  return channelContexts[contextType] ?? null
}

export const getChannelContextTypes = (state: AgentState, channelId: string): string[] => {
  const channelContexts = state.channels.contexts[channelId]
  if (!channelContexts) return []
  return Object.keys(channelContexts)
}

export const hasChannelContext = (state: AgentState, channelId: string): boolean => {
  const channelContexts = state.channels.contexts[channelId]
  return channelContexts !== undefined && Object.keys(channelContexts).length > 0
}

// ============================================================================
// EVENT SELECTORS
// ============================================================================

export const getEventListener = (
  state: AgentState,
  listenerId: string
): EventListener | undefined => state.events.listeners[listenerId]

export const getAllEventListeners = (state: AgentState): EventListener[] =>
  Object.values(state.events.listeners)

export const getEventListenersForType = (state: AgentState, eventType: string): string[] =>
  state.events.byEventType[eventType] ?? []

export const getEventListenersForInstance = (
  state: AgentState,
  instanceId: string
): EventListener[] =>
  Object.values(state.events.listeners).filter(l => l.instanceId === instanceId)

// ============================================================================
// HEARTBEAT SELECTORS
// ============================================================================

export const getHeartbeatState = (
  state: AgentState,
  instanceId: string
): HeartbeatState | undefined => state.heartbeats[instanceId]

export const getAllHeartbeatStates = (state: AgentState): HeartbeatState[] =>
  Object.values(state.heartbeats)

// ============================================================================
// STATS SELECTORS
// ============================================================================

export const getStats = (state: AgentState) => ({
  instances: Object.keys(state.instances).length,
  connectedInstances: getConnectedInstances(state).length,
  intentListeners: Object.keys(state.intents.listeners).length,
  pendingIntents: Object.keys(state.intents.pending).length,
  intentResolutions: Object.keys(state.intents.history).length,
  userChannels: Object.keys(state.channels.user).length,
  appChannels: Object.keys(state.channels.app).length,
  privateChannels: Object.keys(state.channels.private).length,
  eventListeners: Object.keys(state.events.listeners).length,
  heartbeats: Object.keys(state.heartbeats).length,
})
