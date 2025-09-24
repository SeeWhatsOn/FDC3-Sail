import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { registerDACPHandlers, cleanupDACPHandlers, getDACPHandlerStats } from '../index'
import { generateRequestUuid } from '../../validation/dacp-validator'

// Mock server context and FDC3 server
const mockServerContext = {
  directory: {
    allApps: []
  },
  getInstanceDetails: vi.fn(),
  setInstanceDetails: vi.fn(),
  notifyBroadcastContext: vi.fn()
}

const mockFDC3Server = {
  handlers: [],
  cleanup: vi.fn()
}

describe('DACP Handler Integration Tests', () => {
  let messageChannel: MessageChannel
  let port1: MessagePort
  let port2: MessagePort
  let receivedMessages: any[]

  beforeEach(() => {
    // Setup MessageChannel for testing
    messageChannel = new MessageChannel()
    port1 = messageChannel.port1
    port2 = messageChannel.port2

    // Track received messages
    receivedMessages = []
    port2.onmessage = (event) => {
      receivedMessages.push(event.data)
    }

    // Start both ports for communication
    port1.start()
    port2.start()

    // Register DACP handlers
    registerDACPHandlers(port1, mockServerContext, mockFDC3Server)
  })

  afterEach(() => {
    // Cleanup
    cleanupDACPHandlers('test-instance-id')
    port1.close()
    port2.close()
  })

  describe('Context Operations', () => {
    it('should handle broadcast request successfully', async () => {
      const broadcastRequest = {
        type: 'broadcastRequest',
        payload: {
          channelId: 'red',
          context: {
            type: 'fdc3.instrument',
            id: { ticker: 'AAPL' },
            name: 'Apple Inc.'
          }
        },
        meta: {
          requestUuid: generateRequestUuid(),
          timestamp: new Date()
        }
      }

      // Send message
      console.log('Sending broadcast request:', broadcastRequest)
      port2.postMessage(broadcastRequest)

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 500))

      // Verify response
      console.log('Received messages:', receivedMessages)
      expect(receivedMessages).toHaveLength(1)
      expect(receivedMessages[0].type).toBe('broadcastResponse')
      expect(receivedMessages[0].meta.requestUuid).toBe(broadcastRequest.meta.requestUuid)
      expect(receivedMessages[0].payload).toBeDefined()
    })

    it('should handle add context listener request successfully', async () => {
      const addListenerRequest = {
        type: 'addContextListenerRequest',
        payload: {
          channelId: 'red',
          contextType: 'fdc3.instrument'
        },
        meta: {
          requestUuid: generateRequestUuid(),
          timestamp: new Date()
        }
      }

      // Send message
      port2.postMessage(addListenerRequest)

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 500))

      // Verify response
      expect(receivedMessages).toHaveLength(1)
      expect(receivedMessages[0].type).toBe('addContextListenerResponse')
      expect(receivedMessages[0].meta.requestUuid).toBe(addListenerRequest.meta.requestUuid)
      expect(receivedMessages[0].payload.listenerId).toBeDefined()
    })

    it('should handle invalid broadcast request with error response', async () => {
      const invalidRequest = {
        type: 'broadcastRequest',
        payload: {
          // Missing channelId
          context: { type: 'fdc3.instrument' }
        },
        meta: {
          requestUuid: generateRequestUuid(),
          timestamp: new Date()
        }
      }

      port2.postMessage(invalidRequest)
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(receivedMessages).toHaveLength(1)
      expect(receivedMessages[0].type).toBe('broadcastResponse')
      expect(receivedMessages[0].payload.error).toBeDefined()
    })
  })

  describe('Intent Operations', () => {
    it('should handle raise intent request successfully', async () => {
      const raiseIntentRequest = {
        type: 'raiseIntentRequest',
        payload: {
          intent: 'ViewChart',
          context: {
            type: 'fdc3.instrument',
            id: { ticker: 'AAPL' }
          },
          app: 'ChartApp'
        },
        meta: {
          requestUuid: generateRequestUuid(),
          timestamp: new Date()
        }
      }

      port2.postMessage(raiseIntentRequest)
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(receivedMessages).toHaveLength(1)
      expect(receivedMessages[0].type).toBe('raiseIntentResponse')
      expect(receivedMessages[0].meta.requestUuid).toBe(raiseIntentRequest.meta.requestUuid)
    })

    it('should handle add intent listener request successfully', async () => {
      const addIntentListenerRequest = {
        type: 'addIntentListenerRequest',
        payload: {
          intent: 'ViewChart'
        },
        meta: {
          requestUuid: generateRequestUuid(),
          timestamp: new Date()
        }
      }

      port2.postMessage(addIntentListenerRequest)
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(receivedMessages).toHaveLength(1)
      expect(receivedMessages[0].type).toBe('addIntentListenerResponse')
      expect(receivedMessages[0].payload.listenerId).toBeDefined()
    })

    it('should handle find intent request successfully', async () => {
      const findIntentRequest = {
        type: 'findIntentRequest',
        payload: {
          intent: 'ViewChart',
          context: {
            type: 'fdc3.instrument'
          }
        },
        meta: {
          requestUuid: generateRequestUuid(),
          timestamp: new Date()
        }
      }

      port2.postMessage(findIntentRequest)
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(receivedMessages).toHaveLength(1)
      expect(receivedMessages[0].type).toBe('findIntentResponse')
      expect(receivedMessages[0].payload.intent).toBe('ViewChart')
      expect(receivedMessages[0].payload.apps).toBeDefined()
    })
  })

  describe('Channel Operations', () => {
    it('should handle get current channel request successfully', async () => {
      const getCurrentChannelRequest = {
        type: 'getCurrentChannelRequest',
        payload: {},
        meta: {
          requestUuid: generateRequestUuid(),
          timestamp: new Date()
        }
      }

      port2.postMessage(getCurrentChannelRequest)
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(receivedMessages).toHaveLength(1)
      expect(receivedMessages[0].type).toBe('getCurrentChannelResponse')
      expect(receivedMessages[0].payload.channel).toBeDefined()
    })

    it('should handle join user channel request successfully', async () => {
      const joinChannelRequest = {
        type: 'joinUserChannelRequest',
        payload: {
          channelId: 'red'
        },
        meta: {
          requestUuid: generateRequestUuid(),
          timestamp: new Date()
        }
      }

      port2.postMessage(joinChannelRequest)
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(receivedMessages).toHaveLength(1)
      expect(receivedMessages[0].type).toBe('joinUserChannelResponse')
      expect(receivedMessages[0].meta.requestUuid).toBe(joinChannelRequest.meta.requestUuid)
    })

    it('should handle get user channels request successfully', async () => {
      const getUserChannelsRequest = {
        type: 'getUserChannelsRequest',
        payload: {},
        meta: {
          requestUuid: generateRequestUuid(),
          timestamp: new Date()
        }
      }

      port2.postMessage(getUserChannelsRequest)
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(receivedMessages).toHaveLength(1)
      expect(receivedMessages[0].type).toBe('getUserChannelsResponse')
      expect(receivedMessages[0].payload.userChannels).toBeDefined()
      expect(Array.isArray(receivedMessages[0].payload.userChannels)).toBe(true)
    })

    it('should reject join to non-existent channel', async () => {
      const joinInvalidChannelRequest = {
        type: 'joinUserChannelRequest',
        payload: {
          channelId: 'non-existent-channel'
        },
        meta: {
          requestUuid: generateRequestUuid(),
          timestamp: new Date()
        }
      }

      port2.postMessage(joinInvalidChannelRequest)
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(receivedMessages).toHaveLength(1)
      expect(receivedMessages[0].type).toBe('joinUserChannelResponse')
      expect(receivedMessages[0].payload.error).toBeDefined()
    })
  })

  describe('Message Validation', () => {
    it('should reject completely malformed messages', async () => {
      const malformedMessage = {
        // Missing type, payload, meta
        invalid: 'data'
      }

      port2.postMessage(malformedMessage)
      await new Promise(resolve => setTimeout(resolve, 100))

      // Should not crash, but also shouldn't send any response for malformed messages
      // (logging would show the error)
    })

    it('should reject messages with invalid timestamps', async () => {
      const invalidTimestampMessage = {
        type: 'broadcastRequest',
        payload: {
          channelId: 'red',
          context: { type: 'fdc3.instrument' }
        },
        meta: {
          requestUuid: generateRequestUuid(),
          timestamp: 'invalid-date'
        }
      }

      port2.postMessage(invalidTimestampMessage)
      await new Promise(resolve => setTimeout(resolve, 100))

      // Should handle gracefully but may not send response due to validation failure
    })
  })

  describe('Handler Registry', () => {
    it('should report correct handler statistics', () => {
      const stats = getDACPHandlerStats()

      expect(stats.totalHandlers).toBeGreaterThan(0)
      expect(stats.supportedMessageTypes).toContain('broadcastRequest')
      expect(stats.supportedMessageTypes).toContain('addContextListenerRequest')
      expect(stats.supportedMessageTypes).toContain('raiseIntentRequest')
      expect(stats.supportedMessageTypes).toContain('getCurrentChannelRequest')
      expect(stats.supportedMessageTypes).toContain('joinUserChannelRequest')
    })

    it('should handle unknown message types gracefully', async () => {
      const unknownMessage = {
        type: 'unknownMessageType',
        payload: {},
        meta: {
          requestUuid: generateRequestUuid(),
          timestamp: new Date()
        }
      }

      port2.postMessage(unknownMessage)
      await new Promise(resolve => setTimeout(resolve, 100))

      // Should not crash or send any response for unknown message types
      expect(receivedMessages).toHaveLength(0)
    })
  })

  describe('Timeout Handling', () => {
    it('should handle operations within timeout limits', async () => {
      // This test ensures normal operations complete within expected timeouts
      const start = Date.now()

      const quickRequest = {
        type: 'getCurrentChannelRequest',
        payload: {},
        meta: {
          requestUuid: generateRequestUuid(),
          timestamp: new Date()
        }
      }

      port2.postMessage(quickRequest)
      await new Promise(resolve => setTimeout(resolve, 100))

      const duration = Date.now() - start
      expect(duration).toBeLessThan(1000) // Should complete well under default timeout
      expect(receivedMessages).toHaveLength(1)
    })
  })

  describe('Cleanup Operations', () => {
    it('should cleanup handlers without errors', () => {
      expect(() => {
        cleanupDACPHandlers('test-instance-id')
      }).not.toThrow()
    })
  })
})