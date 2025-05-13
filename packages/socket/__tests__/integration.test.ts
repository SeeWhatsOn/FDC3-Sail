// __tests__/integration.test.ts
import { Server } from "socket.io"
import { io as ioc, Socket as ClientSocket } from "socket.io-client"
import { AddressInfo } from "net"
import { createServer } from "http"
import { SessionManager } from "../src/sessionManager"
import { DA_HELLO, DA_DIRECTORY_LISTING } from "@finos/fdc3-sail-common"
import { registerAllSocketHandlers } from "../src/setupHandlers"
import { describe, expect, beforeAll, afterAll, test, vi } from "vitest"
import { SailFDC3Server } from "../src/model/fdc3/SailFDC3Server"

// Increase test timeout to avoid flakiness
const TEST_TIMEOUT = 30000

// Create a consistent mock FDC3 server for testing
const createMockFdc3Server = () =>
  ({
    getAppDirectory: () => ({
      allApps: [],
      getAppById: () => null,
      getAllApps: () => [],
    }),
    getChannels: () => ({
      system: [
        { id: "system", type: "system", displayMetadata: { name: "System" } },
      ],
      user: [
        { id: "user1", type: "user", displayMetadata: { name: "User 1" } },
      ],
    }),
    getCurrentChannel: () => null,
    setCurrentChannel: vi.fn().mockResolvedValue(true),
    leaveCurrentChannel: vi.fn().mockResolvedValue(true),
    broadcast: vi.fn().mockResolvedValue(true),
    shutdown: vi.fn().mockResolvedValue(undefined),
  }) as unknown as SailFDC3Server

