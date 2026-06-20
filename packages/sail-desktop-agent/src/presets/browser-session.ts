import type { BrowserTypes } from "@finos/fdc3"

import { retrieveAllApps } from "../core/app-directory/app-directory-queries"
import type { DirectoryApp } from "../core/app-directory/types"
import type { DesktopAgent } from "../core/desktop-agent"
import type { Transport } from "../core/interfaces/transport"
import type { WCPConnector } from "../app-connection/wcp-connector"
import type {
  BrowserIntentResolverController,
  IntentHandler,
  IntentResolutionChoice,
  IntentResolutionRequest,
  IntentResolverUIMethods,
} from "../host-contracts"

export type { BrowserIntentResolverController } from "../host-contracts"

/** Grouped browser host controllers attached to the preset handle. */
export interface BrowserHostControllers {
  intentResolver: BrowserIntentResolverController
  channels: BrowserChannelsController
  apps: BrowserAppsController
}

/** Host notification when an app's user channel membership changes. */
export interface AppChannelChangeEvent {
  instanceId: string
  channelId: string | null
  channel: BrowserTypes.Channel | null
}

/** Browser host channel chrome over DesktopAgent + WCP connector events. */
export interface BrowserChannelsController {
  getUserChannels: () => BrowserTypes.Channel[]
  getAppChannelId: (instanceId: string) => string | null
  getAppChannel: (instanceId: string) => BrowserTypes.Channel | null
  changeAppChannel: (instanceId: string, channelId: string | null) => Promise<void>
  onAppChannelChange: (listener: (event: AppChannelChangeEvent) => void) => () => void
}

/** App catalog host chrome placeholder — full behavior added in follow-up slices. */
export interface BrowserAppsController {
  getAll: () => DirectoryApp[]
}

export interface BrowserHostControllerOptions {
  desktopAgent: DesktopAgent
  wcpConnector: WCPConnector
  connectorTransport: Transport
  intentResolverUI?: IntentResolverUIMethods
}

export interface BrowserDesktopAgentSession {
  wcpConnector: WCPConnector
  connectorTransport: Transport
  intentResolverUI?: IntentResolverUIMethods
}

const browserDesktopAgentSessions = new WeakMap<DesktopAgent, BrowserDesktopAgentSession>()

export function registerBrowserDesktopAgentSession(
  desktopAgent: DesktopAgent,
  session: BrowserDesktopAgentSession
): void {
  browserDesktopAgentSessions.set(desktopAgent, session)
}

export function isBrowserDesktopAgent(desktopAgent: DesktopAgent): boolean {
  return browserDesktopAgentSessions.has(desktopAgent)
}

/**
 * Edge internals for a {@link DesktopAgent} created by {@link createBrowserDesktopAgent}.
 * Integrators normally do not need this — use {@link SailPlatform} or host contracts instead.
 */
export function getBrowserDesktopAgentSession(
  desktopAgent: DesktopAgent
): BrowserDesktopAgentSession {
  const session = browserDesktopAgentSessions.get(desktopAgent)
  if (!session) {
    throw new Error(
      "Not a browser Desktop Agent from createBrowserDesktopAgent(). Use getBrowserDesktopAgentSession only on preset instances."
    )
  }
  return session
}

export function clearBrowserDesktopAgentSession(desktopAgent: DesktopAgent): void {
  browserDesktopAgentSessions.delete(desktopAgent)
}

/**
 * Build grouped browser host controllers for preset or manual DesktopAgent + WCP wiring.
 * Methods are closure-based so hosts can destructure them safely.
 */
function resolveUserChannelById(
  desktopAgent: DesktopAgent,
  channelId: string | null
): BrowserTypes.Channel | null {
  if (channelId === null) {
    return null
  }
  return desktopAgent.getUserChannels().find(channel => channel.id === channelId) ?? null
}

export function createBrowserHostControllers(
  options: BrowserHostControllerOptions
): BrowserHostControllers {
  const { desktopAgent, wcpConnector, intentResolverUI } = options

  const intentResolver: BrowserIntentResolverController = {
    getPendingRequests: () => intentResolverUI?.getPendingRequests() ?? [],
    onRequest: (listener: (request: IntentResolutionRequest) => void) =>
      intentResolverUI?.onRequest(listener) ?? (() => {}),
    select: (requestId: string, choice: IntentResolutionChoice | IntentHandler) => {
      intentResolverUI?.select(requestId, choice)
    },
    cancel: (requestId: string) => {
      intentResolverUI?.cancel(requestId)
    },
  }

  const channels: BrowserChannelsController = {
    getUserChannels: () => desktopAgent.getUserChannels(),
    getAppChannelId: instanceId => desktopAgent.getAppUserChannelId(instanceId),
    getAppChannel: instanceId => {
      const channelId = desktopAgent.getAppUserChannelId(instanceId)
      return resolveUserChannelById(desktopAgent, channelId)
    },
    changeAppChannel: (instanceId, channelId) => {
      desktopAgent.changeAppUserChannel(instanceId, channelId)
      return Promise.resolve()
    },
    onAppChannelChange: listener => {
      const handler = (instanceId: string, channelId: string | null) => {
        listener({
          instanceId,
          channelId,
          channel: resolveUserChannelById(desktopAgent, channelId),
        })
      }
      wcpConnector.on("channelChanged", handler)
      return () => {
        wcpConnector.off("channelChanged", handler)
      }
    },
  }

  const apps: BrowserAppsController = {
    getAll: () => retrieveAllApps(desktopAgent.getState().appDirectory),
  }

  return { intentResolver, channels, apps }
}
