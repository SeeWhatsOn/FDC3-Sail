import { describe, it, expect } from 'vitest'

describe('MessagePort Communication Test', () => {
  it('should allow basic MessagePort communication', async () => {
    const channel = new MessageChannel()
    const port1 = channel.port1
    const port2 = channel.port2

    let receivedMessage: any = null

    port2.onmessage = (event) => {
      receivedMessage = event.data
    }

    port1.start()
    port2.start()

    // Send a test message
    port1.postMessage({ test: 'hello' })

    // Wait for message to be received
    await new Promise(resolve => setTimeout(resolve, 100))

    expect(receivedMessage).toEqual({ test: 'hello' })

    port1.close()
    port2.close()
  })
})