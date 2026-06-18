/**

 * Top-level browser Desktop Agent preset tests.

 *

 * Verifies createBrowserDesktopAgent is exported from @finos/sail-desktop-agent,

 * seeds apps directly, and wires intentResolver to WCPConnector resolution.

 *

 * @vitest-environment jsdom

 */

import { afterEach, describe, expect, it, vi } from "vitest"

import type { Context } from "@finos/fdc3"

import * as sailDesktopAgent from "../../index"

import { getBrowserDesktopAgentSession, isBrowserDesktopAgent } from "../browser-session"

import type { DirectoryApp } from "../../core/app-directory/types"
import { retrieveAllApps } from "../../core/app-directory/app-directory-queries"

import type { DesktopAgent } from "../../core/desktop-agent"

import type {
  IntentResolutionRequest,
  IntentResolver,
  IntentResolverUIMethods,
} from "../../host-contracts"

type TestBrowserDesktopAgent = DesktopAgent & {
  readonly intentResolverUI?: IntentResolverUIMethods
}

type BrowserDesktopAgentFactory = (options?: {
  appLauncher?: unknown

  intentResolver?: IntentResolver

  apps?: DirectoryApp[]

  userChannels?: unknown

  appDirectories?: string[]

  autoStart?: boolean

  wcpOptions?: { intentResolutionTimeout?: number }
}) => TestBrowserDesktopAgent

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
  const activeAgents: DesktopAgent[] = []

  afterEach(() => {
    for (const agent of activeAgents.splice(0)) {
      agent.stop()
    }

    vi.useRealTimers()
  })

  it("exports createBrowserDesktopAgent from the top-level package entry", () => {
    expect((sailDesktopAgent as Record<string, unknown>).createBrowserDesktopAgent).toBeDefined()
  })

  it("returns a DesktopAgent with coupled browser edge lifecycle", () => {
    const createBrowserDesktopAgent = requireBrowserDesktopAgentFactory()

    const desktopAgent = createBrowserDesktopAgent()

    activeAgents.push(desktopAgent)

    expect(isBrowserDesktopAgent(desktopAgent)).toBe(true)

    expect(getBrowserDesktopAgentSession(desktopAgent).wcpConnector).toBeDefined()

    expect(typeof desktopAgent.start).toBe("function")

    expect(typeof desktopAgent.stop).toBe("function")
  })

  it("seeds the App Directory from apps without appDirectories URLs", () => {
    const createBrowserDesktopAgent = requireBrowserDesktopAgentFactory()

    const desktopAgent = createBrowserDesktopAgent({ apps: mockDirectoryApps })

    activeAgents.push(desktopAgent)

    const registeredApps = retrieveAllApps(desktopAgent.getState().appDirectory)

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

    const resolveMock = vi.fn((request: IntentResolutionRequest) =>
      Promise.resolve({
        selectedHandler: request.handlers[0],
        target: {
          appId: request.handlers[0].app.appId,
          instanceId: request.handlers[0].instanceId,
        },
      })
    )

    const intentResolver: IntentResolver = {
      resolve: resolveMock,
    }

    const desktopAgent = createBrowserDesktopAgent({ intentResolver })

    activeAgents.push(desktopAgent)

    const resolutionPromise = getBrowserDesktopAgentSession(
      desktopAgent
    ).wcpConnector.requestIntentResolution({
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
      expect(resolveMock).toHaveBeenCalledOnce()
    })

    const resolverRequest = resolveMock.mock.calls[0]?.[0]
    expect(resolverRequest).toMatchObject({
      requestId: "preset-intent-req-1",
      intent: "ViewContact",
    })
    expect(resolverRequest?.handlers[0]).toMatchObject({
      app: { appId: "handler-a" },
      isRunning: true,
      instanceId: "instance-a",
    })

    await expect(resolutionPromise).resolves.toEqual({
      requestId: "preset-intent-req-1",

      selectedHandler: { appId: "handler-a", instanceId: "instance-a" },
    })
  })

  it("exposes framework-neutral intent resolver UI methods from the browser preset", async () => {
    const createBrowserDesktopAgent = requireBrowserDesktopAgentFactory()
    const desktopAgent = createBrowserDesktopAgent()
    activeAgents.push(desktopAgent)

    const session = getBrowserDesktopAgentSession(desktopAgent)
    const intentResolverUI = desktopAgent.intentResolverUI

    expect(intentResolverUI).toBeDefined()
    expect(session.intentResolverUI).toBe(intentResolverUI)

    let requestFromUi: IntentResolutionRequest | undefined
    intentResolverUI!.onRequest(request => {
      requestFromUi = request
    })

    const resolutionPromise = session.wcpConnector.requestIntentResolution({
      requestId: "preset-ui-select-1",
      intent: "ViewContact",
      context: { type: "fdc3.contact", name: "Preset Contact" } satisfies Context,
      handlers: [
        {
          appId: "handler-a",
          title: "Handler A",
          icons: [{ src: "https://example.com/handler-a.svg" }],
          isRunning: true,
          instanceId: "instance-a",
        },
      ],
    })

    await vi.waitFor(() => {
      expect(requestFromUi).toBeDefined()
    })

    expect(requestFromUi).toMatchObject({
      requestId: "preset-ui-select-1",
    })
    expect(requestFromUi?.handlers[0]).toMatchObject({
      app: {
        appId: "handler-a",
        title: "Handler A",
        icons: [{ src: "https://example.com/handler-a.svg" }],
      },
      isRunning: true,
      instanceId: "instance-a",
    })

    intentResolverUI!.select("preset-ui-select-1", requestFromUi!.handlers[0])

    await expect(resolutionPromise).resolves.toEqual({
      requestId: "preset-ui-select-1",
      selectedHandler: { appId: "handler-a", instanceId: "instance-a" },
      intent: "ViewContact",
    })
  })

  it("cancels through intentResolverUI before the WCP timeout fires", async () => {
    vi.useFakeTimers()

    const createBrowserDesktopAgent = requireBrowserDesktopAgentFactory()
    const desktopAgent = createBrowserDesktopAgent({
      wcpOptions: { intentResolutionTimeout: 20 },
    })
    activeAgents.push(desktopAgent)

    const session = getBrowserDesktopAgentSession(desktopAgent)
    const resolutionPromise = session.wcpConnector.requestIntentResolution({
      requestId: "preset-ui-timeout-1",
      intent: "ViewContact",
      context: { type: "fdc3.contact", name: "Preset Contact" } satisfies Context,
      handlers: [
        {
          appId: "handler-a",
          title: "Handler A",
          isRunning: false,
        },
      ],
    })

    await vi.advanceTimersByTimeAsync(19)

    await expect(resolutionPromise).resolves.toEqual({
      requestId: "preset-ui-timeout-1",
      selectedHandler: null,
    })
  })
})
