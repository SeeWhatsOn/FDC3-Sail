import { describe, it, expect, vi, beforeEach } from "vitest"
import type { DesktopAgent } from "@finos/sail-desktop-agent"
import { wireWcp4OriginAllowlist } from "../wcp4-origin-allowlist"

const TRUSTED_ORIGIN = "https://trusted.example.com"
const UNTRUSTED_ORIGIN = "https://evil.example.com"

function createWcp4Message(options: {
  messageOrigin: string
  instanceId?: string
  connectionAttemptUuid?: string
}): unknown {
  return {
    type: "WCP4ValidateAppIdentity",
    payload: {
      identityUrl: `${options.messageOrigin}/app`,
      actualUrl: `${options.messageOrigin}/app`,
    },
    meta: {
      messageOrigin: options.messageOrigin,
      source: { instanceId: options.instanceId ?? "temp-reject-uuid" },
      ...(options.connectionAttemptUuid !== undefined
        ? { connectionAttemptUuid: options.connectionAttemptUuid }
        : {}),
    },
  }
}

function createMockDesktopAgent(): {
  desktopAgent: DesktopAgent
  transportSend: ReturnType<typeof vi.fn>
  innerHandleMessage: ReturnType<typeof vi.fn>
} {
  const transportSend = vi.fn()
  const innerHandleMessage = vi.fn(async () => undefined)

  const desktopAgent = {
    transport: { send: transportSend },
    handleMessage: innerHandleMessage,
  } as unknown as DesktopAgent

  return { desktopAgent, transportSend, innerHandleMessage }
}

describe("wireWcp4OriginAllowlist", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("sends WCP5ValidateAppIdentityFailedResponse when origin is not on allowlist", async () => {
    const { desktopAgent, transportSend, innerHandleMessage } = createMockDesktopAgent()

    wireWcp4OriginAllowlist(desktopAgent, [TRUSTED_ORIGIN])

    await desktopAgent.handleMessage(
      createWcp4Message({
        messageOrigin: UNTRUSTED_ORIGIN,
        instanceId: "temp-reject-uuid",
        connectionAttemptUuid: "reject-uuid",
      })
    )

    expect(transportSend).toHaveBeenCalledTimes(1)
    expect(transportSend).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "WCP5ValidateAppIdentityFailedResponse",
        payload: { message: expect.stringMatching(/not allowed/i) },
        meta: expect.objectContaining({
          connectionAttemptUuid: "reject-uuid",
          destination: { instanceId: "temp-reject-uuid" },
        }),
      })
    )
    expect(innerHandleMessage).not.toHaveBeenCalled()
  })

  it("forwards WCP4 to the original handler when origin is on allowlist", async () => {
    const { desktopAgent, transportSend, innerHandleMessage } = createMockDesktopAgent()

    wireWcp4OriginAllowlist(desktopAgent, [TRUSTED_ORIGIN])

    const message = createWcp4Message({
      messageOrigin: TRUSTED_ORIGIN,
      instanceId: "temp-trusted-uuid",
      connectionAttemptUuid: "trusted-uuid",
    })

    await desktopAgent.handleMessage(message)

    expect(transportSend).not.toHaveBeenCalled()
    expect(innerHandleMessage).toHaveBeenCalledTimes(1)
    expect(innerHandleMessage).toHaveBeenCalledWith(message)
  })

  it("derives connectionAttemptUuid from temp instanceId when meta omits it", async () => {
    const { desktopAgent, transportSend } = createMockDesktopAgent()

    wireWcp4OriginAllowlist(desktopAgent, [TRUSTED_ORIGIN])

    await desktopAgent.handleMessage(
      createWcp4Message({
        messageOrigin: UNTRUSTED_ORIGIN,
        instanceId: "temp-derived-uuid",
      })
    )

    expect(transportSend).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: expect.objectContaining({ connectionAttemptUuid: "derived-uuid" }),
      })
    )
  })

  it("forwards non-WCP4 messages to the original handler unchanged", async () => {
    const { desktopAgent, transportSend, innerHandleMessage } = createMockDesktopAgent()

    wireWcp4OriginAllowlist(desktopAgent, [TRUSTED_ORIGIN])

    const heartbeat = { type: "heartbeatRequest", payload: {}, meta: {} }

    await desktopAgent.handleMessage(heartbeat)

    expect(transportSend).not.toHaveBeenCalled()
    expect(innerHandleMessage).toHaveBeenCalledWith(heartbeat)
  })
})
