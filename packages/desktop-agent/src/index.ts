// Core Desktop Agent class
export { DesktopAgent } from "./DesktopAgent"
export type { DesktopAgentConfig } from "./DesktopAgent"

// Interfaces (contracts for implementations)
export type { Transport, MessageHandler, DisconnectHandler } from "./interfaces/Transport"
export type { AppLauncher, AppLaunchRequest, AppLaunchResult, AppMetadata } from "./interfaces/AppLauncher"

// State registries
export { AppInstanceRegistry } from "./state/AppInstanceRegistry"
export { IntentRegistry } from "./state/IntentRegistry"
export { AppDirectoryManager } from "./app-directory/appDirectoryManager"

// Transport implementations (will be moved to sail-api later)
export { SocketIOTransport } from "./transport/SocketIOTransport"

// Handler types (for advanced usage)
export type { DACPHandlerContext, DACPHandler } from "./handlers/types"

// Legacy function-based API (deprecated, for backward compatibility)
import type { Socket } from "socket.io"
import { AppDirectoryManager } from "./app-directory/appDirectoryManager"
import { AppInstanceRegistry } from "./state/AppInstanceRegistry"
import { IntentRegistry } from "./state/IntentRegistry"
import { routeDACPMessage, cleanupDACPHandlers } from "./handlers/dacp"
import type { DACPHandlerContext } from "./handlers/types"
import { SocketIOTransport } from "./transport/SocketIOTransport"

/**
 * Desktop Agent state and dependencies
 */
export interface DesktopAgentDependencies {
  appInstanceRegistry: AppInstanceRegistry
  intentRegistry: IntentRegistry
  appDirectory: AppDirectoryManager
}

/**
 * Socket connection handler returned by startDesktopAgent
 */
export interface DesktopAgentConnectionHandler {
  /**
   * Handle a new Socket.IO connection from an FDC3 app
   * @param socket - Socket.IO socket for the connected app
   */
  handleConnection: (socket: Socket) => void

  /**
   * Access to desktop agent state (for testing/debugging)
   */
  state: DesktopAgentDependencies
}

/**
 * Starts the FDC3 Desktop Agent and returns a connection handler.
 *
 * This creates the core state registries (AppInstanceRegistry, IntentRegistry, AppDirectory)
 * and returns a handler function to wire up Socket.IO connections.
 *
 * @example
 * ```typescript
 * const desktopAgent = startDesktopAgent()
 *
 * io.on('connection', (socket) => {
 *   desktopAgent.handleConnection(socket)
 * })
 * ```
 */
export function startDesktopAgent(): DesktopAgentConnectionHandler {
  // Create state registries once
  const state: DesktopAgentDependencies = {
    appInstanceRegistry: new AppInstanceRegistry(),
    intentRegistry: new IntentRegistry(),
    appDirectory: new AppDirectoryManager(),
  }

  return {
    state,
    handleConnection: (socket: Socket) => {
      // Create transport wrapper around Socket.IO socket
      const transport = new SocketIOTransport(socket)

      // Instance ID will be set after WCP handshake validates the app identity
      let instanceId: string | null = null

      // Listen for FDC3 messages
      socket.on("fdc3_message", async (message) => {
        // Create handler context
        const context: DACPHandlerContext = {
          transport,
          instanceId: instanceId || "", // WCP handler will set this
          appInstanceRegistry: state.appInstanceRegistry,
          intentRegistry: state.intentRegistry,
          appDirectory: state.appDirectory,
        }

        // Route message to appropriate handler
        await routeDACPMessage(message, context)

        // If instanceId was just set by WCP handler, capture it
        if (!instanceId && message && typeof message === 'object' && 'type' in message) {
          if (message.type === 'WCP4ValidateAppIdentity') {
            // After WCP validation, the instance should be registered
            // Find the most recently registered instance (this is a simplification)
            // TODO: Better way to communicate instanceId from WCP handler
            const instances = state.appInstanceRegistry.getAllInstances()
            if (instances.length > 0) {
              instanceId = instances[instances.length - 1].instanceId
              // Set the instanceId on the transport
              transport.setInstanceId(instanceId)
              // Store the transport reference in the instance
              const instance = state.appInstanceRegistry.getInstance(instanceId)
              if (instance) {
                instance.transport = transport
              }
            }
          }
        }
      })

      // Clean up when socket disconnects
      socket.on("disconnect", () => {
        if (instanceId) {
          const context: DACPHandlerContext = {
            transport,
            instanceId,
            appInstanceRegistry: state.appInstanceRegistry,
            intentRegistry: state.intentRegistry,
            appDirectory: state.appDirectory,
          }
          cleanupDACPHandlers(context)
        }
      })

      // Handle socket errors
      socket.on("error", (error) => {
        console.error("[Desktop Agent] Socket error:", error)
      })
    },
  }
}
