// packages/socket/__tests__/integration/fdc3-workflow.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { Server } from "socket.io"
import { io as ioc, Socket as ClientSocket } from "socket.io-client"
import { AddressInfo } from "net"
import { createServer } from "http"
import { SessionManager } from "../../src/sessionManager"
import { SailFDC3Server } from "../../src/model/fdc3/SailFDC3Server"
import { SailServerContext } from "../../src/model/fdc3/SailServerContext"
import { SailDirectory } from "../../src/model/fdc3/SailDirectory"
import { registerAllSocketHandlers } from "../../src/setupHandlers"
import {
  DA_HELLO,
  DA_DIRECTORY_LISTING,
  DA_REGISTER_APP_LAUNCH,
  APP_HELLO,
  FDC3_APP_EVENT,
  AppHosting,
} from "@finos/fdc3-sail-common"

describe("FDC3 Workflow Integration Tests", () => {
  let server: Server
  let httpServer: any
  let sessionManager: SessionManager
  let desktopAgentClient: ClientSocket
  let appClient: ClientSocket
  let port: number

  const TEST_TIMEOUT = 15000
  const userSessionId = "integration-test-session"

  const testDirectories = [
    {
      apps: [
        {
          appId: "test-chart-app",
          name: "Test Chart App",
          details: { url: "https://example.com/chart" },
          intents: [
            {
              name: "ViewChart",
              contexts: ["fdc3.instrument"],
            },
          ],
        },
        {
          appId: "test-blotter-app",
          name: "Test Blotter App",
          details: { url: "https://example.com/blotter" },
          intents: [
            {
              name: "ViewOrders",
              contexts: ["fdc3.portfolio"],
            },
          ],
        },
      ],
    },
  ]

  const testChannels = [
    {
      id: "red",
      type: "user" as const,
      displayMetadata: { name: "Red", color: "#ff0000" },
    },
    {
      id: "blue",
      type: "user" as const,
      displayMetadata: { name: "Blue", color: "#0000ff" },
    },
    {
      id: "system",
      type: "system" as const,
      displayMetadata: { name: "System", color: "#808080" },
    },
  ]

  beforeEach(async () => {
    return new Promise<void>((resolve, reject) => {
      // Create HTTP server
      httpServer = createServer()
      sessionManager = new SessionManager()

      // Create Socket.IO server
      server = new Server(httpServer, {
        cors: { origin: "*", methods: ["GET", "POST"] },
      })

      // Start server on ephemeral port
      httpServer.listen(() => {
        port = (httpServer.address() as AddressInfo).port

        // Setup connection handler
        server.on("connection", (socket) => {
          registerAllSocketHandlers(socket, {
            socket,
            sessionManager,
          })
        })

        // Connect clients
        desktopAgentClient = ioc(`http://localhost:${port}`, {
          forceNew: true,
          reconnection: false,
        })

        appClient = ioc(`http://localhost:${port}`, {
          forceNew: true,
          reconnection: false,
        })

        // Wait for both clients to connect
        let connectedCount = 0
        const onConnect = () => {
          connectedCount++
          if (connectedCount === 2) {
            setTimeout(() => resolve(), 100) // Small delay for stability
          }
        }

        desktopAgentClient.on("connect", onConnect)
        appClient.on("connect", onConnect)

        desktopAgentClient.on("connect_error", reject)
        appClient.on("connect_error", reject)
      })
    })
  })

  afterEach(() => {
    if (desktopAgentClient?.connected) desktopAgentClient.disconnect()
    if (appClient?.connected) appClient.disconnect()
    if (server) server.close()
    if (httpServer) httpServer.close()
  })

  describe("Desktop Agent Session Setup", () => {
    it("should establish desktop agent session with channels and directories", { timeout: TEST_TIMEOUT }, async () => {
      const response = await new Promise<boolean>((resolve) => {
        desktopAgentClient.emit(
          DA_HELLO,
          {
            userSessionId,
            channels: testChannels.map(ch => ({
              id: ch.id,
              icon: `${ch.id}-icon`,
              background: ch.displayMetadata.color,
            })),
            directories: testDirectories,
          },
          (success: boolean) => {
            resolve(success)
          }
        )
      })

      expect(response).toBe(true)

      // Verify session was created
      const session = await sessionManager.getSession(userSessionId)
      expect(session).toBeDefined()
      expect(session).toBeInstanceOf(SailFDC3Server)
    })

    it("should retrieve directory listing after session setup", { timeout: TEST_TIMEOUT }, async () => {
      // First establish session
      await new Promise<void>((resolve) => {
        desktopAgentClient.emit(
          DA_HELLO,
          {
            userSessionId,
            channels: testChannels.map(ch => ({
              id: ch.id,
              icon: `${ch.id}-icon`,
              background: ch.displayMetadata.color,
            })),
            directories: testDirectories,
          },
          () => resolve()
        )
      })

      // Then get directory listing
      const apps = await new Promise<any[]>((resolve) => {
        desktopAgentClient.emit(
          DA_DIRECTORY_LISTING,
          { userSessionId },
          (appList: any[], error: any) => {
            expect(error).toBeNull()
            resolve(appList)
          }
        )
      })

      expect(apps).toHaveLength(2)
      expect(apps.find(app => app.appId === "test-chart-app")).toBeDefined()
      expect(apps.find(app => app.appId === "test-blotter-app")).toBeDefined()
    })
  })

  describe("App Registration and Connection", () => {
    let instanceId: string

    beforeEach(async () => {
      // Setup session
      await new Promise<void>((resolve) => {
        desktopAgentClient.emit(
          DA_HELLO,
          {
            userSessionId,
            channels: testChannels.map(ch => ({
              id: ch.id,
              icon: `${ch.id}-icon`,
              background: ch.displayMetadata.color,
            })),
            directories: testDirectories,
          },
          () => resolve()
        )
      })
    })

    it("should register and connect app successfully", { timeout: TEST_TIMEOUT }, async () => {
      // Register app launch
      instanceId = await new Promise<string>((resolve) => {
        desktopAgentClient.emit(
          DA_REGISTER_APP_LAUNCH,
          {
            appId: "test-chart-app",
            userSessionId,
            hosting: AppHosting.Frame,
            channel: "red",
            instanceTitle: "Chart App Instance",
          },
          (id: string, error: any) => {
            expect(error).toBeNull()
            resolve(id)
          }
        )
      })

      expect(instanceId).toMatch(/^[0-9a-f-]{36}$/) // UUID format

      // Connect app
      const hostingPreference = await new Promise<AppHosting>((resolve) => {
        appClient.emit(
          APP_HELLO,
          {
            appId: "test-chart-app",
            instanceId,
            userSessionId,
          },
          (hosting: AppHosting, error: any) => {
            expect(error).toBeNull()
            resolve(hosting)
          }
        )
      })

      expect(hostingPreference).toBe(AppHosting.Frame)
    })

    it("should handle app connection without pre-registration", { timeout: TEST_TIMEOUT }, async () => {
      const response = await new Promise<any>((resolve) => {
        appClient.emit(
          APP_HELLO,
          {
            appId: "test-chart-app",
            instanceId: "non-registered-instance",
            userSessionId,
          },
          (hosting: any, error: any) => {
            resolve({ hosting, error })
          }
        )
      })

      // Should fail without pre-registration (unless debug mode)
      expect(response.error).toBeDefined()
    })
  })

  describe("FDC3 Channel Operations", () => {
    let instanceId: string

    beforeEach(async () => {
      // Setup session and connect app
      await new Promise<void>((resolve) => {
        desktopAgentClient.emit(
          DA_HELLO,
          {
            userSessionId,
            channels: testChannels.map(ch => ({
              id: ch.id,
              icon: `${ch.id}-icon`,
              background: ch.displayMetadata.color,
            })),
            directories: testDirectories,
          },
          () => resolve()
        )
      })

      instanceId = await new Promise<string>((resolve) => {
        desktopAgentClient.emit(
          DA_REGISTER_APP_LAUNCH,
          {
            appId: "test-chart-app",
            userSessionId,
            hosting: AppHosting.Frame,
          },
          (id: string) => resolve(id)
        )
      })

      await new Promise<void>((resolve) => {
        appClient.emit(
          APP_HELLO,
          {
            appId: "test-chart-app",
            instanceId,
            userSessionId,
          },
          () => resolve()
        )
      })
    })

    it("should join user channel successfully", { timeout: TEST_TIMEOUT }, async () => {
      const joinResult = await new Promise<boolean>((resolve) => {
        appClient.emit(
          FDC3_APP_EVENT,
          {
            type: "joinUserChannelRequest",
            payload: { channelId: "red" },
            meta: {
              requestUuid: "join-test-uuid",
              timestamp: new Date(),
            },
          },
          instanceId,
          (response: any) => {
            resolve(response?.result === true)
          }
        )
      })

      expect(joinResult).toBe(true)
    })

    it("should broadcast context on channel", { timeout: TEST_TIMEOUT }, async () => {
      // First join a channel
      await new Promise<void>((resolve) => {
        appClient.emit(
          FDC3_APP_EVENT,
          {
            type: "joinUserChannelRequest",
            payload: { channelId: "red" },
            meta: {
              requestUuid: "join-uuid",
              timestamp: new Date(),
            },
          },
          instanceId,
          () => resolve()
        )
      })

      // Then broadcast context
      const broadcastResult = await new Promise<boolean>((resolve) => {
        appClient.emit(
          FDC3_APP_EVENT,
          {
            type: "broadcastRequest",
            payload: {
              context: {
                type: "fdc3.instrument",
                id: { ticker: "AAPL" },
              },
            },
            meta: {
              requestUuid: "broadcast-uuid",
              timestamp: new Date(),
            },
          },
          instanceId,
          (response: any) => {
            resolve(response?.result === true)
          }
        )
      })

      expect(broadcastResult).toBe(true)
    })

    it("should get system channels", { timeout: TEST_TIMEOUT }, async () => {
      const channels = await new Promise<any[]>((resolve) => {
        appClient.emit(
          FDC3_APP_EVENT,
          {
            type: "getSystemChannelsRequest",
            payload: {},
            meta: {
              requestUuid: "channels-uuid",
              timestamp: new Date(),
            },
          },
          instanceId,
          (response: any) => {
            resolve(response?.channels || [])
          }
        )
      })

      expect(Array.isArray(channels)).toBe(true)
      expect(channels.find(ch => ch.id === "system")).toBeDefined()
    })
  })

  describe("Error Handling", () => {
    it("should handle session not found errors", { timeout: TEST_TIMEOUT }, async () => {
      const response = await new Promise<any>((resolve) => {
        desktopAgentClient.emit(
          DA_DIRECTORY_LISTING,
          { userSessionId: "non-existent-session" },
          (apps: any, error: any) => {
            resolve({ apps, error })
          }
        )
      })

      expect(response.error).toBeDefined()
      expect(response.apps).toBeNull()
      expect(response.error).toContain("Session not found")
    })

    it("should handle malformed FDC3 messages", { timeout: TEST_TIMEOUT }, async () => {
      // First setup session and app
      await new Promise<void>((resolve) => {
        desktopAgentClient.emit(
          DA_HELLO,
          { userSessionId, channels: [], directories: [] },
          () => resolve()
        )
      })

      const instanceId = await new Promise<string>((resolve) => {
        desktopAgentClient.emit(
          DA_REGISTER_APP_LAUNCH,
          { appId: "test-chart-app", userSessionId },
          (id: string) => resolve(id)
        )
      })

      await new Promise<void>((resolve) => {
        appClient.emit(
          APP_HELLO,
          { appId: "test-chart-app", instanceId, userSessionId },
          () => resolve()
        )
      })

      // Send malformed message
      const response = await new Promise<any>((resolve) => {
        appClient.emit(
          FDC3_APP_EVENT,
          {
            // Missing required fields
            payload: {},
          },
          instanceId,
          (response: any) => {
            resolve(response)
          }
        )
      })

      // Should handle gracefully
      expect(response).toBeDefined()
    })
  })

  describe("Multi-App Scenarios", () => {
    let chartInstanceId: string
    let blotterInstanceId: string
    let secondAppClient: ClientSocket

    beforeEach(async () => {
      // Setup session
      await new Promise<void>((resolve) => {
        desktopAgentClient.emit(
          DA_HELLO,
          {
            userSessionId,
            channels: testChannels.map(ch => ({
              id: ch.id,
              icon: `${ch.id}-icon`,
              background: ch.displayMetadata.color,
            })),
            directories: testDirectories,
          },
          () => resolve()
        )
      })

      // Register and connect first app
      chartInstanceId = await new Promise<string>((resolve) => {
        desktopAgentClient.emit(
          DA_REGISTER_APP_LAUNCH,
          { appId: "test-chart-app", userSessionId },
          (id: string) => resolve(id)
        )
      })

      await new Promise<void>((resolve) => {
        appClient.emit(
          APP_HELLO,
          { appId: "test-chart-app", instanceId: chartInstanceId, userSessionId },
          () => resolve()
        )
      })

      // Setup second app client
      secondAppClient = ioc(`http://localhost:${port}`, {
        forceNew: true,
        reconnection: false,
      })

      await new Promise<void>((resolve) => {
        secondAppClient.on("connect", () => resolve())
      })

      // Register and connect second app
      blotterInstanceId = await new Promise<string>((resolve) => {
        desktopAgentClient.emit(
          DA_REGISTER_APP_LAUNCH,
          { appId: "test-blotter-app", userSessionId },
          (id: string) => resolve(id)
        )
      })

      await new Promise<void>((resolve) => {
        secondAppClient.emit(
          APP_HELLO,
          { appId: "test-blotter-app", instanceId: blotterInstanceId, userSessionId },
          () => resolve()
        )
      })
    })

    afterEach(() => {
      if (secondAppClient?.connected) secondAppClient.disconnect()
    })

    it("should handle context sharing between apps on same channel", { timeout: TEST_TIMEOUT }, async () => {
      // Both apps join the same channel
      await Promise.all([
        new Promise<void>((resolve) => {
          appClient.emit(
            FDC3_APP_EVENT,
            {
              type: "joinUserChannelRequest",
              payload: { channelId: "red" },
              meta: { requestUuid: "chart-join", timestamp: new Date() },
            },
            chartInstanceId,
            () => resolve()
          )
        }),
        new Promise<void>((resolve) => {
          secondAppClient.emit(
            FDC3_APP_EVENT,
            {
              type: "joinUserChannelRequest", 
              payload: { channelId: "red" },
              meta: { requestUuid: "blotter-join", timestamp: new Date() },
            },
            blotterInstanceId,
            () => resolve()
          )
        }),
      ])

      // Setup context listener on second app
      let receivedContext = false
      secondAppClient.on(FDC3_APP_EVENT, (message) => {
        if (message.type === "contextBroadcast") {
          receivedContext = true
        }
      })

      // Broadcast from first app
      await new Promise<void>((resolve) => {
        appClient.emit(
          FDC3_APP_EVENT,
          {
            type: "broadcastRequest",
            payload: {
              context: {
                type: "fdc3.instrument",
                id: { ticker: "MSFT" },
              },
            },
            meta: { requestUuid: "broadcast-test", timestamp: new Date() },
          },
          chartInstanceId,
          () => resolve()
        )
      })

      // Wait for context to be received
      await new Promise<void>((resolve) => {
        const checkReceived = () => {
          if (receivedContext) {
            resolve()
          } else {
            setTimeout(checkReceived, 100)
          }
        }
        checkReceived()
      })

      expect(receivedContext).toBe(true)
    })

    it("should isolate apps on different channels", { timeout: TEST_TIMEOUT }, async () => {
      // Apps join different channels
      await Promise.all([
        new Promise<void>((resolve) => {
          appClient.emit(
            FDC3_APP_EVENT,
            {
              type: "joinUserChannelRequest",
              payload: { channelId: "red" },
              meta: { requestUuid: "chart-red", timestamp: new Date() },
            },
            chartInstanceId,
            () => resolve()
          )
        }),
        new Promise<void>((resolve) => {
          secondAppClient.emit(
            FDC3_APP_EVENT,
            {
              type: "joinUserChannelRequest",
              payload: { channelId: "blue" },
              meta: { requestUuid: "blotter-blue", timestamp: new Date() },
            },
            blotterInstanceId,
            () => resolve()
          )
        }),
      ])

      // Setup context listener on second app
      let receivedContext = false
      secondAppClient.on(FDC3_APP_EVENT, (message) => {
        if (message.type === "contextBroadcast") {
          receivedContext = true
        }
      })

      // Broadcast from first app
      await new Promise<void>((resolve) => {
        appClient.emit(
          FDC3_APP_EVENT,
          {
            type: "broadcastRequest",
            payload: {
              context: {
                type: "fdc3.instrument",
                id: { ticker: "GOOGL" },
              },
            },
            meta: { requestUuid: "isolated-broadcast", timestamp: new Date() },
          },
          chartInstanceId,
          () => resolve()
        )
      })

      // Wait a bit to ensure no context is received
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 500)
      })

      expect(receivedContext).toBe(false)
    })
  })
})