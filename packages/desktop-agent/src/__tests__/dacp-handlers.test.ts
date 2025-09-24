import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { registerDACPHandlers } from '../handlers/dacp'
import { validateDACPMessage } from '../handlers/validation/dacp-validator'
import { BaseDACPMessageSchema } from '../handlers/validation/dacp-schemas'

describe('DACP Handlers Integration', () => {
  let channel1: MessageChannel
  let channel2: MessageChannel
  let responses: any[]

  beforeEach(() => {
    // Create message channels for testing
    channel1 = new MessageChannel()
    channel2 = new MessageChannel()
    responses = []

    // Mock server context and FDC3 server
    const mockServerContext = {
      sessionData: new Map(),
      broadcastContext: () => {},
      addContextListener: () => {},
      raiseIntent: () => {}
    }

    const mockFDC3Server = {
      handleBroadcast: () => {},
      handleIntent: () => {},
      handleChannel: () => {}
    }

    // Set up response listener
    channel1.port2.onmessage = (event) => {
      responses.push(event.data)
    }

    // Register DACP handlers
    registerDACPHandlers(channel1.port1, mockServerContext, mockFDC3Server)
  })

  afterEach(() => {
    channel1.port1.close()
    channel1.port2.close()
    channel2.port1.close()
    channel2.port2.close()
  })

  it('should handle broadcastRequest message', async () => {
    const broadcastMessage = {
      type: 'broadcastRequest',
      payload: {
        context: {
          type: 'fdc3.instrument',
          name: 'Apple Inc.',
          id: {
            ticker: 'AAPL'
          }
        }
      },
      meta: {
        requestUuid: '12345-abcde-67890',
        timestamp: new Date().toISOString()
      }
    }

    console.log('Sending broadcast message:', JSON.stringify(broadcastMessage, null, 2))

    // Validate the message first
    const validatedMessage = validateDACPMessage(broadcastMessage, BaseDACPMessageSchema)
    expect(validatedMessage).toBeDefined()
    expect(validatedMessage.type).toBe('broadcastRequest')

    // Send the message
    channel1.port2.postMessage(broadcastMessage)

    // Wait for response
    await new Promise(resolve => {
      setTimeout(() => {
        resolve(true)
      }, 1000)
    })

    console.log('Responses received:', responses)

    // Check if we got a response
    expect(responses.length).toBeGreaterThan(0)
    const response = responses[0]
    expect(response.type).toBe('broadcastResponse')
    expect(response.meta.requestUuid).toBe(broadcastMessage.meta.requestUuid)
  })

  it('should handle addContextListenerRequest message', async () => {
    const listenerMessage = {
      type: 'addContextListenerRequest',
      payload: {
        contextType: 'fdc3.instrument'
      },
      meta: {
        requestUuid: '54321-fghij-09876',
        timestamp: new Date().toISOString()
      }
    }

    console.log('Sending context listener message:', JSON.stringify(listenerMessage, null, 2))

    // Validate the message first
    const validatedMessage = validateDACPMessage(listenerMessage, BaseDACPMessageSchema)
    expect(validatedMessage).toBeDefined()
    expect(validatedMessage.type).toBe('addContextListenerRequest')

    // Send the message
    channel1.port2.postMessage(listenerMessage)

    // Wait for response
    await new Promise(resolve => {
      setTimeout(() => {
        resolve(true)
      }, 1000)
    })

    console.log('Responses received:', responses)

    // Check if we got a response
    expect(responses.length).toBeGreaterThan(0)
    const response = responses[0]
    expect(response.type).toBe('addContextListenerResponse')
    expect(response.meta.requestUuid).toBe(listenerMessage.meta.requestUuid)
  })

  it('should handle getCurrentChannelRequest message', async () => {
    const channelMessage = {
      type: 'getCurrentChannelRequest',
      payload: {},
      meta: {
        requestUuid: '98765-klmno-43210',
        timestamp: new Date().toISOString()
      }
    }

    console.log('Sending get current channel message:', JSON.stringify(channelMessage, null, 2))

    // Validate the message first
    const validatedMessage = validateDACPMessage(channelMessage, BaseDACPMessageSchema)
    expect(validatedMessage).toBeDefined()
    expect(validatedMessage.type).toBe('getCurrentChannelRequest')

    // Send the message
    channel1.port2.postMessage(channelMessage)

    // Wait for response
    await new Promise(resolve => {
      setTimeout(() => {
        resolve(true)
      }, 1000)
    })

    console.log('Responses received:', responses)

    // Check if we got a response
    expect(responses.length).toBeGreaterThan(0)
    const response = responses[0]
    expect(response.type).toBe('getCurrentChannelResponse')
    expect(response.meta.requestUuid).toBe(channelMessage.meta.requestUuid)
  })
})