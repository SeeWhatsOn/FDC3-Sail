/**
 * Initial State Factory
 *
 * Creates the default agent state with all required structures initialized.
 */

import type { AgentState } from "./types"
import type { BrowserTypes } from "@finos/fdc3"

type Channel = BrowserTypes.Channel

/**
 * Default FDC3 user channels (fdc3.channel.1 through fdc3.channel.8)
 */
export const DEFAULT_USER_CHANNELS: Channel[] = [
  {
    id: "fdc3.channel.1",
    type: "user",
    displayMetadata: {
      name: "Channel 1",
      color: "#FF0000",
      glyph: "1",
    },
  },
  {
    id: "fdc3.channel.2",
    type: "user",
    displayMetadata: {
      name: "Channel 2",
      color: "#FF8800",
      glyph: "2",
    },
  },
  {
    id: "fdc3.channel.3",
    type: "user",
    displayMetadata: {
      name: "Channel 3",
      color: "#FFFF00",
      glyph: "3",
    },
  },
  {
    id: "fdc3.channel.4",
    type: "user",
    displayMetadata: {
      name: "Channel 4",
      color: "#00FF00",
      glyph: "4",
    },
  },
  {
    id: "fdc3.channel.5",
    type: "user",
    displayMetadata: {
      name: "Channel 5",
      color: "#00FFFF",
      glyph: "5",
    },
  },
  {
    id: "fdc3.channel.6",
    type: "user",
    displayMetadata: {
      name: "Channel 6",
      color: "#0000FF",
      glyph: "6",
    },
  },
  {
    id: "fdc3.channel.7",
    type: "user",
    displayMetadata: {
      name: "Channel 7",
      color: "#FF00FF",
      glyph: "7",
    },
  },
  {
    id: "fdc3.channel.8",
    type: "user",
    displayMetadata: {
      name: "Channel 8",
      color: "#800080",
      glyph: "8",
    },
  },
]

/**
 * Creates the initial agent state with default values.
 * @param userChannels - Custom user channels (optional, defaults to FDC3 standard channels)
 */
export function createInitialState(userChannels?: Channel[]): AgentState {
  const channels = userChannels ?? DEFAULT_USER_CHANNELS

  return {
    instances: {},
    intents: {
      listeners: {},
      pending: {},
      history: {},
    },
    channels: {
      user: Object.fromEntries(channels.map(c => [c.id, c])),
      app: {},
      private: {},
      contexts: {},
    },
    events: {
      listeners: {},
      byEventType: {},
    },
    heartbeats: {},
  }
}

/**
 * Merges partial state into initial state (for testing/initialization).
 */
export function createStateWithOverrides(overrides: Partial<AgentState>): AgentState {
  const initial = createInitialState()
  return {
    ...initial,
    ...overrides,
    intents: {
      ...initial.intents,
      ...overrides.intents,
    },
    channels: {
      ...initial.channels,
      ...overrides.channels,
    },
    events: {
      ...initial.events,
      ...overrides.events,
    },
  }
}
