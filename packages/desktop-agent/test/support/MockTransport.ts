/**
 * Enhanced Mock Transport for Cucumber Tests
 *
 * Extends the basic MockTransport with capabilities needed for Cucumber step definitions:
 * - Track messages by destination instance
 * - Query messages by type, instance, payload fields
 * - Support for multiple "clients" in test scenarios
 */

import type {
  Transport,
  MessageHandler,
  DisconnectHandler,
} from "../../src/core/interfaces/transport"

/**
 * DACP message structure (partial, just what we need for routing/querying)
 */
interface DACPMessage {
  type: string
  meta?: {
    requestUuid?: string
    responseUuid?: string
    timestamp?: string | Date
    source?: {
      appId?: string
      instanceId?: string
    }
    destination?: {
      appId?: string
      instanceId?: string
    }
  }
  payload?: Record<string, unknown>
}

/**
 * Message record with parsed routing info
 */
export interface MessageRecord {
  msg: DACPMessage
  to?: {
    appId?: string
    instanceId?: string
  }
  timestamp: Date
}

/**
 * Enhanced MockTransport for Cucumber tests.
 *
 * Key features:
 * - Tracks ALL sent messages with timestamps
 * - Indexes messages by destination instance ID
 * - Provides rich query API for step definitions
 * - Supports message verification and assertions
 */
export class MockTransport implements Transport {
  private messageHandler?: MessageHandler
  private disconnectHandler?: DisconnectHandler
  private connected: boolean = true

  // Message tracking
  public allMessages: MessageRecord[] = []
  private messagesByInstance: Map<string, MessageRecord[]> = new Map()

  send(message: unknown): void {
    const msg = message as DACPMessage

    // Create record
    const record: MessageRecord = {
      msg: msg,
      to: msg.meta?.destination
        ? {
            appId: msg.meta.destination.appId,
            instanceId: msg.meta.destination.instanceId,
          }
        : undefined,
      timestamp: new Date(),
    }

    // Track globally
    this.allMessages.push(record)

    // Index by destination instance
    const instanceId = msg.meta?.destination?.instanceId
    if (instanceId) {
      if (!this.messagesByInstance.has(instanceId)) {
        this.messagesByInstance.set(instanceId, [])
      }
      this.messagesByInstance.get(instanceId)!.push(record)
    }
  }

  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler
  }

  onDisconnect(handler: DisconnectHandler): void {
    this.disconnectHandler = handler
  }

  isConnected(): boolean {
    return this.connected
  }

  getInstanceId(): string | null {
    return null
  }

  disconnect(): void {
    this.connected = false
    this.disconnectHandler?.()
  }

  // ======= Test Helper Methods =======

  /**
   * Simulate receiving a message from an app
   */
  async receiveMessage(message: unknown): Promise<void> {
    if (!this.messageHandler) {
      throw new Error("No message handler registered")
    }
    await this.messageHandler(message)
  }

  /**
   * Get all messages sent to a specific instance
   */
  getMessagesForInstance(instanceId: string): MessageRecord[] {
    return this.messagesByInstance.get(instanceId) || []
  }

  /**
   * Get all messages of a specific type
   */
  getMessagesByType(type: string): MessageRecord[] {
    return this.allMessages.filter(r => r.msg.type === type)
  }

  /**
   * Get messages matching a predicate
   */
  findMessages(predicate: (record: MessageRecord) => boolean): MessageRecord[] {
    return this.allMessages.filter(predicate)
  }

  /**
   * Get the last N messages
   */
  getLastMessages(count: number): MessageRecord[] {
    return this.allMessages.slice(-count)
  }

  /**
   * Get the last sent message (any destination)
   */
  getLastMessage(): MessageRecord | undefined {
    return this.allMessages[this.allMessages.length - 1]
  }

  /**
   * Clear all message history
   */
  clear(): void {
    this.allMessages = []
    this.messagesByInstance.clear()
  }

  /**
   * Get count of messages sent to instance
   */
  getMessageCountForInstance(instanceId: string): number {
    return this.getMessagesForInstance(instanceId).length
  }

  /**
   * Check if any message matches a type pattern and destination
   */
  hasMessageMatching(
    typePattern: string | RegExp,
    instanceId?: string,
    payloadMatch?: (payload: Record<string, unknown>) => boolean
  ): boolean {
    const messages = instanceId ? this.getMessagesForInstance(instanceId) : this.allMessages

    return messages.some(record => {
      const msg = record.msg

      // Check type
      const typeMatches =
        typeof typePattern === "string" ? msg.type === typePattern : typePattern.test(msg.type)

      if (!typeMatches) return false

      // Check payload if predicate provided
      if (payloadMatch && msg.payload) {
        return payloadMatch(msg.payload)
      }

      return true
    })
  }

  /**
   * Get messages in chronological order (alias for readability)
   */
  getPostedMessages(): MessageRecord[] {
    return this.allMessages
  }
}
