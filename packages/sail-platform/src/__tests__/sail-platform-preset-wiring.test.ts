/**
 * Verifies SailPlatform owns a SailDesktopAgent browser instance.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi } from "vite-plus/test"
import { SailDesktopAgent, type AppConnectionOptions } from "@finos/sail-desktop-agent"
import { SailPlatform } from "../sail-platform"

const TRUSTED_ORIGIN = "https://trusted.example.com"
const UNTRUSTED_ORIGIN = "https://evil.example.com"

/** Minimal WCP4ValidateAppIdentity envelope — mirrors wcp4-origin-allowlist.test.ts. */
function createWcp4Message(options: {
  messageOrigin: string
  instanceId: string
  connectionAttemptUuid: string
}): unknown {
  return {
    type: "WCP4ValidateAppIdentity",
    payload: {
      identityUrl: `${options.messageOrigin}/app`,
      actualUrl: `${options.messageOrigin}/app`,
    },
    meta: {
      messageOrigin: options.messageOrigin,
      source: { instanceId: options.instanceId },
      connectionAttemptUuid: options.connectionAttemptUuid,
    },
  }
}

type DesktopAgentWithHandleMessage = {
  handleMessage: (message: unknown) => Promise<void>
  connector: {
    connectionRegistry: { sendToAppInstance: (message: unknown) => void }
    options: Required<AppConnectionOptions>
  }
}

describe("SailPlatform desktop agent wiring", () => {
  it("starts a SailDesktopAgent with Sail host options", () => {
    const appLauncher = { launch: vi.fn() }
    const intentResolver = { resolve: vi.fn() }
    const apps = [
      {
        appId: "platform-app",
        title: "Platform App",
        type: "web" as const,
        details: { url: "https://example.com/app" },
      },
    ]

    const platform = new SailPlatform({
      appLauncher,
      intentResolver,
      apps,
      openContextListenerTimeoutMs: 4000,
      heartbeatIntervalMs: 15000,
      heartbeatTimeoutMs: 45000,
    })

    platform.start()

    expect(platform.isRunning).toBe(true)
    expect(platform.agent).toBeInstanceOf(SailDesktopAgent)
    expect(platform.connector).toBe((platform.agent as SailDesktopAgent).connector)
    expect(platform.apps.getById("platform-app")).toEqual(apps[0])

    platform.stop()
  })

  it("stop() delegates to the agent lifecycle", () => {
    const platform = new SailPlatform({
      appLauncher: { launch: vi.fn() },
    })

    platform.start()
    const agent = platform.agent
    const stopSpy = vi.spyOn(agent, "stop")

    platform.stop()

    expect(stopSpy).toHaveBeenCalledOnce()
    expect(platform.isRunning).toBe(false)
  })

  it("reaches the agent with allowedOrigins so a disallowed origin is rejected", async () => {
    const platform = new SailPlatform({
      appLauncher: { launch: vi.fn() },
      allowedOrigins: [TRUSTED_ORIGIN],
    })

    platform.start()

    const desktopAgent = platform.agent as unknown as DesktopAgentWithHandleMessage
    const sendSpy = vi.spyOn(desktopAgent.connector.connectionRegistry, "sendToAppInstance")

    await desktopAgent.handleMessage(
      createWcp4Message({
        messageOrigin: UNTRUSTED_ORIGIN,
        instanceId: "temp-reject-uuid",
        connectionAttemptUuid: "reject-uuid",
      }),
    )

    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: "WCP5ValidateAppIdentityFailedResponse" }),
    )

    platform.stop()
  })

  it("lets a caller-supplied appConnectionOptions value override the Sail default", () => {
    const platform = new SailPlatform({
      appLauncher: { launch: vi.fn() },
      appConnectionOptions: { handshakeTimeout: 9999 },
    })

    platform.start()

    const desktopAgent = platform.agent as unknown as DesktopAgentWithHandleMessage
    expect(desktopAgent.connector.options.handshakeTimeout).toBe(9999)

    platform.stop()
  })
})
