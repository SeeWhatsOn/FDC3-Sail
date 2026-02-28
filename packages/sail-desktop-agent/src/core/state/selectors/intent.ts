/**
 * Intent Selectors
 *
 * Pure functions for querying intent-related state.
 */

import type { AgentState, IntentListener, PendingIntent, IntentResolutionRecord } from "../types"

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
  Object.values(state.intents.listeners).filter(l => l.intentName === intentName && l.active)

export const getListenersForInstance = (state: AgentState, instanceId: string): IntentListener[] =>
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

export const getPendingIntent = (state: AgentState, requestId: string): PendingIntent | undefined =>
  state.intents.pending[requestId]

export const getAllPendingIntents = (state: AgentState): PendingIntent[] =>
  Object.values(state.intents.pending)

export const getIntentResolution = (
  state: AgentState,
  requestId: string
): IntentResolutionRecord | undefined => state.intents.history[requestId]

export const getAllIntentResolutions = (state: AgentState): IntentResolutionRecord[] =>
  Object.values(state.intents.history)
