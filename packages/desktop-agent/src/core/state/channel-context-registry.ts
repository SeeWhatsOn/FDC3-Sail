import type { Context } from "@finos/fdc3"

/**
 * Stored context with metadata
 */
export interface StoredContext {
  context: Context
  timestamp: number
  sourceInstanceId: string
}

/**
 * ChannelContextRegistry manages the latest context for each channel.
 * When an app broadcasts to a channel, the context is stored here.
 * When an app calls getCurrentContext, it retrieves from here.
 */
export class ChannelContextRegistry {
  // Map of channelId -> contextType -> StoredContext
  private channelContexts: Map<string, Map<string, StoredContext>> = new Map()

  /**
   * Store context for a channel
   */
  storeContext(channelId: string, context: Context, sourceInstanceId: string): void {
    let channelMap = this.channelContexts.get(channelId)
    if (!channelMap) {
      channelMap = new Map()
      this.channelContexts.set(channelId, channelMap)
    }

    channelMap.set(context.type, {
      context,
      timestamp: Date.now(),
      sourceInstanceId,
    })
  }

  /**
   * Get the latest context for a channel, optionally filtered by type
   */
  getContext(channelId: string, contextType?: string): Context | null {
    const channelMap = this.channelContexts.get(channelId)
    if (!channelMap) {
      return null
    }

    // If specific type requested, return that
    if (contextType) {
      const stored = channelMap.get(contextType)
      return stored ? stored.context : null
    }

    // Otherwise return the most recent context of any type
    let latestStored: StoredContext | null = null
    for (const stored of channelMap.values()) {
      if (!latestStored || stored.timestamp > latestStored.timestamp) {
        latestStored = stored
      }
    }

    return latestStored ? latestStored.context : null
  }

  /**
   * Clear all contexts for a channel
   */
  clearChannel(channelId: string): void {
    this.channelContexts.delete(channelId)
  }

  /**
   * Clear all stored contexts
   */
  clearAll(): void {
    this.channelContexts.clear()
  }

  /**
   * Get all context types stored for a channel
   */
  getChannelContextTypes(channelId: string): string[] {
    const channelMap = this.channelContexts.get(channelId)
    return channelMap ? Array.from(channelMap.keys()) : []
  }

  /**
   * Check if a channel has any stored contexts
   */
  hasContext(channelId: string): boolean {
    const channelMap = this.channelContexts.get(channelId)
    return channelMap ? channelMap.size > 0 : false
  }

  /**
   * Get metadata about stored context
   */
  getContextMetadata(
    channelId: string,
    contextType: string
  ): { timestamp: number; sourceInstanceId: string } | null {
    const channelMap = this.channelContexts.get(channelId)
    if (!channelMap) {
      return null
    }

    const stored = channelMap.get(contextType)
    if (!stored) {
      return null
    }

    return {
      timestamp: stored.timestamp,
      sourceInstanceId: stored.sourceInstanceId,
    }
  }
}
