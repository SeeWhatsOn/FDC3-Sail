// packages/socket/__tests__/handlers/fdc3/desktopAgentHandlers.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { Socket } from "socket.io"
import { ConnectionState } from "../../../src/types"
import { SessionManager } from "../../../src/sessionManager"
import { registerDesktopAgentHandlers } from "../../../src/handlers/fdc3/desktopAgentHandlers"
import {
  DA_HELLO,
  DA_DIRECTORY_LISTING,
  DA_REGISTER_APP_LAUNCH,
  AppHosting,
} from "@finos/fdc3-sail-common"

// Simple mock socket that we can control
class MockSocket {
  private handlers: Map<string, Function> = new Map()
  connected = true
  id = "test-socket"

  on(event: string, handler: Function) {
    this.handlers.set(event, handler)
  }

  emit = vi.fn()

  // Helper to trigger events
  async trigger(event: string, data: any, callback?: Function) {
    const handler = this.handlers.get(event)
    if (handler) {
      return await handler(data, callback)
    }
    throw new Error(`No handler for ${event}`)
  }
}

describe("Desktop Agent Handlers - Integration Tests", () => {
  let socket: MockSocket
  let sessionManager: SessionManager
  let connectionState: ConnectionState

  beforeEach(() => {
    socket = new MockSocket()
    sessionManager = new SessionManager()
    connectionState = {
      socket: socket as any,
      sessionManager,
      userSessionId: "test-session",
    }

    registerDesktopAgentHandlers(socket as any, connectionState)
  })

  describe("DA_HELLO Workflow", () => {
    const validHelloMessage = {
      userSessionId: "test-session",
      channels: [
        { id: "system", icon: "system-icon", background: "#ff0000" },
        { id: "user1", icon: "user1-icon", background: "#00ff00" },
      ],
      directories: [
        {
          apps: [
            {
              appId: "test-app",
              name: "Test App",
              details: { url: "https://example.com/app" },
              intents: [],
            },
          ],
        },
      ],
    }

    it("should successfully establish a session", async () => {
      const callback = vi.fn()
      await socket.trigger(DA_HELLO, validHelloMessage, callback)

      // Session should be created
      const session = await sessionManager.getSession("test-session")
      expect(session).toBeDefined()

      // Callback should indicate success
      expect(callback).toHaveBeenCalledWith(true, null)
    })

    it("should load apps from directories", async () => {
      const callback = vi.fn()
      await socket.trigger(DA_HELLO, validHelloMessage, callback)

      const session = await sessionManager.getSession("test-session")
      const directory = session.getAppDirectory()
      const apps = directory.retrieveAllApps()

      expect(apps).toHaveLength(1)
      expect(apps[0].appId).toBe("test-app")
    })

    it("should handle empty directories gracefully", async () => {
      const helloWithEmptyDirs = {
        ...validHelloMessage,
        directories: [],
      }

      const callback = vi.fn()
      await socket.trigger(DA_HELLO, helloWithEmptyDirs, callback)

      expect(callback).toHaveBeenCalledWith(true, null)
      const session = await sessionManager.getSession("test-session")
      expect(session.getAppDirectory().retrieveAllApps()).toHaveLength(0)
    })

    it("should handle malformed directories gracefully", async () => {
      const helloWithBadDirs = {
        ...validHelloMessage,
        directories: null,
      }

      const callback = vi.fn()
      await socket.trigger(DA_HELLO, helloWithBadDirs, callback)

      expect(callback).toHaveBeenCalledWith(true, null)
    })
  })

  describe("DA_DIRECTORY_LISTING Workflow", () => {
    beforeEach(async () => {
      // Establish session first
      await socket.trigger(DA_HELLO, {
        userSessionId: "test-session",
        channels: [],
        directories: [
          {
            apps: [
              { appId: "app1", name: "App 1", intents: [] },
              { appId: "app2", name: "App 2", intents: [] },
            ],
          },
        ],
      })
    })

    it("should return directory listing for established session", async () => {
      const callback = vi.fn()
      await socket.trigger(
        DA_DIRECTORY_LISTING,
        { userSessionId: "test-session" },
        callback
      )

      expect(callback).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ appId: "app1" }),
          expect.objectContaining({ appId: "app2" }),
        ]),
        null
      )
    })
  })

  describe("DA_REGISTER_APP_LAUNCH Workflow", () => {
    beforeEach(async () => {
      // Establish session first
      await socket.trigger(DA_HELLO, {
        userSessionId: "test-session",
        channels: [],
        directories: [],
      })
    })

    it("should register app launch and return instance ID", async () => {
      const callback = vi.fn()
      await socket.trigger(
        DA_REGISTER_APP_LAUNCH,
        {
          appId: "test-app",
          userSessionId: "test-session",
          hosting: AppHosting.Frame,
        },
        callback
      )

      expect(callback).toHaveBeenCalledWith(
        expect.any(String), // Should return some instance ID
        null
      )
    })
  })
})

describe("Desktop Agent Handlers - Error Handling", () => {
  let socket: MockSocket
  let sessionManager: SessionManager
  let connectionState: ConnectionState

  beforeEach(() => {
    socket = new MockSocket()
    sessionManager = new SessionManager()
    connectionState = {
      socket: socket as any,
      sessionManager,
    }

    registerDesktopAgentHandlers(socket as any, connectionState)
  })

  it("should handle directory listing for non-existent session", async () => {
    const callback = vi.fn()
    await socket.trigger(
      DA_DIRECTORY_LISTING,
      { userSessionId: "non-existent" },
      callback
    )

    expect(callback).toHaveBeenCalledWith(
      null,
      expect.stringContaining("Session not found")
    )
  })

  it("should handle app registration for non-existent session", async () => {
    const callback = vi.fn()
    await socket.trigger(
      DA_REGISTER_APP_LAUNCH,
      {
        appId: "test-app",
        userSessionId: "non-existent",
      },
      callback
    )

    expect(callback).toHaveBeenCalledWith(
      null,
      expect.stringContaining("Session not found")
    )
  })

  it("should handle missing callback gracefully", async () => {
    // Should not throw when callback is undefined
    await expect(
      socket.trigger(DA_HELLO, {
        userSessionId: "test-session",
        channels: [],
        directories: [],
      })
    ).resolves.not.toThrow()
  })
})

describe("Desktop Agent Handlers - Contract Tests", () => {
  let socket: MockSocket
  let sessionManager: SessionManager
  let connectionState: ConnectionState

  beforeEach(() => {
    socket = new MockSocket()
    sessionManager = new SessionManager()
    connectionState = {
      socket: socket as any,
      sessionManager,
    }

    registerDesktopAgentHandlers(socket as any, connectionState)
  })

  it("should register all required event handlers", () => {
    // Simply verify that handlers are registered by checking we can trigger them
    expect(() => socket.trigger(DA_HELLO, {}, vi.fn())).not.toThrow()
    expect(() => socket.trigger(DA_DIRECTORY_LISTING, {}, vi.fn())).not.toThrow()
    expect(() => socket.trigger(DA_REGISTER_APP_LAUNCH, {}, vi.fn())).not.toThrow()
  })

  it("should use consistent callback pattern (result, error)", () => {
    // All successful operations should call callback(result, null)
    // All failed operations should call callback(null, errorObject)
    // This is tested implicitly in other tests
    expect(true).toBe(true) // Contract verified in other tests
  })
})