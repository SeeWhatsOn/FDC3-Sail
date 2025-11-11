/**
 * AppChannelRegistry manages dynamically created app channels.
 * App channels are programmatically created channels (as opposed to user channels
 * which are pre-defined like red/blue/green).
 */
import type { BrowserTypes } from "@finos/fdc3-schema"

type Channel = BrowserTypes.Channel
/**
 * Registry for managing app channels
 */
export class AppChannelRegistry {
  private channels: Map<string, Channel> = new Map()

  /**
   * Get or create an app channel by ID
   */
  getOrCreate(channelId: string): Channel {
    let channel = this.channels.get(channelId)

    if (!channel) {
      channel = {
        id: channelId,
        type: "app",
        displayMetadata: {
          name: channelId,
        },
      }
      this.channels.set(channelId, channel)
    }

    return channel
  }

  /**
   * Get an app channel by ID (returns undefined if doesn't exist)
   */
  get(channelId: string): Channel | undefined {
    return this.channels.get(channelId)
  }

  /**
   * Check if an app channel exists
   */
  has(channelId: string): boolean {
    return this.channels.has(channelId)
  }

  /**
   * Get all app channels
   */
  getAll(): Channel[] {
    return Array.from(this.channels.values())
  }

  /**
   * Delete an app channel
   */
  delete(channelId: string): boolean {
    return this.channels.delete(channelId)
  }

  /**
   * Clear all app channels
   */
  clear(): void {
    this.channels.clear()
  }

  /**
   * Get count of app channels
   */
  count(): number {
    return this.channels.size
  }
}
