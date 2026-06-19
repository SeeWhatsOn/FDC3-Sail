import { enableMapSet } from "immer"
import { describe, it, expect, vi } from "vitest"
import type { AppConnectionMetadata, SailPlatform } from "@finos/sail-platform-api"
import channelSelectorSource from "../../components/ChannelSelector.tsx?raw"
import connectionStoreSource from "../../stores/connection-store.ts?raw"
import { createConnectionStore } from "../../stores/connection-store"

enableMapSet()

const INSTANCE_ID = "test-instance-1"
const PANEL_ID = "test-panel-1"
const APP_ID = "test-app"
const CHANNEL_ID = "fdc3.channel.1"

type ConnectorListener = (...args: unknown[]) => void

function createMockConnector() {
  const listeners = new Map<string, ConnectorListener[]>()

  return {
    on: vi.fn((event: string, handler: ConnectorListener) => {
      const handlers = listeners.get(event) ?? []
      handlers.push(handler)
      listeners.set(event, handlers)
    }),
    off: vi.fn((event: string, handler: ConnectorListener) => {
      const handlers = listeners.get(event) ?? []
      listeners.set(
        event,
        handlers.filter(existing => existing !== handler)
      )
    }),
    emit: vi.fn((event: string, ...args: unknown[]) => {
      const handlers = listeners.get(event) ?? []
      handlers.forEach(handler => handler(...args))
    }),
  }
}

function createAppConnectedMetadata(
  overrides: Partial<AppConnectionMetadata> = {}
): AppConnectionMetadata {
  return {
    instanceId: INSTANCE_ID,
    appId: APP_ID,
    connectionAttemptUuid: "connection-attempt-uuid",
    messageOrigin: "https://example.com",
    source: window,
    port: {} as MessagePort,
    connectedAt: new Date(),
    hostIdentifier: PANEL_ID,
    ...overrides,
  }
}

describe("ConnectionStore channel membership", () => {
  it("updates connection channelId when connector emits channelChanged", () => {
    const connector = createMockConnector()
    const platform = { connector } as SailPlatform
    const store = createConnectionStore(platform)

    connector.emit("appConnected", createAppConnectedMetadata())

    expect(store.getState().getConnection(INSTANCE_ID)?.channelId).toBeUndefined()

    connector.emit("channelChanged", INSTANCE_ID, CHANNEL_ID)

    expect(store.getState().getConnection(INSTANCE_ID)?.channelId).toBe(CHANNEL_ID)
  })

  it("does not call DesktopAgent getState when channelChanged fires", () => {
    const connector = createMockConnector()
    const getState = vi.fn()
    const platform = {
      connector,
      agent: { getState },
    } as unknown as SailPlatform
    const store = createConnectionStore(platform)

    connector.emit("appConnected", createAppConnectedMetadata())
    connector.emit("channelChanged", INSTANCE_ID, CHANNEL_ID)

    expect(store.getState().getConnection(INSTANCE_ID)?.channelId).toBe(CHANNEL_ID)
    expect(getState).not.toHaveBeenCalled()
  })

  it("clears channelId when connector emits channelChanged with null", () => {
    const connector = createMockConnector()
    const platform = { connector } as SailPlatform
    const store = createConnectionStore(platform)

    connector.emit("appConnected", createAppConnectedMetadata())
    connector.emit("channelChanged", INSTANCE_ID, CHANNEL_ID)
    connector.emit("channelChanged", INSTANCE_ID, null)

    expect(store.getState().getConnection(INSTANCE_ID)?.channelId).toBeNull()
  })
})

describe("Channel UI source audit", () => {
  it("connection-store and ChannelSelector do not read DesktopAgent getState for channels", () => {
    expect(connectionStoreSource).not.toMatch(/getState\s*\(/)
    expect(channelSelectorSource).not.toMatch(/getState\s*\(/)
    expect(channelSelectorSource).toMatch(/getConnection/)
    expect(channelSelectorSource).toMatch(/changeAppChannel/)
  })
})
