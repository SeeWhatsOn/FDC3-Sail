// Consolidated handlers - replaces 8 separate handler files
import { Socket } from "socket.io"
import { v4 as uuid } from "uuid"
import { BrowserTypes } from "@finos/fdc3"
import { State } from "@finos/fdc3-web-impl"
import {
  // Desktop Agent events
  DA_HELLO,
  DA_DIRECTORY_LISTING,
  DA_REGISTER_APP_LAUNCH,
  DesktopAgentHelloArgs,
  DesktopAgentDirectoryListingArgs,
  DesktopAgentRegisterAppLaunchArgs,

  // App events
  APP_HELLO,
  AppHelloArgs,

  // Channel events
  SAIL_CHANNEL_CHANGE,
  CHANNEL_RECEIVER_HELLO,
  SailChannelChangeArgs,
  ChannelReceiverHelloRequest,
  CHANNEL_RECEIVER_UPDATE,

  // Client state events
  SAIL_CLIENT_STATE,
  SailClientStateArgs,

  // Common types
  AppHosting,
} from "@finos/fdc3-sail-common"

import { SimpleFDC3Server } from "./SimpleFDC3Server"
import { createSession, getSession } from "./sessions"
import { SocketType, logEvent, generateId } from "./utils"

// Interface for server receive method
interface ServerWithReceive {
  receive(message: object, instanceId: string): Promise<object>
}

// Socket metadata for tracking
interface SocketMeta {
  type?: SocketType
  sessionId?: string
  instanceId?: string
}

// Extend Socket interface to include our metadata
interface SocketWithMeta extends Socket {
  _sailMeta?: SocketMeta
}

// Get or create socket metadata
function getSocketMeta(socket: Socket): SocketMeta {
  const socketWithMeta = socket as SocketWithMeta
  if (!socketWithMeta._sailMeta) {
    socketWithMeta._sailMeta = {}
  }
  return socketWithMeta._sailMeta
}

// Main handler setup function
export function setupSocketHandlers(socket: Socket): void {
  logEvent("Server", "Setting up handlers", { socketId: socket.id })

  // Desktop Agent Handlers
  setupDesktopAgentHandlers(socket)

  // App Handlers
  setupAppHandlers(socket)

  // Channel Handlers
  setupChannelHandlers(socket)

  // Message & Intent Handlers
  setupMessageHandlers(socket)

  // Client State Handlers
  setupClientStateHandlers(socket)

  // Electron Handlers
  setupElectronHandlers(socket)

  // Lifecycle Handlers
  setupLifecycleHandlers(socket)

  logEvent("Server", "All handlers registered", { socketId: socket.id })
}

// =============================================================================
// DESKTOP AGENT HANDLERS
// =============================================================================

