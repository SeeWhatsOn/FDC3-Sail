// Shared test setup for Socket.IO server lifecycle
import { beforeAll, afterAll } from "vitest"
import { Server } from "socket.io"
import { io as Client, Socket as ClientSocket } from "socket.io-client"
import { createServer } from "../main"

// Global test server instance
let globalServer: Server | null = null
let testPort: number

// Get a unique port for this test run
function getTestPort(): number {
  // Use a random port in the ephemeral range to avoid conflicts
  const minPort = 30000
  const maxPort = 60000
  return Math.floor(Math.random() * (maxPort - minPort) + minPort)
}

// Setup global server before all tests
beforeAll(async () => {
  testPort = getTestPort()
  console.log(`Starting test server on port ${testPort}`)

  globalServer = createServer(testPort)

  // Wait for server to be ready with proper error handling
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new Error(
          `Server failed to start on port ${testPort} within 10 seconds`,
        ),
      )
    }, 10000)

    // Socket.IO doesn't emit 'listening', but we can check if it's ready
    const checkReady = () => {
      // Simple connection test to verify server is ready
      const testClient = Client(`http://localhost:${testPort}`, {
        timeout: 2000,
        forceNew: true,
      })

      testClient.on("connect", () => {
        clearTimeout(timeout)
        testClient.disconnect()
        console.log(`Test server ready on port ${testPort}`)
        resolve()
      })

      testClient.on("connect_error", () => {
        testClient.disconnect()
        // Retry after a short delay
        setTimeout(checkReady, 100)
      })
    }

    // Start checking after a brief delay to let server initialize
    setTimeout(checkReady, 100)
  })
}, 20000)

// Cleanup global server after all tests
afterAll(async () => {
  if (globalServer) {
    console.log(`Shutting down test server on port ${testPort}`)
    await new Promise<void>((resolve) => {
      globalServer!.close(() => {
        console.log("Test server shut down successfully")
        resolve()
      })
    })
    globalServer = null
  }
}, 10000)

// Helper function to create client connections
export function createTestClient(
  options: { timeout?: number; forceNew?: boolean } = {},
): ClientSocket {
  return Client(`http://localhost:${testPort}`, {
    timeout: options.timeout || 5000,
    forceNew: options.forceNew !== false, // Default to true
    ...options,
  })
}

// Helper function to wait for client connection
export async function waitForConnection(
  client: ClientSocket,
  timeoutMs = 5000,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Client connection timeout"))
    }, timeoutMs)

    if (client.connected) {
      clearTimeout(timeout)
      resolve()
      return
    }

    client.on("connect", () => {
      clearTimeout(timeout)
      resolve()
    })

    client.on("connect_error", (err) => {
      clearTimeout(timeout)
      reject(err)
    })
  })
}

// Export test port for use in tests
export function getGlobalTestPort(): number {
  return testPort
}

// Export server instance for advanced test scenarios
export function getGlobalTestServer(): Server | null {
  return globalServer
}
