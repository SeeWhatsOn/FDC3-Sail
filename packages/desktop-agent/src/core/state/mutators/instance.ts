/**
 * Instance Mutators
 *
 * Pure functions that transform instance-related state using Immer.
 */

import { produce } from "immer"
import type { AppMetadata } from "@finos/fdc3"
import type { AgentState, AppInstance } from "../types"
import { AppInstanceState } from "../types"

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
