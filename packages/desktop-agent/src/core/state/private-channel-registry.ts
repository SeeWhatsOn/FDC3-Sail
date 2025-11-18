import { v4 as uuidv4 } from "uuid"
import type { BrowserTypes, Context } from "@finos/fdc3"

/**
 * Private Channel metadata (internal registry representation)
 * This tracks the server-side state of a private channel
 */
export interface PrivateChannelMetadata extends BrowserTypes.Channel {
  /** Unique channel ID */
  id: string

  /** Type is always 'private' */
  type: "private"

  /** App that created the channel */
  creatorAppId: string

  /** App instance that created the channel */
  creatorInstanceId: string

  /** When the channel was created */
  createdAt: Date

  /** Apps currently connected to this channel */
  connectedInstances: Set<string>

  /** Context listeners registered on this channel */
  contextListeners: Map<string, ContextListener>

  /** Disconnect listeners for onDisconnect callbacks */
  disconnectListeners: Map<string, DisconnectListener>

  /** Last context broadcast per context type */
  lastContextByType: Map<string, Context>
}

/**
 * Context listener on a private channel
 */
export interface ContextListener {
  listenerId: string
  instanceId: string
  contextType: string | null // null means all types
}

/**
 * Disconnect listener for private channels
 */
export interface DisconnectListener {
  listenerId: string
  instanceId: string
}

/**
 * Private Channel Registry
 * Manages private channels created by apps for peer-to-peer communication
 */
export class PrivateChannelRegistry {
  private channels = new Map<string, PrivateChannelMetadata>()

  // Index: instanceId -> Set of channel IDs
  private instanceChannelIndex = new Map<string, Set<string>>()

  /**
   * Create a new private channel
   */
  createChannel(creatorAppId: string, creatorInstanceId: string): PrivateChannelMetadata {
    const channelId = `private-${uuidv4()}`

    const channel: PrivateChannelMetadata = {
      id: channelId,
      type: "private",
      creatorAppId,
      creatorInstanceId,
      createdAt: new Date(),
      connectedInstances: new Set([creatorInstanceId]),
      contextListeners: new Map(),
      disconnectListeners: new Map(),
      lastContextByType: new Map(),
    }

    this.channels.set(channelId, channel)
    this.addToInstanceIndex(creatorInstanceId, channelId)

    return channel
  }

  /**
   * Get a private channel by ID
   */
  getChannel(channelId: string): PrivateChannelMetadata | undefined {
    return this.channels.get(channelId)
  }

  /**
   * Connect an instance to a private channel
   */
  connectInstance(channelId: string, instanceId: string): boolean {
    const channel = this.channels.get(channelId)
    if (!channel) {
      return false
    }

    channel.connectedInstances.add(instanceId)
    this.addToInstanceIndex(instanceId, channelId)
    return true
  }

  /**
   * Disconnect an instance from a private channel
   */
  disconnectInstance(channelId: string, instanceId: string): boolean {
    const channel = this.channels.get(channelId)
    if (!channel) {
      return false
    }

    channel.connectedInstances.delete(instanceId)
    this.removeFromInstanceIndex(instanceId, channelId)

    // Remove any listeners for this instance
    for (const [listenerId, listener] of channel.contextListeners.entries()) {
      if (listener.instanceId === instanceId) {
        channel.contextListeners.delete(listenerId)
      }
    }

    for (const [listenerId, listener] of channel.disconnectListeners.entries()) {
      if (listener.instanceId === instanceId) {
        channel.disconnectListeners.delete(listenerId)
      }
    }

    // If no more connections and creator disconnected, remove channel
    if (
      channel.connectedInstances.size === 0 ||
      !channel.connectedInstances.has(channel.creatorInstanceId)
    ) {
      this.channels.delete(channelId)
    }

    return true
  }

  /**
   * Add context listener to a private channel
   */
  addContextListener(
    channelId: string,
    listenerId: string,
    instanceId: string,
    contextType: string | null
  ): boolean {
    const channel = this.channels.get(channelId)
    if (!channel) {
      return false
    }

    if (!channel.connectedInstances.has(instanceId)) {
      return false
    }

    channel.contextListeners.set(listenerId, {
      listenerId,
      instanceId,
      contextType,
    })

    return true
  }

  /**
   * Remove context listener from a private channel
   */
  removeContextListener(channelId: string, listenerId: string): boolean {
    const channel = this.channels.get(channelId)
    if (!channel) {
      return false
    }

    return channel.contextListeners.delete(listenerId)
  }

  /**
   * Add disconnect listener to a private channel
   */
  addDisconnectListener(channelId: string, listenerId: string, instanceId: string): boolean {
    const channel = this.channels.get(channelId)
    if (!channel) {
      return false
    }

    if (!channel.connectedInstances.has(instanceId)) {
      return false
    }

    channel.disconnectListeners.set(listenerId, {
      listenerId,
      instanceId,
    })

    return true
  }

  /**
   * Remove disconnect listener from a private channel
   */
  removeDisconnectListener(channelId: string, listenerId: string): boolean {
    const channel = this.channels.get(channelId)
    if (!channel) {
      return false
    }

    return channel.disconnectListeners.delete(listenerId)
  }

  /**
   * Get context listeners for a channel that match a context type
   */
  getMatchingContextListeners(channelId: string, contextType: string): ContextListener[] {
    const channel = this.channels.get(channelId)
    if (!channel) {
      return []
    }

    const listeners: ContextListener[] = []
    for (const listener of channel.contextListeners.values()) {
      // Match if listener is for all types (null) or specific type matches
      if (listener.contextType === null || listener.contextType === contextType) {
        listeners.push(listener)
      }
    }

    return listeners
  }

  /**
   * Store the last context broadcast on a channel
   */
  setLastContext(channelId: string, contextType: string, context: Context): boolean {
    const channel = this.channels.get(channelId)
    if (!channel) {
      return false
    }

    channel.lastContextByType.set(contextType, context)
    return true
  }

  /**
   * Get the last context of a specific type from a channel
   */
  getLastContext(channelId: string, contextType: string): Context | undefined {
    const channel = this.channels.get(channelId)
    if (!channel) {
      return undefined
    }

    return channel.lastContextByType.get(contextType)
  }

  /**
   * Get all channels for an instance
   */
  getInstanceChannels(instanceId: string): string[] {
    return Array.from(this.instanceChannelIndex.get(instanceId) || [])
  }

  /**
   * Remove all channels for an instance (on disconnect)
   */
  removeInstanceChannels(instanceId: string): number {
    const channelIds = this.getInstanceChannels(instanceId)

    channelIds.forEach(channelId => {
      this.disconnectInstance(channelId, instanceId)
    })

    this.instanceChannelIndex.delete(instanceId)
    return channelIds.length
  }

  /**
   * Clear all channels (for testing)
   */
  clear(): void {
    this.channels.clear()
    this.instanceChannelIndex.clear()
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalChannels: this.channels.size,
      totalInstances: this.instanceChannelIndex.size,
    }
  }

  // Private helper methods

  private addToInstanceIndex(instanceId: string, channelId: string): void {
    if (!this.instanceChannelIndex.has(instanceId)) {
      this.instanceChannelIndex.set(instanceId, new Set())
    }
    this.instanceChannelIndex.get(instanceId)!.add(channelId)
  }

  private removeFromInstanceIndex(instanceId: string, channelId: string): void {
    const channels = this.instanceChannelIndex.get(instanceId)
    if (channels) {
      channels.delete(channelId)
      if (channels.size === 0) {
        this.instanceChannelIndex.delete(instanceId)
      }
    }
  }
}
