/**
 * Channel Mutators
 *
 * Pure functions that transform channel-related state using Immer.
 */

import { produce } from "immer"
import type { Context } from "@finos/fdc3"
import type { AgentState } from "../types"

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
