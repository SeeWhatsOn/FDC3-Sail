/**
 * Top-level browser Desktop Agent preset.
 *
 * Wraps the connector factory with host-contract options (`apps`, `intentResolver`)
 * so platform builders can import from `@finos/sail-desktop-agent` directly.
 */

import type { Context } from "@finos/fdc3"
import type { DirectoryApp } from "../core/app-directory/types"
import type { IntentResolver, IntentResolutionRequest } from "../host-contracts"
import {
  createBrowserDesktopAgent as createBrowserDesktopAgentCore,
  type BrowserDesktopAgentOptions as CoreBrowserDesktopAgentOptions,
  type BrowserDesktopAgentResult,
} from "../connectors/browser/browser-desktop-agent.js"
import type { WCPConnector } from "../connectors/browser/wcp/wcp-connector.js"

export type { BrowserDesktopAgentResult }

/**
 * Options for {@link createBrowserDesktopAgent} including host wiring.
 */
export interface BrowserDesktopAgentOptions extends CoreBrowserDesktopAgentOptions {
  /** Seed the App Directory without loading `appDirectories` URLs. */
  apps?: DirectoryApp[]

  /** Host intent resolver; wired to WCPConnector `intentResolverNeeded`. */
  intentResolver?: IntentResolver
}

/**
 * Map WCP intent resolution payloads to {@link IntentResolutionRequest} and
 * reply via {@link WCPConnector.resolveIntentSelection}.
 */
function wireIntentResolver(wcpConnector: WCPConnector, resolver: IntentResolver): void {
  wcpConnector.on("intentResolverNeeded", payload => {
    void (async () => {
      try {
        const request: IntentResolutionRequest = {
          requestId: payload.requestId,
          intent: payload.intent,
          context: payload.context as Context,
          handlers: payload.handlers.map(handler => ({
            app: handler,
            intent: { name: payload.intent, displayName: payload.intent },
            instanceId: handler.instanceId,
            isRunning: handler.isRunning,
          })),
        }

        const response = await resolver.resolve(request)

        wcpConnector.resolveIntentSelection({
          requestId: payload.requestId,
          selectedHandler: response
            ? {
                appId: response.target.appId,
                instanceId: response.target.instanceId,
              }
            : null,
        })
      } catch {
        wcpConnector.resolveIntentSelection({
          requestId: payload.requestId,
          selectedHandler: null,
        })
      }
    })()
  })
}

/**
 * Create a browser Desktop Agent with WCP connector and optional host wiring.
 */
export function createBrowserDesktopAgent(
  options?: BrowserDesktopAgentOptions
): BrowserDesktopAgentResult {
  const intentResolver = options?.intentResolver
  const result = createBrowserDesktopAgentCore(
    options as CoreBrowserDesktopAgentOptions | undefined
  )

  if (intentResolver) {
    wireIntentResolver(result.wcpConnector, intentResolver)
  }

  return result
}