function setupDesktopAgentHandlers(socket: Socket): void {
  // Desktop Agent Hello - session initialization
  socket.on(
    DA_HELLO,
    async (
      data: DesktopAgentHelloArgs,
      callback?: (result?: unknown, error?: unknown) => void,
    ) => {
      if (
        !data ||
        typeof data.userSessionId !== "string" ||
        !Array.isArray(data.channels) ||
        !Array.isArray(data.directories)
      ) {
        const error = new Error(
          "Malformed data provided. Expected userSessionId (string), channels (array), and directories (array).",
        )
        logEvent("DesktopAgent", "DA_HELLO error", {
          error: error.message,
        })
        throw error
      }

      try {
        logEvent("DesktopAgent", "DA_HELLO", { sessionId: data.userSessionId })

        const meta = getSocketMeta(socket)
        meta.type = SocketType.DESKTOP_AGENT
        meta.sessionId = data.userSessionId

        // Get or create FDC3 server instance
        let server = getSession(data.userSessionId)
        if (!server) {
          server = new SimpleFDC3Server(socket, data)
          await createSession(data.userSessionId, server)
          logEvent("DesktopAgent", "Created new session", {
            sessionId: data.userSessionId,
          })
        } else {
          logEvent("DesktopAgent", "Using existing session", {
            sessionId: data.userSessionId,
          })
        }

        const result = true
        if (callback) callback(result)
      } catch (error) {
        logEvent("DesktopAgent", "DA_HELLO error", {
          error: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    },
  )

  // Directory Listing
  socket.on(
    DA_DIRECTORY_LISTING,
    async (
      data: DesktopAgentDirectoryListingArgs,
      callback?: (result?: unknown, error?: unknown) => void,
    ) => {
      logEvent("DesktopAgent", "DA_DIRECTORY_LISTING", {
        sessionId: data.userSessionId,
      })

      const server = getSession(data.userSessionId)
      if (!server) {
        const error = new Error("Session not found")
        logEvent("DesktopAgent", "DA_DIRECTORY_LISTING error", {
          error: error.message,
        })
        throw error
      }

      try {
        const result = server.getAppDirectory().allApps
        if (callback) callback(result)
      } catch (error) {
        logEvent("DesktopAgent", "DA_DIRECTORY_LISTING error", {
          error: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    },
  )

  // App Registration
  socket.on(
    DA_REGISTER_APP_LAUNCH,
    async (
      data: DesktopAgentRegisterAppLaunchArgs,
      callback?: (result?: unknown, error?: unknown) => void,
    ) => {
      logEvent("DesktopAgent", "DA_REGISTER_APP_LAUNCH", { appId: data.appId })

      const server = getSession(data.userSessionId)
      if (!server) {
        const error = new Error("Session not found")
        logEvent("DesktopAgent", "DA_REGISTER_APP_LAUNCH error", {
          error: error.message,
        })
        throw error
      }

      try {
        const instanceId = generateId()
        server.serverContext.setInstanceDetails(instanceId, {
          instanceId,
          state: State.Pending,
          appId: data.appId,
          hosting: data.hosting ?? AppHosting.Frame,
          channel: data.channel ?? null,
          instanceTitle: data.instanceTitle ?? data.appId,
          channelSockets: [],
        })

        if (callback) callback(instanceId)
      } catch (error) {
        logEvent("DesktopAgent", "DA_REGISTER_APP_LAUNCH error", {
          error: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    },
  )
}

// =============================================================================
// APP HANDLERS
// =============================================================================

function setupAppHandlers(socket: Socket): void {
  // App Hello - app connection
  socket.on(
    APP_HELLO,
    async (
      data: AppHelloArgs,
      callback?: (result?: unknown, error?: unknown) => void,
    ) => {
      logEvent("App", "APP_HELLO", { instanceId: data.instanceId })

      const meta = getSocketMeta(socket)
      meta.type = SocketType.APP
      meta.sessionId = data.userSessionId
      meta.instanceId = data.instanceId

      const server = getSession(data.userSessionId)
      if (!server) {
        const error = new Error("Session not found")
        logEvent("App", "APP_HELLO error", { error: error.message })
        throw error
      }

      const instance = server.serverContext.getInstanceDetails(data.instanceId)
      if (!instance) {
        const error = new Error("App instance not found")
        logEvent("App", "APP_HELLO error", { error: error.message })
        throw error
      }

      try {
        // Update instance with socket
        instance.socket = socket
        server.serverContext.setInstanceDetails(data.instanceId, instance)

        // Set app as connected
        await server.serverContext.setAppState(data.instanceId, State.Connected)

        const result = true
        if (callback) callback(result)
      } catch (error) {
        logEvent("App", "APP_HELLO error", {
          error: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    },
  )

  // App Heartbeat - simple heartbeat handler
  socket.on(
    "app-heartbeat",
    async (
      data?: unknown,
      callback?: (result?: unknown, error?: unknown) => void,
    ) => {
      try {
        // Heartbeat is simple - just respond
        const result = true
        if (callback) callback(result)
      } catch (error) {
        logEvent("App", "app-heartbeat error", {
          error: error instanceof Error ? error.message : String(error),
        })
        if (callback) callback(null, error)
      }
    },
  )
}

// =============================================================================
// CHANNEL HANDLERS
// =============================================================================

function setupChannelHandlers(socket: Socket): void {
  // Channel Change
  socket.on(
    SAIL_CHANNEL_CHANGE,
    async (
      data: SailChannelChangeArgs,
      callback?: (result?: unknown, error?: unknown) => void,
    ) => {
      logEvent("Channel", "SAIL_CHANNEL_CHANGE", {
        instanceId: data.instanceId,
        channel: data.channel ?? "none",
      })

      const server = getSession(data.userSessionId)
      if (!server) {
        const error = new Error("Session not found")
        logEvent("Channel", "SAIL_CHANNEL_CHANGE error", {
          error: error.message,
        })
        throw error
      }

      try {
        // Use FDC3 web-impl to handle channel join
        await (server as unknown as ServerWithReceive).receive(
          {
            type: "joinUserChannelRequest",
            payload: { channelId: data.channel },
            meta: { requestUuid: uuid(), timestamp: new Date() },
          } as BrowserTypes.JoinUserChannelRequest,
          data.instanceId,
        )

        logEvent("Channel", "Channel join completed", {
          instanceId: data.instanceId,
          channel: data.channel ?? "none",
        })

        const result = true
        if (callback) callback(result)
      } catch (error) {
        logEvent("Channel", "SAIL_CHANNEL_CHANGE error", {
          error: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    },
  )

  // Channel Receiver Hello
  socket.on(
    CHANNEL_RECEIVER_HELLO,
    async (
      data: ChannelReceiverHelloRequest,
      callback?: (result?: unknown, error?: unknown) => void,
    ) => {
      logEvent("Channel", "CHANNEL_RECEIVER_HELLO", {
        instanceId: data.instanceId,
      })

      const meta = getSocketMeta(socket)
      meta.type = SocketType.CHANNEL
      meta.sessionId = data.userSessionId
      meta.instanceId = data.instanceId

      const server = getSession(data.userSessionId)
      if (!server) {
        const error = new Error("Session not found")
        logEvent("Channel", "CHANNEL_RECEIVER_HELLO error", {
          error: error.message,
        })
        throw error
      }

      const instance = server.serverContext.getInstanceDetails(data.instanceId)
      if (!instance) {
        const error = new Error("App instance not found")
        logEvent("Channel", "CHANNEL_RECEIVER_HELLO error", {
          error: error.message,
        })
        throw error
      }

      try {
        // Add channel socket (with cleanup)
        instance.channelSockets = instance.channelSockets || []
        const originalLength = instance.channelSockets.length
        instance.channelSockets = instance.channelSockets.filter(
          (s: Socket) => s.connected,
        )

        if (instance.channelSockets.length < originalLength) {
          logEvent("Channel", "Cleaned up disconnected sockets", {
            instanceId: data.instanceId,
            removed: originalLength - instance.channelSockets.length,
          })
        }

        if (
          !instance.channelSockets.some((s: Socket) => s.id === socket.id) &&
          socket.connected
        ) {
          instance.channelSockets.push(socket)
          logEvent("Channel", "Added channel socket", {
            instanceId: data.instanceId,
            socketId: socket.id,
            total: instance.channelSockets.length,
          })
        }

        server.serverContext.setInstanceDetails(data.instanceId, instance)

        const tabs = server.serverContext.getTabs()
        const result = { tabs }
        if (callback) callback(result)
      } catch (error) {
        logEvent("Channel", "CHANNEL_RECEIVER_HELLO error", {
          error: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    },
  )
}

// =============================================================================
// MESSAGE & INTENT HANDLERS
// =============================================================================

function setupMessageHandlers(socket: Socket): void {
  // Message Proxy - handle FDC3 message forwarding
  socket.on(
    "message-proxy",
    async (
      data: {
        userSessionId: string
        from: string
        to: string
        payload: object
      },
      callback?: (result?: unknown, error?: unknown) => void,
    ) => {
      logEvent("Message", "MESSAGE_PROXY", { from: data.from, to: data.to })

      const server = getSession(data.userSessionId)
      if (!server) {
        const error = new Error("Session not found")
        logEvent("Message", "MESSAGE_PROXY error", { error: error.message })
        throw error
      }

      try {
        // Forward message to target app
        await server.serverContext.post(data.payload, data.to)

        const result = true
        if (callback) callback(result)
      } catch (error) {
        logEvent("Message", "MESSAGE_PROXY error", {
          error: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    },
  )

  // Intent Proxy - handle FDC3 intent raising
  socket.on(
    "raise-intent-proxy",
    async (
      data: {
        userSessionId: string
        intent: string
        context: object
        app?: object
        from: string
      },
      callback?: (result?: unknown, error?: unknown) => void,
    ) => {
      logEvent("Intent", "RAISE_INTENT_PROXY", {
        intent: data.intent,
        from: data.from,
      })

      const server = getSession(data.userSessionId)
      if (!server) {
        const error = new Error("Session not found")
        logEvent("Intent", "RAISE_INTENT_PROXY error", { error: error.message })
        throw error
      }

      try {
        // Use FDC3 web-impl to handle intent
        const response = await (server as unknown as ServerWithReceive).receive(
          {
            type: "raiseIntentRequest",
            payload: {
              intent: data.intent,
              context: data.context,
              app: data.app,
            },
            meta: { requestUuid: uuid(), timestamp: new Date() },
          },
          data.from,
        )

        if (callback) callback(response)
      } catch (error) {
        logEvent("Intent", "RAISE_INTENT_PROXY error", {
          error: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    },
  )
}

// =============================================================================
// CLIENT STATE HANDLERS
// =============================================================================

function setupClientStateHandlers(socket: Socket): void {
  socket.on(
    SAIL_CLIENT_STATE,
    async (
      data: SailClientStateArgs,
      callback?: (result?: unknown, error?: unknown) => void,
    ) => {
      try {
        logEvent("ClientState", "SAIL_CLIENT_STATE", {
          sessionId: data.userSessionId,
        })

        const server = getSession(data.userSessionId)
        if (!server) {
          throw new Error("Session not found")
        }

        // Update directories and channels
        await server.serverContext.reloadAppDirectories(
          data.directories,
          data.customApps,
        )
        server.serverContext.updateChannelData(
          data.channels,
          data.contextHistory,
        )

        // Update panel states
        for (const panel of data.panels) {
          const instance = server.serverContext.getInstanceDetails(
            panel.panelId,
          )
          if (instance) {
            let updated = false

            if (panel.tabId !== instance.channel) {
              instance.channel = panel.tabId
              updated = true

              // Notify app of channel change
              if (instance.socket?.connected) {
                try {
                  instance.socket.emit("channel-changed", {
                    channel: panel.tabId,
                  })
                } catch (error) {
                  logEvent("ClientState", "Failed to emit channel-changed", {
                    instanceId: panel.panelId,
                    error:
                      error instanceof Error ? error.message : String(error),
                  })
                }
              }
            }

            if (panel.title !== instance.instanceTitle) {
              instance.instanceTitle = panel.title
              updated = true
            }

            if (updated) {
              server.serverContext.setInstanceDetails(panel.panelId, instance)
            }
          }
        }

        // Notify channel receivers of updates
        const connectedApps = await server.serverContext.getActiveAppInstances()
        for (const app of connectedApps) {
          const instance = server.serverContext.getInstanceDetails(
            app.instanceId,
          )
          if (
            instance?.channelSockets?.length &&
            instance.channelSockets.length > 0
          ) {
            const updateMsg = { tabs: data.channels }
            instance.channelSockets = instance.channelSockets.filter(
              (channelSocket: Socket) => {
                if (channelSocket.connected) {
                  try {
                    channelSocket.emit(CHANNEL_RECEIVER_UPDATE, updateMsg)
                    return true
                  } catch (error) {
                    logEvent(
                      "ClientState",
                      "Failed to emit to channel socket",
                      {
                        socketId: channelSocket.id,
                        error:
                          error instanceof Error
                            ? error.message
                            : String(error),
                      },
                    )
                    return false
                  }
                }
                return false
              },
            )

            if (
              instance &&
              instance.channelSockets.length < (app.channelSockets?.length || 0)
            ) {
              server.serverContext.setInstanceDetails(app.instanceId, instance)
            }
          }
        }

        const result = true
        if (callback) callback(result)
      } catch (error) {
        logEvent("ClientState", "SAIL_CLIENT_STATE error", {
          error: error instanceof Error ? error.message : String(error),
        })
        if (callback) callback(null, error)
      }
    },
  )
}

// =============================================================================
// ELECTRON HANDLERS
// =============================================================================

function setupElectronHandlers(socket: Socket): void {
  socket.on(
    "fdc3-get-info",
    async (
      data?: unknown,
      callback?: (result?: unknown, error?: unknown) => void,
    ) => {
      try {
        logEvent("Electron", "FDC3_GET_INFO")

        // Return basic FDC3 info
        const result = {
          fdc3Version: "2.0",
          provider: "FDC3 Sail",
          providerVersion: "2.0",
        }

        if (callback) callback(result)
      } catch (error) {
        logEvent("Electron", "FDC3_GET_INFO error", {
          error: error instanceof Error ? error.message : String(error),
        })
        if (callback) callback(null, error)
      }
    },
  )
}

// =============================================================================
// LIFECYCLE HANDLERS
// =============================================================================

function setupLifecycleHandlers(socket: Socket): void {
  socket.on("disconnect", async (reason) => {
    logEvent("Lifecycle", "Socket disconnected", {
      socketId: socket.id,
      reason,
    })

    const meta = getSocketMeta(socket)
    if (meta.sessionId && meta.instanceId) {
      try {
        const server = getSession(meta.sessionId)
        if (server) {
          // Mark app as terminated if it was an app socket
          if (meta.type === SocketType.APP) {
            await server.serverContext.setAppState(
              meta.instanceId,
              State.Terminated,
            )
            logEvent("Lifecycle", "App marked as terminated", {
              instanceId: meta.instanceId,
            })
          }
        }
      } catch (error) {
        logEvent("Lifecycle", "Error during disconnect cleanup", {
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  })

  socket.on("error", (error: Error) => {
    logEvent("Lifecycle", "Socket error", {
      socketId: socket.id,
      error: error.message,
    })
  })
}
