/**
 * Test channel data
 *
 * User channel fixtures for testing, based on FDC3 specification defaults
 * but with test-friendly IDs ("one", "two", "three") to match feature file expectations.
 */

import type { UserChannelConfig } from "../world"

/**
 * Default user channels for testing.
 * Based on FDC3 specification defaults.
 */
export const TEST_USER_CHANNELS: UserChannelConfig[] = [
  {
    id: "one",
    type: "user",
    displayMetadata: {
      name: "Channel 1",
      color: "#FF0000", // red
      glyph: "1",
    },
  },
  {
    id: "two",
    type: "user",
    displayMetadata: {
      name: "Channel 2",
      color: "#FF8800", // orange
      glyph: "2",
    },
  },
  {
    id: "three",
    type: "user",
    displayMetadata: {
      name: "Channel 3",
      color: "#FFFF00", // yellow
      glyph: "3",
    },
  },
  {
    id: "fdc3.channel.4",
    type: "user",
    displayMetadata: {
      name: "Channel 4",
      color: "#00FF00", // green
      glyph: "4",
    },
  },
  {
    id: "fdc3.channel.5",
    type: "user",
    displayMetadata: {
      name: "Channel 5",
      color: "#00FFFF", // cyan
      glyph: "5",
    },
  },
  {
    id: "fdc3.channel.6",
    type: "user",
    displayMetadata: {
      name: "Channel 6",
      color: "#0000FF", // blue
      glyph: "6",
    },
  },
  {
    id: "fdc3.channel.7",
    type: "user",
    displayMetadata: {
      name: "Channel 7",
      color: "#FF00FF", // magenta
      glyph: "7",
    },
  },
  {
    id: "fdc3.channel.8",
    type: "user",
    displayMetadata: {
      name: "Channel 8",
      color: "#800080", // purple
      glyph: "8",
    },
  },
]
