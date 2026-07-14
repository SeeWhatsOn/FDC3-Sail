import { describe, expect, it } from "vitest"
import { createWcp3Handshake } from "../wcp/create-wcp3-handshake"
import { isWCP1Hello } from "../wcp/wcp-types"
import type { AppConnectionMetadata } from "../wcp/wcp-types"
import {
  resolveAndPersistConnectionHostIdentifier,
  resolveConnectionHostIdentifier,
  resolveHostIdentifierFromSource,
} from "../wcp/wcp-host-identifier"

describe("isWCP1Hello", () => {
  it("accepts a WCP1Hello-shaped message", () => {
    expect(
      isWCP1Hello({
        type: "WCP1Hello",
        meta: {
          connectionAttemptUuid: "79be3ff9-7c05-4371-842a-cf08427c174d",
          timestamp: new Date().toISOString(),
        },
        payload: {},
      }),
    ).toBe(true)
  })

  it("rejects other messages", () => {
    expect(isWCP1Hello({ type: "WCP3Handshake", meta: {} })).toBe(false)
    expect(isWCP1Hello(null)).toBe(false)
  })
})

describe("createWcp3Handshake", () => {
  it("builds a WCP3Handshake with defaults", () => {
    const msg = createWcp3Handshake({
      connectionAttemptUuid: "uuid-1",
      timestamp: "2024-01-01T00:00:00.000Z",
    })
    expect(msg.type).toBe("WCP3Handshake")
    expect(msg.meta.connectionAttemptUuid).toBe("uuid-1")
    expect(msg.payload.fdc3Version).toBe("2.2")
    expect(msg.payload.intentResolverUrl).toBe(false)
    expect(msg.payload.channelSelectorUrl).toBe(false)
  })
})

describe("resolveHostIdentifierFromSource", () => {
  it("falls back to resolveHostIdentifier when window.name is empty", () => {
    const popup = { name: "" } as Window
    const resolved = resolveHostIdentifierFromSource(popup, {
      resolveHostIdentifier: (source) =>
        source === popup ? "launcher-from-registry" : undefined,
    })
    expect(resolved).toBe("launcher-from-registry")
  })

  it("prefers window.name over resolveHostIdentifier", () => {
    const popup = { name: "from-window-name" } as Window
    const resolved = resolveHostIdentifierFromSource(popup, {
      resolveHostIdentifier: () => "from-registry",
    })
    expect(resolved).toBe("from-window-name")
  })
})

describe("resolveConnectionHostIdentifier", () => {
  it("re-resolves from source when stored hostIdentifier is missing", () => {
    const popup = { name: "" } as Window
    const resolved = resolveConnectionHostIdentifier(
      { source: popup },
      { resolveHostIdentifier: () => "launcher-from-registry" },
    )
    expect(resolved).toBe("launcher-from-registry")
  })
})

describe("resolveAndPersistConnectionHostIdentifier", () => {
  it("writes re-resolved launcher id onto connection metadata", () => {
    const popup = { name: "" } as Window
    const connection = {
      instanceId: "temp-uuid",
      hostIdentifier: undefined,
      source: popup,
    } as AppConnectionMetadata

    const owner = {
      getConnection: (instanceId: string) =>
        instanceId === "temp-uuid" ? connection : undefined,
      resolveHostIdentifierForSource: (source: Window) =>
        source === popup ? "launcher-from-registry" : undefined,
    }

    const resolved = resolveAndPersistConnectionHostIdentifier(
      owner,
      "temp-uuid",
    )
    expect(resolved).toBe("launcher-from-registry")
    expect(connection.hostIdentifier).toBe("launcher-from-registry")
  })
})
