import type { MessagePortTransport } from "./message-port-transport"
import type { WebConnectionProtocolMessage } from "@finos/fdc3-schema/dist/generated/api/BrowserTypes"
import type { AppConnectionMetadata, WCPConnectorEvents, WCPConnectorOptions } from "./wcp-types"

type EmitFunction = <EventName extends keyof WCPConnectorEvents>(
  event: EventName,
  ...args: Parameters<WCPConnectorEvents[EventName]>
) => void

export interface WCPConnectionContext {
  options: Required<WCPConnectorOptions>
  connections: Map<string, AppConnectionMetadata>
  messagePortTransports: Map<string, MessagePortTransport>
  transportToInstanceId: Map<MessagePortTransport, string>
  pendingDisconnects: Map<string, ReturnType<typeof setTimeout>>
  recentlyDisconnected: Map<string, { metadata: AppConnectionMetadata; disconnectedAt: number }>
  emit: EmitFunction
  log: (
    message: string,
    data?: Record<string, string | number | boolean | null | undefined>
  ) => void
}

/**
 * Handle WCP6Goodbye message from app
 * Implements delayed disconnect with grace period for reconnection
 */
export function handleWCP6Goodbye(context: WCPConnectionContext, instanceId: string): void {
  context.log(`Received WCP6Goodbye from app instance ${instanceId}`)

  // NOTE: WCP6Goodbye is sent by FDC3 get-agent library on pagehide events with persisted=false.
  // This includes false positives like tab moves, navigation, etc. where the app is still active.
  //
  // Current approach: Delay disconnect to allow reconnection within grace period.
  // This handles false-positive pagehide events from tab moves/navigation.
  //
  // Alternative approach (TODO): Consider using heartbeat-based detection instead.
  // Heartbeat already runs (30s interval, 60s timeout) and can detect actual disconnections.
  // Trade-offs:
  //   - Heartbeat: More accurate (only disconnects on actual failure), but slower (up to 60s delay)
  //   - Delayed WCP6Goodbye: Faster response (configurable), but requires grace period for false positives
  //   - Hybrid: Could ignore WCP6Goodbye and rely solely on heartbeat timeout for cleanup

  // Cancel any existing pending disconnect
  const existingTimeout = context.pendingDisconnects.get(instanceId)
  if (existingTimeout) {
    clearTimeout(existingTimeout)
  }

  const connection = context.connections.get(instanceId)
  const timeoutId = setTimeout(() => {
    context.pendingDisconnects.delete(instanceId)

    // Store in recently disconnected for potential restoration
    if (connection) {
      context.recentlyDisconnected.set(instanceId, {
        metadata: connection,
        disconnectedAt: Date.now(),
      })
    }

    // App is gracefully disconnecting - clean up
    disconnectApp(context, instanceId)
  }, context.options.disconnectGracePeriod)

  context.pendingDisconnects.set(instanceId, timeoutId)
}

/**
 * Clean up stale entries from recentlyDisconnected Map
 * Called periodically to prevent memory leaks
 */
export function cleanupStaleDisconnects(context: WCPConnectionContext): void {
  const fiveSecondsAgo = Date.now() - 5000
  for (const [id, entry] of context.recentlyDisconnected.entries()) {
    if (entry.disconnectedAt < fiveSecondsAgo) {
      context.recentlyDisconnected.delete(id)
    }
  }
}

/**
 * Disconnect an app by instanceId, sending WCP6Goodbye first
 * This is the public method to use when explicitly disconnecting an app
 *
 * @param instanceId - The instance ID of the app to disconnect
 */
