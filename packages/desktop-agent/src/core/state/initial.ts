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
const defaultUserChannels: Channel[] = [
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
  const channels = userChannels ?? defaultUserChannels

  return {
    instances: {},
    intents: {
      listeners: {},
      pending: {},
      history: {},
    },
    channels: {
      user: Object.fromEntries(channels.map(channel => [channel.id, channel])),
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
  return deepMerge(createInitialState(), overrides)
}

/**
 * Deep merges source into target, recursively merging nested objects.
 * Arrays and non-object values from source replace target values.
 * This could be replaced with a more robust merge function from lodash if needed.
 */
function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const result = { ...target }
  for (const key of Object.keys(source) as (keyof T)[]) {
    const sourceVal = source[key]
    const targetVal = target[key]
    if (
      sourceVal &&
      typeof sourceVal === "object" &&
      !Array.isArray(sourceVal) &&
      targetVal &&
      typeof targetVal === "object" &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMerge(targetVal, sourceVal as Partial<typeof targetVal>)
    } else if (sourceVal !== undefined) {
      result[key] = sourceVal as T[keyof T]
    }
  }
  return result
}

