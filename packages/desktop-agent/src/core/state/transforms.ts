/**
 * State Transforms
 *
 * Pure functions that transform state using Immer. Each function takes current state
 * and returns new state. All mutations are done through Immer's `produce()` function.
 */

import { produce } from "immer"
import type { AppMetadata, Context } from "@finos/fdc3"
import type {
  AgentState,
  AppInstance,
  IntentListener,
  PendingIntent,
  IntentResolution,
  PrivateChannel,
  ContextListener,
  DisconnectListener,
  EventListener,
  HeartbeatState,
} from "./types"
import { AppInstanceState } from "./types"

// ============================================================================
// INSTANCE TRANSFORMS
// ============================================================================

export const connectInstance = (
  state: AgentState,
  params: { instanceId: string; appId: string; metadata: AppMetadata; instanceMetadata?: AppInstance["instanceMetadata"] }
): AgentState => {
  if (state.instances[params.instanceId]) {
    throw new Error(`Instance ${params.instanceId} already exists`)
  }

  return produce(state, draft => {
    const now = new Date()
    draft.instances[params.instanceId] = {
      instanceId: params.instanceId,
      appId: params.appId,
      metadata: params.metadata,
      state: AppInstanceState.PENDING,
      createdAt: now,
      lastActivity: now,
      currentChannel: null,
      contextListeners: [],
      intentListeners: [],
      privateChannels: [],
      instanceMetadata: params.instanceMetadata,
    }
  })
}

export const updateInstanceState = (
  state: AgentState,
  instanceId: string,
  instanceState: AppInstanceState
): AgentState => {
  if (!state.instances[instanceId]) return state

  return produce(state, draft => {
    draft.instances[instanceId].state = instanceState
    draft.instances[instanceId].lastActivity = new Date()
  })
}

export const updateInstanceActivity = (state: AgentState, instanceId: string): AgentState => {
  if (!state.instances[instanceId]) return state

  return produce(state, draft => {
    draft.instances[instanceId].lastActivity = new Date()
  })
}

export const removeInstance = (state: AgentState, instanceId: string): AgentState => {
  if (!state.instances[instanceId]) return state

  return produce(state, draft => {
    delete draft.instances[instanceId]
  })
}

export const joinChannel = (
  state: AgentState,
  instanceId: string,
  channelId: string | null
): AgentState => {
  if (!state.instances[instanceId]) return state

  return produce(state, draft => {
    draft.instances[instanceId].currentChannel = channelId
    draft.instances[instanceId].lastActivity = new Date()
  })
}

export const addContextListener = (
  state: AgentState,
  instanceId: string,
  contextType: string
): AgentState => {
  if (!state.instances[instanceId]) return state

  return produce(state, draft => {
    const instance = draft.instances[instanceId]
    if (!instance.contextListeners.includes(contextType)) {
      instance.contextListeners.push(contextType)
    }
    instance.lastActivity = new Date()
  })
}

export const removeContextListener = (
  state: AgentState,
  instanceId: string,
  contextType: string
): AgentState => {
  if (!state.instances[instanceId]) return state

  return produce(state, draft => {
    const instance = draft.instances[instanceId]
    instance.contextListeners = instance.contextListeners.filter(ct => ct !== contextType)
    instance.lastActivity = new Date()
  })
}

export const addIntentListener = (
  state: AgentState,
  instanceId: string,
  intentName: string
): AgentState => {
  if (!state.instances[instanceId]) return state

  return produce(state, draft => {
    const instance = draft.instances[instanceId]
    if (!instance.intentListeners.includes(intentName)) {
      instance.intentListeners.push(intentName)
    }
    instance.lastActivity = new Date()
  })
}

export const removeIntentListener = (
  state: AgentState,
  instanceId: string,
  intentName: string
): AgentState => {
  if (!state.instances[instanceId]) return state

  return produce(state, draft => {
    const instance = draft.instances[instanceId]
    instance.intentListeners = instance.intentListeners.filter(intent => intent !== intentName)
    instance.lastActivity = new Date()
  })
}

