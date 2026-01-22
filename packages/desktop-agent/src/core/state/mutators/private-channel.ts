/**
 * Private Channel Mutators
 *
 * Pure functions that transform private channel-related state using Immer.
 */

import { produce } from "immer"
import type { Context } from "@finos/fdc3"
import type { AgentState } from "../types"

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
