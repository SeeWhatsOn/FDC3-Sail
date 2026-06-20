import type { BrowserTypes } from "@finos/fdc3"

import { retrieveAllApps } from "../core/app-directory/app-directory-queries"
import type { DirectoryApp } from "../core/app-directory/types"
import type { DesktopAgent } from "../core/desktop-agent"
import type { Transport } from "../core/interfaces/transport"
import type { WCPConnector } from "../app-connection/wcp-connector"
import type { BrowserIntentResolverController, IntentResolverUIMethods } from "../host-contracts"

export type { BrowserIntentResolverController } from "../host-contracts"

/** Grouped browser host controllers attached to the preset handle. */
export interface BrowserHostControllers {
  intentResolver: BrowserIntentResolverController
  channels: BrowserChannelsController
  apps: BrowserAppsController
}

/** Channel host chrome placeholder — full behavior added in follow-up slices. */
export interface BrowserChannelsController {
  getUserChannels: () => BrowserTypes.Channel[]
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
export function createBrowserHostControllers(
  options: BrowserHostControllerOptions
): BrowserHostControllers {
  const { desktopAgent, intentResolverUI } = options

  const intentResolver: BrowserIntentResolverController = {
    getPendingRequests: () => intentResolverUI?.getPendingRequests() ?? [],
    onRequest: listener => intentResolverUI?.onRequest(listener) ?? (() => {}),
    select: (requestId, choice) => {
      intentResolverUI?.select(requestId, choice)
    },
    cancel: requestId => {
      intentResolverUI?.cancel(requestId)
    },
  }

  const channels: BrowserChannelsController = {
    getUserChannels: () => desktopAgent.getUserChannels(),
  }

  const apps: BrowserAppsController = {
    getAll: () => retrieveAllApps(desktopAgent.getState().appDirectory),
  }

  return { intentResolver, channels, apps }
}