export const addPrivateChannel = (
  state: AgentState,
  instanceId: string,
  channelId: string
): AgentState => {
  if (!state.instances[instanceId]) return state

  return produce(state, draft => {
    const instance = draft.instances[instanceId]
    if (!instance.privateChannels.includes(channelId)) {
      instance.privateChannels.push(channelId)
    }
    instance.lastActivity = new Date()
  })
}

export const removePrivateChannel = (
  state: AgentState,
  instanceId: string,
  channelId: string
): AgentState => {
  if (!state.instances[instanceId]) return state

  return produce(state, draft => {
    const instance = draft.instances[instanceId]
    instance.privateChannels = instance.privateChannels.filter(pc => pc !== channelId)
    instance.lastActivity = new Date()
  })
}

// ============================================================================
// INTENT TRANSFORMS
// ============================================================================

export const registerIntentListener = (
  state: AgentState,
  listener: Omit<IntentListener, "registeredAt" | "lastActivity" | "active">
): AgentState => {
  if (state.intents.listeners[listener.listenerId]) {
    throw new Error(`Listener ${listener.listenerId} already exists`)
  }

  return produce(state, draft => {
    const now = new Date()
    draft.intents.listeners[listener.listenerId] = {
      ...listener,
      registeredAt: now,
      lastActivity: now,
      active: true,
    }
  })
}

export const unregisterIntentListener = (
  state: AgentState,
  listenerId: string
): AgentState => {
  if (!state.intents.listeners[listenerId]) return state

  return produce(state, draft => {
    delete draft.intents.listeners[listenerId]
  })
}

export const removeListenersForInstance = (
  state: AgentState,
  instanceId: string
): AgentState => {
  const toRemove = Object.values(state.intents.listeners)
    .filter(l => l.instanceId === instanceId)
    .map(l => l.listenerId)

  if (toRemove.length === 0) return state

  return produce(state, draft => {
    toRemove.forEach(id => delete draft.intents.listeners[id])
  })
}

export const updateIntentListenerActivity = (
  state: AgentState,
  listenerId: string
): AgentState => {
  if (!state.intents.listeners[listenerId]) return state

  return produce(state, draft => {
    draft.intents.listeners[listenerId].lastActivity = new Date()
  })
}

export const setIntentListenerActive = (
  state: AgentState,
  listenerId: string,
  active: boolean
): AgentState => {
  if (!state.intents.listeners[listenerId]) return state

  return produce(state, draft => {
    draft.intents.listeners[listenerId].active = active
    draft.intents.listeners[listenerId].lastActivity = new Date()
  })
}

export const addPendingIntent = (
  state: AgentState,
  pending: Omit<PendingIntent, "raisedAt">
): AgentState => {
  return produce(state, draft => {
    draft.intents.pending[pending.requestId] = {
      ...pending,
      raisedAt: new Date(),
    }
  })
}

export const resolvePendingIntent = (state: AgentState, requestId: string): AgentState => {
  if (!state.intents.pending[requestId]) return state

  return produce(state, draft => {
    delete draft.intents.pending[requestId]
  })
}

export const recordIntentResolution = (
  state: AgentState,
  resolution: Omit<IntentResolution, "resolvedAt">
): AgentState => {
  return produce(state, draft => {
    draft.intents.history[resolution.requestId] = {
      ...resolution,
      resolvedAt: new Date(),
    }
  })
}

// ============================================================================
// CHANNEL TRANSFORMS
// ============================================================================

export const createAppChannel = (
  state: AgentState,
  channelId: string,
  displayName?: string
): AgentState => {
  if (state.channels.app[channelId]) return state

  return produce(state, draft => {
    draft.channels.app[channelId] = {
      id: channelId,
      type: "app",
      displayMetadata: {
        name: displayName ?? channelId,
      },
    }
  })
}

export const removeAppChannel = (state: AgentState, channelId: string): AgentState => {
  if (!state.channels.app[channelId]) return state

  return produce(state, draft => {
    delete draft.channels.app[channelId]
  })
}

export const storeContext = (
  state: AgentState,
  channelId: string,
  context: Context,
  sourceInstanceId: string
): AgentState => {
  return produce(state, draft => {
    if (!draft.channels.contexts[channelId]) {
      draft.channels.contexts[channelId] = {}
    }
    draft.channels.contexts[channelId][context.type] = {
      context,
      timestamp: Date.now(),
      sourceInstanceId,
    }
  })
}

