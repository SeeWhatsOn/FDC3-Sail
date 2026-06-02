/**
 * Top-level browser Desktop Agent preset tests (RED phase).
 *
 * Verifies createBrowserDesktopAgent is exported from @finos/sail-desktop-agent,
 * seeds apps directly, and wires intentResolver to WCPConnector resolution.
 *
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest"
import type { Context } from "@finos/fdc3"
import * as sailDesktopAgent from "../../index"
import type { DirectoryApp } from "../../core/app-directory/types"
import type { IntentResolver } from "../../host-contracts"

type BrowserDesktopAgentFactory = (options?: {
  appLauncher?: unknown
  intentResolver?: IntentResolver
  apps?: DirectoryApp[]
  userChannels?: unknown
  appDirectories?: string[]
}) => {
  desktopAgent: {
    getAppDirectory(): { retrieveAllApps(): DirectoryApp[] }
  }
  wcpConnector: {
    requestIntentResolution(payload: {
      requestId: string
      intent: string
      context: unknown
      handlers: Array<{ appId: string; instanceId?: string; isRunning: boolean; title?: string }>
    }): Promise<{ requestId: string; selectedHandler: { appId: string; instanceId?: string } | null }>
    start(): void
    stop(): void
  }
  start(): void
  stop(): void
}

const mockDirectoryApps: DirectoryApp[] = [
  {
    appId: "preset-app-one",
    title: "Preset App One",
    type: "web",
    details: { url: "https://example.com/preset-one" },
  },
  {
    appId: "preset-app-two",
    title: "Preset App Two",
    type: "web",
    details: { url: "https://example.com/preset-two" },
  },
]

function requireBrowserDesktopAgentFactory(): BrowserDesktopAgentFactory {
  const factory = (sailDesktopAgent as Record<string, unknown>).createBrowserDesktopAgent
  expect(factory).toBeDefined()
  expect(typeof factory).toBe("function")
  return factory as BrowserDesktopAgentFactory
}

describe("createBrowserDesktopAgent top-level preset", () => {
  const activeSessions: Array<{ stop(): void }> = []

  afterEach(() => {
    for (const session of activeSessions.splice(0)) {
      session.stop()
    }
  })

  it("exports createBrowserDesktopAgent from the top-level package entry", () => {
    expect((sailDesktopAgent as Record<string, unknown>).createBrowserDesktopAgent).toBeDefined()
  })

  it("returns lifecycle controls plus desktopAgent and wcpConnector", () => {
    const createBrowserDesktopAgent = requireBrowserDesktopAgentFactory()
    const session = createBrowserDesktopAgent()
    activeSessions.push(session)

    expect(session.desktopAgent).toBeDefined()
    expect(session.wcpConnector).toBeDefined()
    expect(typeof session.start).toBe("function")
    expect(typeof session.stop).toBe("function")
  })

  it("seeds the App Directory from apps without appDirectories URLs", () => {
    const createBrowserDesktopAgent = requireBrowserDesktopAgentFactory()
    const session = createBrowserDesktopAgent({ apps: mockDirectoryApps })
    activeSessions.push(session)

    const registeredApps = session.desktopAgent.getAppDirectory().retrieveAllApps()

    expect(registeredApps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ appId: "preset-app-one" }),
        expect.objectContaining({ appId: "preset-app-two" }),
      ])
    )
    expect(registeredApps).toHaveLength(2)
  })

  it("wires intentResolver to WCPConnector intent resolution", async () => {
    const createBrowserDesktopAgent = requireBrowserDesktopAgentFactory()

    const intentResolver: IntentResolver = {
      resolve: vi.fn(async request => ({
        selectedHandler: request.handlers[0],
        target: {
          appId: request.handlers[0].app.appId,
          instanceId: request.handlers[0].instanceId,
        },
      })),
    }

    const session = createBrowserDesktopAgent({ intentResolver })
    activeSessions.push(session)
    session.start()

    const resolutionPromise = session.wcpConnector.requestIntentResolution({
      requestId: "preset-intent-req-1",
      intent: "ViewContact",
      context: { type: "fdc3.contact", name: "Preset Contact" } satisfies Context,
      handlers: [
        {
          appId: "handler-a",
          title: "Handler A",
          isRunning: true,
          instanceId: "instance-a",
        },
        {
          appId: "handler-b",
          title: "Handler B",
          isRunning: false,
        },
      ],
    })

    await vi.waitFor(() => {
      expect(intentResolver.resolve).toHaveBeenCalledOnce()
    })

    expect(intentResolver.resolve).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "preset-intent-req-1",
        intent: "ViewContact",
        handlers: expect.arrayContaining([
          expect.objectContaining({
            app: expect.objectContaining({ appId: "handler-a" }),
            isRunning: true,
            instanceId: "instance-a",
          }),
        ]),
      })
    )

    await expect(resolutionPromise).resolves.toEqual({
      requestId: "preset-intent-req-1",
      selectedHandler: { appId: "handler-a", instanceId: "instance-a" },
    })
  })
})
