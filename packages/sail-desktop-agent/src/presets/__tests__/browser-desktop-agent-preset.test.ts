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

import { getBrowserDesktopAgentSession, isBrowserDesktopAgent } from "../../connectors/browser/browser-desktop-agent-session"

import type { DirectoryApp } from "../../core/app-directory/types"

import type { DesktopAgent } from "../../core/desktop-agent"

import type { IntentResolver } from "../../host-contracts"



type BrowserDesktopAgentFactory = (options?: {

  appLauncher?: unknown

  intentResolver?: IntentResolver

  apps?: DirectoryApp[]

  userChannels?: unknown

  appDirectories?: string[]

  autoStart?: boolean

}) => DesktopAgent



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



    const registeredApps = desktopAgent.getAppDirectory().retrieveAllApps()



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


