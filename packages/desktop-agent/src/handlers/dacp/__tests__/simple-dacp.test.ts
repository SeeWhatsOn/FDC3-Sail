import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { registerDACPHandlers } from '../index'
import { generateRequestUuid } from '../../validation/dacp-validator'

describe('Simple DACP Test', () => {
  let channel: MessageChannel
  let port1: MessagePort
  let port2: MessagePort
  let responses: any[]

  beforeEach(() => {
    channel = new MessageChannel()
    port1 = channel.port1
    port2 = channel.port2
    responses = []

    port2.onmessage = (event) => {
      console.log('Test received response:', event.data)
      responses.push(event.data)
    }

    port1.start()
    port2.start()

    // Simple mock context
    const mockContext = {
      directory: { allApps: [] }
    }
    const mockServer = {}

    registerDACPHandlers(port1, mockContext, mockServer)
  })

  afterEach(() => {
    port1.close()
    port2.close()
  })

  it('should process a simple get current channel request', async () => {
    const request = {
      type: 'getCurrentChannelRequest',
      payload: {},
      meta: {
        requestUuid: generateRequestUuid(),
        timestamp: new Date()
      }
    }

    console.log('Sending request:', request)
    port2.postMessage(request)

    // Wait longer for processing
    await new Promise(resolve => setTimeout(resolve, 1000))

    console.log('Responses received:', responses)
    expect(responses.length).toBeGreaterThan(0)
  })
})