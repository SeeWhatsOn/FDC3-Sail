/**
 * UserChannelRegistry manages pre-defined user channels.
 * User channels are the standard FDC3 channels like red, blue, green, etc.
 * that users can select via the channel selector UI.
 */

import type { BrowserTypes } from "@finos/fdc3"

type UserChannel = BrowserTypes.Channel
/**
 * Default FDC3 user channels based on the spec
 */
const DEFAULT_USER_CHANNELS: UserChannel[] = [
  {
    id: "red",
    type: "user",
    displayMetadata: {
      name: "Red",
      color: "#FF0000",
      glyph: "🔴",
    },
  },
  {
    id: "blue",
    type: "user",
    displayMetadata: {
      name: "Blue",
      color: "#0000FF",
      glyph: "🔵",
    },
  },
  {
    id: "green",
    type: "user",
    displayMetadata: {
      name: "Green",
      color: "#00FF00",
      glyph: "🟢",
    },
  },
  {
    id: "yellow",
    type: "user",
    displayMetadata: {
      name: "Yellow",
      color: "#FFFF00",
      glyph: "🟡",
    },
  },
  {
    id: "orange",
    type: "user",
    displayMetadata: {
      name: "Orange",
      color: "#FF8800",
      glyph: "🟠",
    },
  },
  {
    id: "purple",
    type: "user",
    displayMetadata: {
      name: "Purple",
      color: "#800080",
      glyph: "🟣",
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
