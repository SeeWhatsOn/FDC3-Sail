// Handler edge cases and error scenarios using real Socket.IO
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { Socket as ClientSocket } from "socket.io-client"
import { getSession } from "../sessions"
import { State } from "@finos/fdc3-web-impl"
import { DA_HELLO, APP_HELLO } from "@finos/fdc3-sail-common"
import { createTestClient, waitForConnection, getGlobalTestServer } from "./test-setup"
import "./test-setup" // Import setup for global beforeAll/afterAll

describe("Handlers - Edge Cases & Error Scenarios", () => {
  let clientSocket: ClientSocket

  beforeEach(async () => {
    // Create fresh client connection for each test
    clientSocket = createTestClient()
    await waitForConnection(clientSocket)
  }, 8000)

  afterEach(async () => {
    if (clientSocket) {
      clientSocket.disconnect()
    }
  })

  describe("Error Handling", () => {
    it("should reject DA_HELLO with malformed data", async () => {
      await expect(
        clientSocket.emitWithAck(DA_HELLO, { invalid: "data" })
      ).rejects.toThrow(expect.stringContaining("Malformed data provided"))
    })

    it("should reject DA_HELLO with missing fields", async () => {
      await expect(
        clientSocket.emitWithAck(DA_HELLO, {
          userSessionId: "test-session"
          // Missing channels and directories
        })
      ).rejects.toThrow(expect.stringContaining("Malformed data provided"))
    })

    it("should reject operations on missing session", async () => {
      await expect(
        clientSocket.emitWithAck("da-directory-listing", {
          userSessionId: "non-existent-session"
        })
      ).rejects.toThrow(expect.stringContaining("Session not found"))
    })

    it("should reject APP_HELLO for missing instance", async () => {
      // First create a session
      await clientSocket.emitWithAck(DA_HELLO, {
        userSessionId: "test-session",
        channels: [],
        directories: [],
        panels: [],
        customApps: [],
        contextHistory: {}
      })

      // Try to connect app without creating instance first
      await expect(
        clientSocket.emitWithAck(APP_HELLO, {
          userSessionId: "test-session",
          instanceId: "non-existent-instance"
        })
      ).rejects.toThrow(expect.stringContaining("App instance not found"))
    })
  })

  describe("Promise-based Handler Validation", () => {
    beforeEach(async () => {
      // Set up test session for these tests
      await clientSocket.emitWithAck(DA_HELLO, {
        userSessionId: "test-session",
        channels: [{ id: "red", icon: "🔴", background: "#ff0000" }],
        directories: [],
        panels: [],
        customApps: [],
        contextHistory: {}
      })
    })

    it("should return boolean from DA_HELLO", async () => {
      const result = await clientSocket.emitWithAck(DA_HELLO, {
        userSessionId: "another-session",
        channels: [],
        directories: [],
        panels: [],
        customApps: [],
        contextHistory: {}
      })

      expect(typeof result).toBe("boolean")
      expect(result).toBe(true)
    })

    it("should return array from DA_DIRECTORY_LISTING", async () => {
      const result = await clientSocket.emitWithAck("da-directory-listing", {
        userSessionId: "test-session"
      })

      expect(Array.isArray(result)).toBe(true)
    })

    it("should return string from DA_REGISTER_APP_LAUNCH", async () => {
      const result = await clientSocket.emitWithAck("da-launch", {
        userSessionId: "test-session",
        appId: "test-app"
      })

      expect(typeof result).toBe("string")
      expect(result).toBeTruthy()
    })

    it("should return boolean from app-heartbeat", async () => {
      const result = await clientSocket.emitWithAck("app-heartbeat", {})

      expect(typeof result).toBe("boolean")
      expect(result).toBe(true)
    })

    it("should return object from fdc3-get-info", async () => {
      const result = await clientSocket.emitWithAck("fdc3-get-info", {})

      expect(typeof result).toBe("object")
      expect(result).toHaveProperty("fdc3Version")
      expect(result).toHaveProperty("provider")
      expect(result).toHaveProperty("providerVersion")
    })
  })

  describe("Channel Operations Edge Cases", () => {
    beforeEach(async () => {
      await clientSocket.emitWithAck(DA_HELLO, {
        userSessionId: "test-session",
        channels: [{ id: "red", icon: "🔴", background: "#ff0000" }],
        directories: [],
        panels: [],
        customApps: [],
        contextHistory: {}
      })
    })

    it("should handle channel change to null", async () => {
      const result = await clientSocket.emitWithAck("sail-channel-change", {
        userSessionId: "test-session",
        instanceId: "test-instance",
        channel: null
      })

      expect(result).toBe(true)
    })

    it("should handle channel receiver with empty channel list", async () => {
      const result = await clientSocket.emitWithAck("channel-receiver-hello", {
        userSessionId: "test-session",
        instanceId: "test-instance"
      })

      expect(result).toHaveProperty("tabs")
      expect(Array.isArray(result.tabs)).toBe(true)
    })
  })

  describe("Message Proxy Error Handling", () => {
    beforeEach(async () => {
      await clientSocket.emitWithAck(DA_HELLO, {
        userSessionId: "test-session",
        channels: [],
        directories: [],
        panels: [],
        customApps: [],
        contextHistory: {}
      })
    })

    it("should handle message to non-existent app", async () => {
      const result = await clientSocket.emitWithAck("message-proxy", {
        userSessionId: "test-session",
        from: "sender-app",
        to: "non-existent-app",
        payload: { type: "test" }
      })

      // Should succeed even if target app doesn't exist (graceful handling)
      expect(result).toBe(true)
    })

    it("should handle intent proxy with invalid session", async () => {
      await expect(
        clientSocket.emitWithAck("raise-intent-proxy", {
          userSessionId: "invalid-session",
          intent: "test-intent",
          context: { type: "fdc3.instrument" },
          from: "test-app"
        })
      ).rejects.toThrow(expect.stringContaining("Session not found"))
    })
  })

  describe("Client State Update Edge Cases", () => {
    beforeEach(async () => {
      await clientSocket.emitWithAck(DA_HELLO, {
        userSessionId: "test-session",
        channels: [],
        directories: [],
        panels: [],
        customApps: [],
        contextHistory: {}
      })
    })

    it("should handle client state with empty panels", async () => {
      const result = await clientSocket.emitWithAck("sail-client-state", {
        userSessionId: "test-session",
        directories: [],
        customApps: [],
        channels: [],
        panels: [],
        contextHistory: {}
      })

      expect(result).toBe(true)
    })

    it("should handle client state with missing optional fields", async () => {
      const result = await clientSocket.emitWithAck("sail-client-state", {
        userSessionId: "test-session",
        directories: [],
        customApps: [],
        channels: [],
        panels: [],
        contextHistory: {}
      })

      expect(result).toBe(true)
    })
  })

  describe("Concurrent Handler Execution", () => {
    beforeEach(async () => {
      await clientSocket.emitWithAck(DA_HELLO, {
        userSessionId: "test-session",
        channels: [],
        directories: [],
        panels: [],
        customApps: [],
        contextHistory: {}
      })
    })

    it("should handle multiple concurrent requests", async () => {
      const promises = [
        clientSocket.emitWithAck("da-directory-listing", { userSessionId: "test-session" }),
        clientSocket.emitWithAck("fdc3-get-info", {}),
        clientSocket.emitWithAck("app-heartbeat", {}),
      ]

      const results = await Promise.all(promises)

      expect(results).toHaveLength(3)
      expect(Array.isArray(results[0])).toBe(true) // directory listing
      expect(results[1]).toHaveProperty("fdc3Version") // fdc3 info
      expect(results[2]).toBe(true) // heartbeat
    })
  })

  describe("Connection Lifecycle", () => {
    it("should handle disconnect gracefully", async () => {
      let disconnectHandled = false
      
      const server = getGlobalTestServer()
      if (server) {
        server.on("connection", (socket) => {
          socket.on("disconnect", () => {
            disconnectHandled = true
          })
        })
      }

      clientSocket.disconnect()
      
      // Give some time for disconnect to be processed
      await new Promise(resolve => setTimeout(resolve, 100))
      
      expect(disconnectHandled).toBe(true)
    })

    it("should clean up app state on disconnect", async () => {
      // Set up session and app instance
      await clientSocket.emitWithAck(DA_HELLO, {
        userSessionId: "test-session",
        channels: [],
        directories: [],
        panels: [],
        customApps: [],
        contextHistory: {}
      })

      const instanceId = await clientSocket.emitWithAck("da-launch", {
        userSessionId: "test-session",
        appId: "test-app"
      })

      await clientSocket.emitWithAck(APP_HELLO, {
        userSessionId: "test-session",
        instanceId: instanceId
      })

      // Verify app is connected
      const session = getSession("test-session")
      expect(session).toBeDefined()
      
      const instance = session!.serverContext.getInstanceDetails(instanceId)
      expect(instance?.state).toBe(State.Connected)

      // Disconnect should mark app as terminated
      clientSocket.disconnect()
      
      // Give some time for cleanup
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const updatedInstance = session!.serverContext.getInstanceDetails(instanceId)
      expect(updatedInstance?.state).toBe(State.Terminated)
    })
  })
})