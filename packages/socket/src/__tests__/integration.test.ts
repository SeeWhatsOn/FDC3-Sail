// Integration tests - end-to-end server and client communication
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { getSession } from "../sessions"
import { Socket as ClientSocket } from "socket.io-client"
import { APP_HELLO, DA_HELLO } from "@finos/fdc3-sail-common"
import { State } from "@finos/fdc3-web-impl"
import { createTestClient, waitForConnection } from "./test-setup"
import "./test-setup" // Import setup for global beforeAll/afterAll

describe("Integration Tests - End-to-End", () => {
  let client: ClientSocket

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(async () => {
    if (client) {
      client.disconnect()
    }
  })

  describe("Server Startup", () => {
    it("should start server and accept connections", async () => {
      // Test actual connection
      client = createTestClient()
      await waitForConnection(client)
      expect(client.connected).toBe(true)
    })
  })

  describe("Full Desktop Agent Connection Flow", () => {
    beforeEach(async () => {
      client = createTestClient()
      await waitForConnection(client)
    }, 8000)

    it("should complete full DA connection and app launch flow", async () => {
      // 1. Desktop Agent Hello - creates session
      const daResult = await client.emitWithAck(DA_HELLO, {
        userSessionId: "integration-session",
        channels: [{ id: "red", icon: "🔴", background: "#ff0000" }],
        directories: [],
        panels: [],
        customApps: [],
        contextHistory: {},
      })

      expect(daResult).toBe(true)

      // Verify session was created
      const session = getSession("integration-session")
      expect(session).toBeDefined()

      // 2. Register app launch - creates app instance
      const instanceId = (await client.emitWithAck("da-launch", {
        userSessionId: "integration-session",
        appId: "test-app",
        hosting: "frame",
      })) as string

      expect(typeof instanceId).toBe("string")
      expect(instanceId).toBeTruthy()

      // 3. App Hello - connects app to instance
      const appResult = await client.emitWithAck(APP_HELLO, {
        userSessionId: "integration-session",
        instanceId: instanceId,
      })

      expect(appResult).toBe(true)

      // Verify app is connected
      const instance = session!.serverContext.getInstanceDetails(instanceId)
      expect(instance).toBeDefined()
      expect(instance!.state).toBe(State.Connected)
      expect(instance!.appId).toBe("test-app")

      // 4. Get directory listing
      const apps = (await client.emitWithAck("da-directory-listing", {
        userSessionId: "integration-session",
      })) as unknown[]

      expect(Array.isArray(apps)).toBe(true)

      // 5. Channel operations
      const channelResult = await client.emitWithAck("sail-channel-change", {
        userSessionId: "integration-session",
        instanceId: instanceId,
        channel: "red",
      })

      expect(channelResult).toBe(true)

      // 6. Channel receiver
      const receiverResult = (await client.emitWithAck(
        "channel-receiver-hello",
        {
          userSessionId: "integration-session",
          instanceId: instanceId,
        },
      )) as { tabs: unknown[] }

      expect(receiverResult).toHaveProperty("tabs")
      expect(Array.isArray(receiverResult.tabs)).toBe(true)
      expect(receiverResult.tabs).toHaveLength(1)
      expect(receiverResult.tabs[0].id).toBe("red")
    })

    it("should handle multiple concurrent clients", async () => {
      // Create second client
      const client2 = createTestClient()
      await waitForConnection(client2)

      try {
        // Both clients create sessions concurrently
        const [result1, result2] = await Promise.all([
          client.emitWithAck(DA_HELLO, {
            userSessionId: "session-1",
            channels: [],
            directories: [],
            panels: [],
            customApps: [],
            contextHistory: {},
          }),
          client2.emitWithAck(DA_HELLO, {
            userSessionId: "session-2",
            channels: [],
            directories: [],
            panels: [],
            customApps: [],
            contextHistory: {},
          }),
        ])

        expect(result1).toBe(true)
        expect(result2).toBe(true)

        // Verify both sessions exist
        expect(getSession("session-1")).toBeDefined()
        expect(getSession("session-2")).toBeDefined()

        // Both sessions should be independent
        const [apps1, apps2] = await Promise.all([
          client.emitWithAck("da-directory-listing", {
            userSessionId: "session-1",
          }),
          client2.emitWithAck("da-directory-listing", {
            userSessionId: "session-2",
          }),
        ])

        expect(Array.isArray(apps1)).toBe(true)
        expect(Array.isArray(apps2)).toBe(true)
      } finally {
        client2.disconnect()
      }
    })
  })

  describe("Message and Intent Flow", () => {
    beforeEach(async () => {
      client = createTestClient()
      await waitForConnection(client)

      // Set up session
      await client.emitWithAck(DA_HELLO, {
        userSessionId: "message-session",
        channels: [],
        directories: [],
        panels: [],
        customApps: [],
        contextHistory: {},
      })
    }, 8000)

    it("should handle message proxy and intent proxy", async () => {
      // Test message proxy
      const messageResult = await client.emitWithAck("message-proxy", {
        userSessionId: "message-session",
        from: "sender-app",
        to: "receiver-app",
        payload: { type: "test-message", data: "hello" },
      })

      expect(messageResult).toBe(true)

      // Test intent proxy
      const intentResult = await client.emitWithAck("raise-intent-proxy", {
        userSessionId: "message-session",
        intent: "ShowChart",
        context: { type: "fdc3.instrument", id: { ticker: "AAPL" } },
        from: "sender-app",
      })

      expect(intentResult).toBeDefined()
    })
  })

  describe("Client State Management", () => {
    beforeEach(async () => {
      client = createTestClient()
      await waitForConnection(client)

      await client.emitWithAck(DA_HELLO, {
        userSessionId: "state-session",
        channels: [{ id: "red", icon: "🔴", background: "#ff0000" }],
        directories: [],
        panels: [],
        customApps: [],
        contextHistory: {},
      })
    }, 8000)

    it("should handle client state updates", async () => {
      const result = await client.emitWithAck("sail-client-state", {
        userSessionId: "state-session",
        directories: [],
        customApps: [],
        channels: [
          { id: "blue", icon: "🔵", background: "#0000ff" },
          { id: "green", icon: "🟢", background: "#00ff00" },
        ],
        panels: [
          {
            panelId: "panel-1",
            tabId: "blue",
            title: "Test Panel",
          },
        ],
        contextHistory: {},
      })

      expect(result).toBe(true)

      // Verify channel data was updated
      const session = getSession("state-session")
      const tabs = session!.serverContext.getTabs()

      expect(tabs).toHaveLength(2)
      expect(tabs.find((t) => t.id === "blue")).toBeDefined()
      expect(tabs.find((t) => t.id === "green")).toBeDefined()
    })
  })

  describe("Error Recovery", () => {
    beforeEach(async () => {
      client = createTestClient()
      await waitForConnection(client)
    }, 8000)

    it("should recover from connection drops", async () => {
      // Establish session
      await client.emitWithAck(DA_HELLO, {
        userSessionId: "recovery-session",
        channels: [],
        directories: [],
        panels: [],
        customApps: [],
        contextHistory: {},
      })

      // Verify session exists
      expect(getSession("recovery-session")).toBeDefined()

      // Disconnect and reconnect
      client.disconnect()

      client = createTestClient()
      await waitForConnection(client)

      // Should be able to create new session after reconnect
      const result = await client.emitWithAck(DA_HELLO, {
        userSessionId: "recovery-session-2",
        channels: [],
        directories: [],
        panels: [],
        customApps: [],
        contextHistory: {},
      })

      expect(result).toBe(true)
      expect(getSession("recovery-session-2")).toBeDefined()
    })
  })

  describe("Utility Handlers", () => {
    beforeEach(async () => {
      client = createTestClient()
      await waitForConnection(client)
    }, 8000)

    it("should handle utility requests", async () => {
      // Test FDC3 info
      const fdc3Info = await client.emitWithAck("fdc3-get-info", {})

      expect(fdc3Info).toHaveProperty("fdc3Version")
      expect(fdc3Info).toHaveProperty("provider")
      expect(fdc3Info).toHaveProperty("providerVersion")
      expect(fdc3Info.provider).toBe("FDC3 Sail")

      // Test heartbeat
      const heartbeat = await client.emitWithAck("app-heartbeat", {})
      expect(heartbeat).toBe(true)
    })
  })
})
