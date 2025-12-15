/**
 * UserChannelRegistry manages pre-defined user channels.
 * User channels are the standard FDC3 channels that users can select via the channel selector UI.
 */

import type { BrowserTypes } from "@finos/fdc3"

type UserChannel = BrowserTypes.Channel
/**
 * Default FDC3 recommended user channels based on the FDC3 specification
 */
const DEFAULT_USER_CHANNELS: UserChannel[] = [
  {
    id: "fdc3.channel.1",
    type: "user",
    displayMetadata: {
      name: "Channel 1",
      color: "#FF0000", // red
      glyph: "1",
    },
  },
  {
    id: "fdc3.channel.2",
    type: "user",
    displayMetadata: {
      name: "Channel 2",
      color: "#FF8800", // orange
      glyph: "2",
    },
  },
  {
    id: "fdc3.channel.3",
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

/**
 * Registry for managing user channels
 */
export class UserChannelRegistry {
  private channels: Map<string, UserChannel>

  constructor(channels?: UserChannel[]) {
    // Use provided channels or defaults
    const channelList = channels ?? DEFAULT_USER_CHANNELS
    this.channels = new Map(channelList.map(ch => [ch.id, ch]))
  }

  /**
   * Get all user channels
   */
  getAll(): UserChannel[] {
    return Array.from(this.channels.values())
  }

  /**
   * Get a user channel by ID
   */
  get(channelId: string): UserChannel | undefined {
    return this.channels.get(channelId)
  }

  /**
   * Check if a user channel exists
   */
  has(channelId: string): boolean {
    return this.channels.has(channelId)
  }

  /**
   * Add a user channel (for custom configurations)
   */
  add(channel: UserChannel): void {
    this.channels.set(channel.id, channel)
  }

  /**
   * Remove a user channel
   */
  remove(channelId: string): boolean {
    return this.channels.delete(channelId)
  }

  /**
   * Get all channel IDs
   */
  getChannelIds(): string[] {
    return Array.from(this.channels.keys())
  }

  /**
   * Get count of user channels
   */
  count(): number {
    return this.channels.size
  }

  /**
   * Clear all channels (for testing)
   */
  clear(): void {
    this.channels.clear()
  }

  /**
   * Reset to default channels
   */
  reset(): void {
    this.channels.clear()
    DEFAULT_USER_CHANNELS.forEach(ch => {
      this.channels.set(ch.id, ch)
    })
  }
}