export function disconnectAppByInstanceId(context: WCPConnectionContext, instanceId: string): void {
  const appTransport = context.messagePortTransports.get(instanceId)
  if (appTransport && appTransport.isConnected()) {
    // Send WCP6Goodbye message to the app before disconnecting
    try {
      const goodbyeMessage: WebConnectionProtocolMessage = {
        type: "WCP6Goodbye",
        payload: undefined,
        meta: {
          timestamp: new Date(),
        },
      }
      appTransport.send(goodbyeMessage)
      context.log(`Sent WCP6Goodbye to instance ${instanceId}`)
    } catch (error) {
      console.warn(`[WCPConnector] Failed to send WCP6Goodbye to instance ${instanceId}:`, error)
      // Continue with disconnection even if goodbye fails
    }
  }

  // Disconnect the app (this will clean up resources and emit appDisconnected event)
  disconnectApp(context, instanceId)
}

/**
 * Disconnect an app and clean up resources
 * This is the internal method that performs the actual cleanup
 */
export function disconnectApp(context: WCPConnectionContext, instanceId: string): void {
  const appTransport = context.messagePortTransports.get(instanceId)
  if (appTransport) {
    appTransport.disconnect()
    context.messagePortTransports.delete(instanceId)
    // Clean up reverse lookup
    context.transportToInstanceId.delete(appTransport)
  }

  context.connections.delete(instanceId)
  context.emit("appDisconnected", instanceId)
}

/**
 * Update connection metadata after WCP4 validation
 * Called by integration code when Desktop Agent validates app identity
 *
 * This method migrates the connection from temporary instanceId (temp-{uuid})
 * to the actual instanceId assigned by the Desktop Agent's AppInstanceRegistry.
 * Both the connections Map and messagePortTransports Map are updated to use
 * the new key, ensuring message routing continues to work correctly.
 */
export function updateConnectionMetadata(
  context: WCPConnectionContext,
  tempInstanceId: string,
  actualInstanceId: string,
  appId: string
): void {
  const metadata = context.connections.get(tempInstanceId)
  if (!metadata) {
    console.warn(`Cannot update connection metadata: temp instanceId ${tempInstanceId} not found`)
    return
  }

  // Cancel any pending disconnect for the actual instanceId (reconnection scenario)
  const pendingDisconnect = context.pendingDisconnects.get(actualInstanceId)
  if (pendingDisconnect) {
    clearTimeout(pendingDisconnect)
    context.pendingDisconnects.delete(actualInstanceId)
    context.log(`Cancelled pending disconnect for instance ${actualInstanceId} - reconnection detected`)
  }

  // Check if this is a reconnection to a recently disconnected instance
  const recentlyDisconnectedEntry = context.recentlyDisconnected.get(actualInstanceId)
  if (recentlyDisconnectedEntry) {
    context.log(
      `Restoring recently disconnected instance ${actualInstanceId} - reconnection within grace period`
    )
    // Restore the original metadata
    Object.assign(metadata, recentlyDisconnectedEntry.metadata)
    context.recentlyDisconnected.delete(actualInstanceId)
  }

  // Update metadata with validated info from Desktop Agent
  metadata.instanceId = actualInstanceId
  metadata.appId = appId

  // Migrate connection to actual instanceId key
  // This ensures future lookups use the validated instanceId
  context.connections.delete(tempInstanceId)
  context.connections.set(actualInstanceId, metadata)

  // Migrate transport reference to actual instanceId key
  const appTransport = context.messagePortTransports.get(tempInstanceId)
  if (appTransport) {
    context.messagePortTransports.delete(tempInstanceId)
    context.messagePortTransports.set(actualInstanceId, appTransport)
    // Update reverse lookup so bridgeTransports uses the actual instanceId
    context.transportToInstanceId.set(appTransport, actualInstanceId)
  } else {
    console.warn(`Transport not found for temp instanceId ${tempInstanceId} during metadata update`)
  }

  // Fire connected event now that validation is complete
  context.emit("appConnected", metadata)
}

/**
 * Get all active connections
 */
export function getConnections(context: WCPConnectionContext): AppConnectionMetadata[] {
  return Array.from(context.connections.values())
}

/**
 * Get connection metadata for a specific instance
 */
export function getConnection(
  context: WCPConnectionContext,
  instanceId: string
): AppConnectionMetadata | undefined {
  return context.connections.get(instanceId)
}
