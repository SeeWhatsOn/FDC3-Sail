/**
 * Reconnect must not leave two ports under one instance id, and must not copy
 * stale grace-period metadata onto a new handshake.
 *
 * When retiring a displaced transport, unregister `transportToInstanceId` (and
 * `messagePortTransports`) before `transport.disconnect()`. bridgeAppPort wires
 * onDisconnect → onInstanceTeardown; disconnect-before-unregister can tear down
 * the connection just installed under that id.
 *
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vite-plus/test"
import type { BrowserTypes } from "@finos/fdc3"
import type { SailDesktopAgent } from "../../agent/sail-desktop-agent"
import { clearAllHeartbeatTimersForTesting } from "../../handlers/heartbeat/runtime"
import { AppInstanceState } from "../../state/types"
import { MessagePortTransport } from "../message-port"
import { AppConnectionRegistry } from "../app-connection-registry"
import { consoleLogger } from "../../logging/logger"
import {
  disconnectApp,
  updateConnectionMetadata,
  type AppConnectionContext,
} from "../wcp/wcp-connection-management"
import type { AppConnectionMetadata } from "../wcp/wcp-types"
import { connectWcpApp, flushAsyncDelivery, TEST_ORIGIN } from "./wcp-edge-test-helpers"
import { createTestAgent, PORTFOLIO_APP } from "./wcp-desktop-agent.integration.fixtures"

function createWCP6Goodbye(): BrowserTypes.WebConnectionProtocol6Goodbye {
  return {
    type: "WCP6Goodbye",
    payload: undefined,
    meta: {
      timestamp: new Date(),
    },
  } as unknown as BrowserTypes.WebConnectionProtocol6Goodbye
}

function createUnitConnectionContext(options?: {
  disconnectGracePeriod?: number
  onInstanceTeardown?: (instanceId: string) => void
}): AppConnectionContext {
  const emit = vi.fn()
  const pendingDisconnects = new Map<string, ReturnType<typeof setTimeout>>()
  const recentlyDisconnected = new Map<
    string,
    { metadata: AppConnectionMetadata; disconnectedAt: number }
  >()

  const context: AppConnectionContext = {
    connectionRegistry: undefined as unknown as AppConnectionRegistry,
    options: {
      intentResolverUrl: false,
      channelSelectorUrl: false,
      getIntentResolverUrl: () => false,
      getChannelSelectorUrl: () => false,
      fdc3Version: "2.2",
      handshakeTimeout: 5000,
      disconnectGracePeriod: options?.disconnectGracePeriod ?? 2000,
      intentResolutionTimeout: 60000,
      debug: false,
      logger: consoleLogger,
      resolveHostIdentifier: () => undefined,
    },
    pendingDisconnects,
    recentlyDisconnected,
    emit,
    logger: consoleLogger,
    onInstanceTeardown: options?.onInstanceTeardown,
  }

  context.connectionRegistry = new AppConnectionRegistry({
    emit,
    logger: consoleLogger,
    updateConnectionMetadata: (temp, actual, appId) =>
      updateConnectionMetadata(context, temp, actual, appId),
    disconnectApp: instanceId => disconnectApp(context, instanceId),
  })

  return context
}

function seedConnection(
  context: AppConnectionContext,
  params: {
    instanceId: string
    appId?: string
    connectionAttemptUuid: string
    messageOrigin?: string
    source?: Window
    port: MessagePort
    transport: MessagePortTransport
    connectedAt?: Date
  },
): AppConnectionMetadata {
  const metadata: AppConnectionMetadata = {
    instanceId: params.instanceId,
    appId: params.appId ?? "portfolioApp",
    connectionAttemptUuid: params.connectionAttemptUuid,
    messageOrigin: params.messageOrigin ?? TEST_ORIGIN,
    source: params.source ?? ({} as Window),
    port: params.port,
    connectedAt: params.connectedAt ?? new Date(0),
  }
  context.connectionRegistry.connections.set(params.instanceId, metadata)
  context.connectionRegistry.messagePortTransports.set(params.instanceId, params.transport)
  context.connectionRegistry.transportToInstanceId.set(params.transport, params.instanceId)
  return metadata
}

describe("WCP reconnect clobber", () => {
  const activeAgents: SailDesktopAgent[] = []

  afterEach(() => {
    clearAllHeartbeatTimersForTesting()
    for (const agent of activeAgents.splice(0)) {
      agent.stop()
    }
    vi.useRealTimers()
  })

  it("does not Object.assign recentlyDisconnected metadata onto a reconnecting connection", () => {
    const context = createUnitConnectionContext()
    const validatedId = "validated-reconnect-wcp-d"

    const oldChannel = new MessageChannel()
    const oldTransport = new MessagePortTransport(oldChannel.port2)
    const oldSource = { name: "old-window" } as unknown as Window
    const oldMetadata = seedConnection(context, {
      instanceId: validatedId,
      connectionAttemptUuid: "old-attempt-uuid",
      messageOrigin: "https://old.example",
      source: oldSource,
      port: oldChannel.port2,
      transport: oldTransport,
      connectedAt: new Date(1),
    })

    // Grace already fired: snapshot sits in recentlyDisconnected; live maps no longer hold it.
    context.connectionRegistry.connections.delete(validatedId)
    context.connectionRegistry.messagePortTransports.delete(validatedId)
    context.connectionRegistry.transportToInstanceId.delete(oldTransport)
    context.recentlyDisconnected.set(validatedId, {
      metadata: { ...oldMetadata },
      disconnectedAt: Date.now(),
    })

    const newChannel = new MessageChannel()
    const newTransport = new MessagePortTransport(newChannel.port2)
    const newSource = { name: "new-window" } as unknown as Window
    const tempId = "temp-new-reconnect-uuid"
    seedConnection(context, {
      instanceId: tempId,
      connectionAttemptUuid: "new-attempt-uuid",
      messageOrigin: "https://new.example",
      source: newSource,
      port: newChannel.port2,
      transport: newTransport,
      connectedAt: new Date(9_000),
    })

    updateConnectionMetadata(context, tempId, validatedId, "portfolioApp")

    const restored = context.connectionRegistry.connections.get(validatedId)
    expect(restored).toBeDefined()

    // New handshake fields must win — never the recentlyDisconnected snapshot.
    // Boolean checks avoid Vitest deep-printing MessagePort/Window (circular → stack overflow).
    expect(restored!.connectionAttemptUuid).toBe("new-attempt-uuid")
    expect(restored!.messageOrigin).toBe("https://new.example")
    expect(restored!.port === newChannel.port2).toBe(true)
    expect(restored!.source === newSource).toBe(true)
    expect(restored!.connectionAttemptUuid).not.toBe("old-attempt-uuid")
    expect(restored!.messageOrigin).not.toBe("https://old.example")
    expect(restored!.port === oldChannel.port2).toBe(false)
    expect(restored!.source === oldSource).toBe(false)
    expect(context.recentlyDisconnected.has(validatedId)).toBe(false)
  })

  it("does not tear down the new connection when goodbye arrives on a displaced old port", async () => {
    const agent = createTestAgent({ disconnectGracePeriod: 25 })
    activeAgents.push(agent)
    const connector = agent.appConnection

    const disconnectedInstanceIds: string[] = []
    connector.on("appDisconnected", instanceId => {
      disconnectedInstanceIds.push(instanceId)
    })

    const first = await connectWcpApp(agent, {
      connectionAttemptUuid: "wcp-c-first-uuid",
      appId: PORTFOLIO_APP.appId,
      identityUrl: PORTFOLIO_APP.details.url,
    })

    const second = await connectWcpApp(agent, {
      connectionAttemptUuid: "wcp-c-second-uuid",
      appId: PORTFOLIO_APP.appId,
      identityUrl: PORTFOLIO_APP.details.url,
      hostInstanceId: first.validatedInstanceId,
      instanceUuid: first.instanceUuid,
    })

    expect(second.validatedInstanceId).toBe(first.validatedInstanceId)

    // Displaced first tab still talks — goodbye on the OLD port must not kill the NEW connection.
    first.appPort.postMessage(createWCP6Goodbye())
    await flushAsyncDelivery()
    await new Promise(resolve => setTimeout(resolve, 150))
    await flushAsyncDelivery()

    expect(disconnectedInstanceIds).not.toContain(second.validatedInstanceId)
    expect(connector.getConnection(second.validatedInstanceId)).toBeDefined()
    expect(agent.getState().instances[second.validatedInstanceId]?.state).toBe(
      AppInstanceState.CONNECTED,
    )
  })

  it("cancels grace teardown when reconnect completes before the timer fires", async () => {
    const agent = createTestAgent({ disconnectGracePeriod: 80 })
    activeAgents.push(agent)
    const connector = agent.appConnection

    const disconnectedInstanceIds: string[] = []
    connector.on("appDisconnected", instanceId => {
      disconnectedInstanceIds.push(instanceId)
    })

    const first = await connectWcpApp(agent, {
      connectionAttemptUuid: "grace-armed-first-uuid",
      appId: PORTFOLIO_APP.appId,
      identityUrl: PORTFOLIO_APP.details.url,
    })

    first.appPort.postMessage(createWCP6Goodbye())
    await flushAsyncDelivery()

    const second = await connectWcpApp(agent, {
      connectionAttemptUuid: "grace-armed-second-uuid",
      appId: PORTFOLIO_APP.appId,
      identityUrl: PORTFOLIO_APP.details.url,
      hostInstanceId: first.validatedInstanceId,
      instanceUuid: first.instanceUuid,
    })

    expect(second.validatedInstanceId).toBe(first.validatedInstanceId)

    // Advance past the original grace window — no late disconnect for validated id.
    await new Promise(resolve => setTimeout(resolve, 200))
    await flushAsyncDelivery()

    expect(disconnectedInstanceIds).not.toContain(first.validatedInstanceId)
    expect(connector.getConnection(first.validatedInstanceId)).toBeDefined()
    expect(agent.getState().instances[first.validatedInstanceId]?.state).toBe(
      AppInstanceState.CONNECTED,
    )
  })

  it("keeps the new connection when the displaced transport is retired via disconnect", () => {
    const tornDown: string[] = []
    const context = createUnitConnectionContext({
      onInstanceTeardown: instanceId => {
        tornDown.push(instanceId)
        disconnectApp(context, instanceId)
      },
    })

    const validatedId = "validated-retire-order"
    const oldChannel = new MessageChannel()
    const oldTransport = new MessagePortTransport(oldChannel.port2)
    seedConnection(context, {
      instanceId: validatedId,
      connectionAttemptUuid: "old-retire-uuid",
      source: { name: "old" } as unknown as Window,
      port: oldChannel.port2,
      transport: oldTransport,
    })
    // Mirror bridgeAppPort: onDisconnect → teardown using reverse-map lookup.
    oldTransport.onDisconnect(() => {
      const mappedId = context.connectionRegistry.transportToInstanceId.get(oldTransport)
      if (mappedId) {
        context.onInstanceTeardown?.(mappedId)
      }
    })

    const newChannel = new MessageChannel()
    const newTransport = new MessagePortTransport(newChannel.port2)
    const tempId = "temp-retire-order-uuid"
    seedConnection(context, {
      instanceId: tempId,
      connectionAttemptUuid: "new-retire-uuid",
      messageOrigin: "https://new.example",
      source: { name: "new" } as unknown as Window,
      port: newChannel.port2,
      transport: newTransport,
    })

    updateConnectionMetadata(context, tempId, validatedId, "portfolioApp")

    // Displaced transport must already be unmapped; disconnect must not tear down the validated id.
    expect(context.connectionRegistry.transportToInstanceId.has(oldTransport)).toBe(false)
    oldTransport.disconnect()

    expect(tornDown).not.toContain(validatedId)
    expect(context.connectionRegistry.connections.get(validatedId)).toBeDefined()
    expect(context.connectionRegistry.messagePortTransports.get(validatedId) === newTransport).toBe(
      true,
    )
    expect(context.connectionRegistry.transportToInstanceId.get(newTransport)).toBe(validatedId)
  })

  it("removes the instance when grace expires with no reconnect", async () => {
    const agent = createTestAgent({ disconnectGracePeriod: 25 })
    activeAgents.push(agent)
    const connector = agent.appConnection

    const connected = await connectWcpApp(agent, {
      connectionAttemptUuid: "grace-expire-no-reconnect-uuid",
      appId: PORTFOLIO_APP.appId,
      identityUrl: PORTFOLIO_APP.details.url,
    })

    connected.appPort.postMessage(createWCP6Goodbye())
    await flushAsyncDelivery()
    await new Promise(resolve => setTimeout(resolve, 150))
    await flushAsyncDelivery()

    expect(connector.getConnection(connected.validatedInstanceId)).toBeUndefined()
    expect(agent.getState().instances[connected.validatedInstanceId]).toBeUndefined()
  })

  it("does not half-restore stale recentlyDisconnected metadata onto a fresh post-grace connection", () => {
    // After grace, remapping onto the same validated id must keep this handshake's
    // port/source/origin/uuid — not copy fields from a stale recentlyDisconnected snapshot.
    const context = createUnitConnectionContext()
    const validatedId = "validated-post-grace"

    const staleChannel = new MessageChannel()
    const staleTransport = new MessagePortTransport(staleChannel.port2)
    const staleMeta = seedConnection(context, {
      instanceId: validatedId,
      connectionAttemptUuid: "stale-post-grace-uuid",
      messageOrigin: "https://stale.example",
      source: { name: "stale" } as unknown as Window,
      port: staleChannel.port2,
      transport: staleTransport,
    })
    context.connectionRegistry.connections.delete(validatedId)
    context.connectionRegistry.messagePortTransports.delete(validatedId)
    context.connectionRegistry.transportToInstanceId.delete(staleTransport)
    context.recentlyDisconnected.set(validatedId, {
      metadata: { ...staleMeta },
      disconnectedAt: Date.now() - 10,
    })

    const freshChannel = new MessageChannel()
    const freshTransport = new MessagePortTransport(freshChannel.port2)
    const tempId = "temp-post-grace-uuid"
    seedConnection(context, {
      instanceId: tempId,
      connectionAttemptUuid: "fresh-post-grace-uuid",
      messageOrigin: "https://fresh.example",
      source: { name: "fresh" } as unknown as Window,
      port: freshChannel.port2,
      transport: freshTransport,
    })

    updateConnectionMetadata(context, tempId, validatedId, "portfolioApp")

    const live = context.connectionRegistry.connections.get(validatedId)
    expect(live).toBeDefined()
    expect(live!.connectionAttemptUuid).toBe("fresh-post-grace-uuid")
    expect(live!.messageOrigin).toBe("https://fresh.example")
    expect(live!.port === freshChannel.port2).toBe(true)
    expect((live!.source as { name?: string }).name).toBe("fresh")
  })

  it("leaves exactly one transport mapped to the validated id after remap (no dual reverse-map)", () => {
    const context = createUnitConnectionContext()
    const validatedId = "validated-dual-map"

    const oldChannel = new MessageChannel()
    const oldTransport = new MessagePortTransport(oldChannel.port2)
    seedConnection(context, {
      instanceId: validatedId,
      connectionAttemptUuid: "old-dual-uuid",
      port: oldChannel.port2,
      transport: oldTransport,
    })

    const newChannel = new MessageChannel()
    const newTransport = new MessagePortTransport(newChannel.port2)
    const tempId = "temp-dual-uuid"
    seedConnection(context, {
      instanceId: tempId,
      connectionAttemptUuid: "new-dual-uuid",
      messageOrigin: "https://new.example",
      port: newChannel.port2,
      transport: newTransport,
    })

    updateConnectionMetadata(context, tempId, validatedId, "portfolioApp")

    const reverseValidatedCount = [
      ...context.connectionRegistry.transportToInstanceId.values(),
    ].filter(id => id === validatedId).length
    expect(reverseValidatedCount).toBe(1)
    expect(context.connectionRegistry.transportToInstanceId.get(newTransport)).toBe(validatedId)
    expect(context.connectionRegistry.messagePortTransports.get(validatedId) === newTransport).toBe(
      true,
    )
    expect(context.connectionRegistry.transportToInstanceId.has(oldTransport)).toBe(false)
  })
})