describe("FDC3 Session Integration Tests", () => {
  let server: Server
  let clientSocket: ClientSocket
  let httpServer: any
  let sessionManager: SessionManager
  let port: number

  /**
   * Setup a real Socket.IO server and client pair
   */
  beforeAll(async () => {
    return new Promise<void>((resolve) => {
      // Create HTTP server
      httpServer = createServer()

      // Create actual SessionManager instance
      sessionManager = new SessionManager()

      // Create Socket.IO server
      server = new Server(httpServer, {
        cors: { origin: "*", methods: ["GET", "POST"] },
      })

      // Start listening on an ephemeral port
      httpServer.listen(() => {
        port = (httpServer.address() as AddressInfo).port

        // Setup connection handler
        server.on("connection", (socket) => {
          // Set up handlers with real connection state
          registerAllSocketHandlers(socket, {
            socket,
            sessionManager,
          })
        })

        // Connect to the server after it's ready
        clientSocket = ioc(`http://localhost:${port}`, {
          forceNew: true,
          reconnection: true,
        })

        // Ensure we connect successfully before proceeding
        clientSocket.on("connect", () => {
          console.log("Client socket connected")
          // Add a small delay to ensure everything is set up
          setTimeout(() => resolve(), 500)
        })

        // Handle connection errors
        clientSocket.on("connect_error", (err) => {
          console.error("Connection error:", err)
        })
      })
    })
  })

  /**
   * Clean up resources after tests
   */
  afterAll(() => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect()
    }
    if (server) server.close()
    if (httpServer) httpServer.close()
  })

  /**
   * Test the full desktop agent connection flow
   */
  test(
    "Desktop agent can connect and establish a session",
    { timeout: TEST_TIMEOUT },
    () => {
      return new Promise<void>((resolve) => {
        // Pre-create the session to avoid waiting for it
        const mockServer = createMockFdc3Server()
        sessionManager.createSession("test-session-123", mockServer)

        // Ensure we're listening for the success event
        const successSpy = vi.fn().mockImplementation((success: any) => {
          expect(success).toBe(true)
          setTimeout(() => resolve(), 100) // Small delay to avoid race conditions
        })

        // Send a desktop agent hello message
        clientSocket.emit(
          DA_HELLO,
          {
            userSessionId: "test-session-123",
            channels: [
              { id: "system", icon: "system-icon", background: "#ff0000" },
              { id: "global", icon: "global-icon", background: "#00ff00" },
            ],
            directories: [],
          },
          successSpy,
        )
      })
    },
  )

  /**
   * Test the directory listing flow with a real session
   */
  test(
    "Client can request directory listing from an existing session",
    { timeout: TEST_TIMEOUT },
    () => {
      return new Promise<void>((resolve) => {
        // Mock the session being available with improved mock
        const mockServer = createMockFdc3Server()
        sessionManager.createSession("test-session-123", mockServer)

        // Send a directory listing request
        clientSocket.emit(
          DA_DIRECTORY_LISTING,
          { userSessionId: "test-session-123" },
          (apps: any, error: any) => {
            // Should receive apps without error - note we check for falsy not undefined
            expect(error).toBeFalsy()
            expect(apps).toBeDefined()
            expect(Array.isArray(apps)).toBe(true)
            resolve()
          },
        )
      })
    },
  )

  /**
   * Test error handling with real socket connections
   */
  test(
    "Server handles invalid session ID appropriately",
    { timeout: TEST_TIMEOUT },
    () => {
      return new Promise<void>((resolve) => {
        // Send a directory listing request for a non-existent session
        clientSocket.emit(
          DA_DIRECTORY_LISTING,
          { userSessionId: "non-existent-session" },
          (apps: any, error: any) => {
            // Should receive an error
            expect(error).toBeDefined()
            expect(apps).toBeNull()
            // The error may come directly from the session manager
            expect(error).toContain("Session not found")
            resolve()
          },
        )
      })
    },
  )

  /**
   * Test a full FDC3 workflow
   */
  test("Full FDC3 workflow test", { timeout: TEST_TIMEOUT }, () => {
    return new Promise<void>((resolve) => {
      // Pre-create the session to avoid timing issues
      const mockServer = createMockFdc3Server()
      sessionManager.createSession("workflow-test-session", mockServer)

      // 1. Desktop agent connects
      clientSocket.emit(
        DA_HELLO,
        {
          userSessionId: "workflow-test-session",
          channels: [
            { id: "system", icon: "system-icon", background: "#ff0000" },
            { id: "global", icon: "global-icon", background: "#00ff00" },
          ],
          directories: [],
        },
        (success: any) => {
          expect(success).toBe(true)

          // 2. Get directory listing
          clientSocket.emit(
            DA_DIRECTORY_LISTING,
            { userSessionId: "workflow-test-session" },
            (apps: any) => {
              expect(Array.isArray(apps)).toBe(true)

              // 3. Get system channels
              clientSocket.emit(
                "fdc3.getSystemChannels",
                { userSessionId: "workflow-test-session" },
                (channels: any) => {
                  expect(Array.isArray(channels)).toBe(true)

                  // 4. Join a channel
                  clientSocket.emit(
                    "fdc3.joinChannel",
                    {
                      userSessionId: "workflow-test-session",
                      channelId: "system",
                      instanceId: "test-app-1",
                    },
                    (joinSuccess: any) => {
                      expect(joinSuccess).toBeTruthy()

                      // 5. Broadcast to the channel
                      clientSocket.emit(
                        "fdc3.broadcast",
                        {
                          userSessionId: "workflow-test-session",
                          instanceId: "test-app-1",
                          context: {
                            type: "fdc3.test",
                            id: { value: "test-data" },
                          },
                        },
                        (broadcastSuccess: any) => {
                          expect(broadcastSuccess).toBeTruthy()

                          // 6. Leave the channel
                          clientSocket.emit(
                            "fdc3.leaveCurrentChannel",
                            {
                              userSessionId: "workflow-test-session",
                              instanceId: "test-app-1",
                            },
                            (leaveSuccess: any) => {
                              expect(leaveSuccess).toBeTruthy()

                              // We've verified the full workflow
                              resolve()
                            },
                          )
                        },
                      )
                    },
                  )
                },
              )
            },
          )
        },
      )
    })
  })
})
