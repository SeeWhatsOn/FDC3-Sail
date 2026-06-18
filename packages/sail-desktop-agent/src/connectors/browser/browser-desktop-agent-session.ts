import type { DesktopAgent } from "../../core/desktop-agent"
import type { IntentResolverUIMethods } from "../../host-contracts"
import type { Transport } from "../../core/interfaces/transport"
import type { WCPConnector } from "./wcp-connector"

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