export const clearChannelContexts = (state: AgentState, channelId: string): AgentState => {
  if (!state.channels.contexts[channelId]) return state

  return produce(state, draft => {
    delete draft.channels.contexts[channelId]
  })
}

// ============================================================================
// PRIVATE CHANNEL TRANSFORMS
// ============================================================================

export const createPrivateChannel = (
  state: AgentState,
  channelId: string,
  creatorAppId: string,
  creatorInstanceId: string
): AgentState => {
  if (state.channels.private[channelId]) return state

  return produce(state, draft => {
    draft.channels.private[channelId] = {
      id: channelId,
      type: "private",
      creatorAppId,
      creatorInstanceId,
      createdAt: new Date(),
      connectedInstances: [creatorInstanceId],
      contextListeners: {},
      disconnectListeners: {},
      lastContextByType: {},
      displayMetadata: {
        name: channelId,
      },
    }
  })
}

export const connectInstanceToPrivateChannel = (
  state: AgentState,
  channelId: string,
  instanceId: string
): AgentState => {
  const channel = state.channels.private[channelId]
  if (!channel) return state
  if (channel.connectedInstances.includes(instanceId)) return state

  return produce(state, draft => {
    const privateChannel = draft.channels.private[channelId]
    if (privateChannel) {
      privateChannel.connectedInstances.push(instanceId)
    }
  })
}

export const disconnectInstanceFromPrivateChannel = (
  state: AgentState,
  channelId: string,
  instanceId: string
): AgentState => {
  const channel = state.channels.private[channelId]
  if (!channel) return state

  return produce(state, draft => {
    const privateChannel = draft.channels.private[channelId]
    if (!privateChannel) return

    privateChannel.connectedInstances = privateChannel.connectedInstances.filter(
      id => id !== instanceId
    )

    // Remove listeners for this instance
    Object.keys(privateChannel.contextListeners).forEach(listenerId => {
      if (privateChannel.contextListeners[listenerId]?.instanceId === instanceId) {
        delete privateChannel.contextListeners[listenerId]
      }
    })

    Object.keys(privateChannel.disconnectListeners).forEach(listenerId => {
      if (privateChannel.disconnectListeners[listenerId]?.instanceId === instanceId) {
        delete privateChannel.disconnectListeners[listenerId]
      }
    })

    // Remove channel if no more connections or creator disconnected
    if (
      privateChannel.connectedInstances.length === 0 ||
      !privateChannel.connectedInstances.includes(privateChannel.creatorInstanceId)
    ) {
      delete draft.channels.private[channelId]
    }
  })
}

export const addPrivateChannelContextListener = (
  state: AgentState,
  channelId: string,
  listenerId: string,
  instanceId: string,
  contextType: string | null
): AgentState => {
  const channel = state.channels.private[channelId]
  if (!channel) return state
  if (!channel.connectedInstances.includes(instanceId)) return state

  return produce(state, draft => {
    const privateChannel = draft.channels.private[channelId]
    if (privateChannel) {
      privateChannel.contextListeners[listenerId] = {
        listenerId,
        instanceId,
        contextType,
      }
    }
  })
}

export const removePrivateChannelContextListener = (
  state: AgentState,
  channelId: string,
  listenerId: string
): AgentState => {
  const channel = state.channels.private[channelId]
  if (!channel) return state

  return produce(state, draft => {
    const privateChannel = draft.channels.private[channelId]
    if (privateChannel) {
      delete privateChannel.contextListeners[listenerId]
    }
  })
}

export const addPrivateChannelDisconnectListener = (
  state: AgentState,
  channelId: string,
  listenerId: string,
  instanceId: string
): AgentState => {
  const channel = state.channels.private[channelId]
  if (!channel) return state
  if (!channel.connectedInstances.includes(instanceId)) return state

  return produce(state, draft => {
    const privateChannel = draft.channels.private[channelId]
    if (privateChannel) {
      privateChannel.disconnectListeners[listenerId] = {
        listenerId,
        instanceId,
      }
    }
  })
}

