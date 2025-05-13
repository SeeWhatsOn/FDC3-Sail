/**
 * NOTE: This test is currently disabled in jest.config.ts because it requires additional
 * configuration to properly mock all the @finos dependencies.
 *
 * When you want to re-enable this test:
 * 1. Update the jest.setup.ts to include all required mock implementations
 * 2. Remove the testMatch property or update it to include this file in jest.config.ts
 */
import { Server } from "socket.io"
import { io as ioc, Socket as ClientSocket } from "socket.io-client"
import { AddressInfo } from "net"
import { createServer } from "http"
import { SessionManager } from "../src/sessionManager"
import { DA_HELLO, DA_DIRECTORY_LISTING } from "@finos/fdc3-sail-common"
import { registerAllSocketHandlers } from "../src/setupHandlers"
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  test,
  vi,
  beforeEach,
} from "vitest"

// Increase test timeout to avoid flakiness
const TEST_TIMEOUT = 10000

describe("FDC3 Session Integration Tests", () => {
  let server: Server
  let clientSocket: ClientSocket
  // let serverSocket: Socket
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

        // Wait for the server to be ready before connecting the client
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
          // Now we know the client is connected
          console.log("Client socket connected")
          resolve()
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
        // Listen for session:created event from the session manager
        sessionManager.on(
          "session:created",
          ({ sessionId, server: fdc3Server }) => {
            expect(sessionId).toBe("test-session-123")
            expect(fdc3Server).toBeDefined()

            // At this point, we've validated that:
            // 1. The client successfully sent the hello message
            // 2. The server processed it and created a session
            // 3. The session manager emitted the expected event
            resolve()
          },
        )

        // Send a desktop agent hello message from the client
        const helloArgs: any = {
          userSessionId: "test-session-123",
          channels: [
            { id: "system", icon: "system-icon", background: "#ff0000" },
            { id: "global", icon: "global-icon", background: "#00ff00" },
          ],
          directories: [],
        }

        clientSocket.emit(DA_HELLO, helloArgs, (success: any) => {
          // We should get a success response
          expect(success).toBe(true)
        })
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
        // Mock the session being available
        sessionManager.createSession("test-session-123", {
          getAppDirectory: () => ({
            allApps: [],
          }),
        } as any)

        // Send a directory listing request
        clientSocket.emit(
          DA_DIRECTORY_LISTING,
          { userSessionId: "test-session-123" },
          (apps: any, error: any) => {
            // Should receive apps without error
            expect(error).toBeUndefined()
            expect(apps).toBeDefined()
            expect(Array.isArray(apps)).toBe(true)

            // This validates that:
            // 1. The client can request a directory listing
            // 2. The server can retrieve the apps from the session
            // 3. The response is properly formatted and returned
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

            // This validates that:
            // 1. The server properly handles error cases
            // 2. The error is propagated back to the client
            resolve()
          },
        )
      })
    },
  )
})
