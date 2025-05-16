// __tests__/e2e/fdc3-server.e2e.ts
import { io as ioc, Socket as ClientSocket } from "socket.io-client"
import { DA_HELLO, DA_DIRECTORY_LISTING } from "@finos/fdc3-sail-common"
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { createServer, sessionManager } from "../../src/main"
import { Server } from "socket.io"

describe("FDC3 Server E2E Tests", () => {
  let server: Server
  let desktopAgentClient: ClientSocket
  let appClient1: ClientSocket
  let appClient2: ClientSocket
  const SERVER_PORT = 8099 // Use a dedicated port for e2e tests
  const SERVER_URL = `http://localhost:${SERVER_PORT}`
  const TEST_TIMEOUT = 60000 // 60 seconds

  // Helper to wait for a condition to be true
  const waitFor = async (condition: () => boolean, timeout = 5000) => {
    const start = Date.now()
    while (!condition()) {
      if (Date.now() - start > timeout) {
        throw new Error(`Timeout waiting for condition after ${timeout}ms`)
      }
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }

  // Start the server and connect clients
  beforeAll(async () => {
    // Create and start the server directly
    server = createServer(SERVER_PORT)

    // Connect the desktop agent client
    desktopAgentClient = ioc(SERVER_URL, {
      forceNew: true,
      reconnection: true,
    })

    // Connect app clients
    appClient1 = ioc(SERVER_URL, {
      forceNew: true,
      reconnection: true,
    })

    appClient2 = ioc(SERVER_URL, {
      forceNew: true,
      reconnection: true,
    })

    // Wait for all clients to connect
    await waitFor(
      () =>
        desktopAgentClient.connected &&
        appClient1.connected &&
        appClient2.connected,
    )
  }, TEST_TIMEOUT)

  // Clean up resources
  afterAll(() => {
    // Disconnect all clients
    if (desktopAgentClient?.connected) desktopAgentClient.disconnect()
    if (appClient1?.connected) appClient1.disconnect()
    if (appClient2?.connected) appClient2.disconnect()

    // Close the server
    if (server) {
      return new Promise<void>((resolve) => {
        server.close(() => {
          // Additional cleanup
          sessionManager.shutdownAllSessions().then(() => {
            resolve()
          })
        })
      })
    }
  }, TEST_TIMEOUT)

  it("should connect a desktop agent to the server", async () => {
    const userSessionId = "e2e-test-session"

    const helloResponse = await new Promise((resolve) => {
      desktopAgentClient.emit(
        DA_HELLO,
        {
          userSessionId,
          channels: [
            { id: "system", icon: "system-icon", background: "#ff0000" },
            { id: "global", icon: "global-icon", background: "#00ff00" },
          ],
          directories: [
            {
              // Add a test application
              apps: [
                {
                  appId: "test-app-1",
                  name: "Test App 1",
                  manifest: "https://example.com/test1.json",
                  manifestType: "fdc3.manifest",
                },
                {
                  appId: "test-app-2",
                  name: "Test App 2",
                  manifest: "https://example.com/test2.json",
                  manifestType: "fdc3.manifest",
                },
              ],
            },
          ],
        },
        (success: unknown) => {
          resolve(success)
        },
      )
    })
    expect(helloResponse).toBe(true)
  })

  // Test the full FDC3 workflow
  it.skip("should execute a complete FDC3 workflow", async () => {
    // 1. Desktop agent establishes a session
    const userSessionId = "e2e-test-session"

    const helloResponse = await new Promise((resolve) => {
      desktopAgentClient.emit(
        DA_HELLO,
        {
          userSessionId,
          channels: [
            { id: "system", icon: "system-icon", background: "#ff0000" },
            { id: "global", icon: "global-icon", background: "#00ff00" },
          ],
          directories: [
            {
              // Add a test application
              apps: [
                {
                  appId: "test-app-1",
                  name: "Test App 1",
                  manifest: "https://example.com/test1.json",
                  manifestType: "fdc3.manifest",
                },
                {
                  appId: "test-app-2",
                  name: "Test App 2",
                  manifest: "https://example.com/test2.json",
                  manifestType: "fdc3.manifest",
                },
              ],
            },
          ],
        },
        (success) => {
          resolve(success)
        },
      )
    })

    expect(helloResponse).toBe(true)

    // 2. App 1 connects and registers
    const app1InstanceId = "app1-instance"
    const app1ConnectResult = await new Promise((resolve) => {
      appClient1.emit(
        "fdc3.connect",
        {
          userSessionId,
          appInstanceId: app1InstanceId,
          appId: "test-app-1",
        },
        (success) => {
          resolve(success)
        },
      )
    })

    expect(app1ConnectResult).toBeTruthy()

    // Rest of the test remains the same as in the previous example
    // ...

    // 3. App 2 connects and registers
    const app2InstanceId = "app2-instance"
    const app2ConnectResult = await new Promise((resolve) => {
      appClient2.emit(
        "fdc3.connect",
        {
          userSessionId,
          appInstanceId: app2InstanceId,
          appId: "test-app-2",
        },
        (success) => {
          resolve(success)
        },
      )
    })

    expect(app2ConnectResult).toBeTruthy()

    // 4. App 1 joins the system channel
    const joinResult = await new Promise((resolve) => {
      appClient1.emit(
        "fdc3.joinChannel",
        {
          userSessionId,
          instanceId: app1InstanceId,
          channelId: "system",
        },
        (success) => {
          resolve(success)
        },
      )
    })

    expect(joinResult).toBeTruthy()

    // 5. App 2 joins the system channel
    const app2JoinResult = await new Promise((resolve) => {
      appClient2.emit(
        "fdc3.joinChannel",
        {
          userSessionId,
          instanceId: app2InstanceId,
          channelId: "system",
        },
        (success) => {
          resolve(success)
        },
      )
    })

    expect(app2JoinResult).toBeTruthy()

    // 6. Set up a context listener on app2
    let receivedContext = false

    appClient2.on("fdc3.context", (data) => {
      console.log("App2 received context:", data)
      if (data.type === "fdc3.test") {
        receivedContext = true
      }
    })

    // 7. App 1 broadcasts to the channel
    const broadcastResult = await new Promise((resolve) => {
      appClient1.emit(
        "fdc3.broadcast",
        {
          userSessionId,
          instanceId: app1InstanceId,
          context: {
            type: "fdc3.test",
            id: { value: "test-data" },
          },
        },
        (success) => {
          resolve(success)
        },
      )
    })

    expect(broadcastResult).toBeTruthy()

    // 8. Wait for app 2 to receive the context
    await waitFor(() => receivedContext, 5000)
    expect(receivedContext).toBe(true)
  }, 120000)

  // Add more specific test cases for individual features
})