export const removePrivateChannelDisconnectListener = (
  state: AgentState,
  channelId: string,
  listenerId: string
): AgentState => {
  const channel = state.channels.private[channelId]
  if (!channel) return state

  return produce(state, draft => {
    const privateChannel = draft.channels.private[channelId]
    if (privateChannel) {
      delete privateChannel.disconnectListeners[listenerId]
    }
  })
}

export const setPrivateChannelLastContext = (
  state: AgentState,
  channelId: string,
  contextType: string,
  context: Context
): AgentState => {
  const channel = state.channels.private[channelId]
  if (!channel) return state

  return produce(state, draft => {
    const privateChannel = draft.channels.private[channelId]
    if (privateChannel) {
      privateChannel.lastContextByType[contextType] = context
    }
  })
}

// ============================================================================
// EVENT TRANSFORMS
// ============================================================================

export const addEventListener = (
  state: AgentState,
  listener: EventListener
): AgentState => {
  return produce(state, draft => {
    draft.events.listeners[listener.listenerId] = listener

    if (!draft.events.byEventType[listener.eventType]) {
      draft.events.byEventType[listener.eventType] = []
    }
    if (!draft.events.byEventType[listener.eventType].includes(listener.listenerId)) {
      draft.events.byEventType[listener.eventType].push(listener.listenerId)
    }
  })
}

export const removeEventListener = (state: AgentState, listenerId: string): AgentState => {
  const listener = state.events.listeners[listenerId]
  if (!listener) return state

  return produce(state, draft => {
    // Remove from byEventType index
    const typeListeners = draft.events.byEventType[listener.eventType]
    if (typeListeners) {
      draft.events.byEventType[listener.eventType] = typeListeners.filter(
        id => id !== listenerId
      )
      // Clean up empty arrays
      if (draft.events.byEventType[listener.eventType].length === 0) {
        delete draft.events.byEventType[listener.eventType]
      }
    }

    delete draft.events.listeners[listenerId]
  })
}

export const removeEventListenersForInstance = (
  state: AgentState,
  instanceId: string
): AgentState => {
  const toRemove = Object.values(state.events.listeners)
    .filter(l => l.instanceId === instanceId)
    .map(l => l.listenerId)

  if (toRemove.length === 0) return state

  return produce(state, draft => {
    toRemove.forEach(listenerId => {
      const listener = draft.events.listeners[listenerId]
      if (listener) {
        // Remove from byEventType index
        const typeListeners = draft.events.byEventType[listener.eventType]
        if (typeListeners) {
          draft.events.byEventType[listener.eventType] = typeListeners.filter(
            id => id !== listenerId
          )
          if (draft.events.byEventType[listener.eventType].length === 0) {
            delete draft.events.byEventType[listener.eventType]
          }
        }
      }
      delete draft.events.listeners[listenerId]
    })
  })
}

// ============================================================================
// HEARTBEAT TRANSFORMS
// ============================================================================

export const startHeartbeat = (state: AgentState, instanceId: string): AgentState => {
  return produce(state, draft => {
    const now = Date.now()
    draft.heartbeats[instanceId] = {
      instanceId,
      lastHeartbeatSent: now,
      lastAcknowledgmentReceived: now,
      missedHeartbeats: 0,
    }
  })
}

export const acknowledgeHeartbeat = (state: AgentState, instanceId: string): AgentState => {
  if (!state.heartbeats[instanceId]) return state

  return produce(state, draft => {
    draft.heartbeats[instanceId].lastAcknowledgmentReceived = Date.now()
    draft.heartbeats[instanceId].missedHeartbeats = 0
  })
}

export const updateHeartbeatSent = (state: AgentState, instanceId: string): AgentState => {
  if (!state.heartbeats[instanceId]) return state

  return produce(state, draft => {
    draft.heartbeats[instanceId].lastHeartbeatSent = Date.now()
    draft.heartbeats[instanceId].missedHeartbeats += 1
  })
}

export const stopHeartbeat = (state: AgentState, instanceId: string): AgentState => {
  if (!state.heartbeats[instanceId]) return state

  return produce(state, draft => {
    delete draft.heartbeats[instanceId]
  })
}
