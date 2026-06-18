/**
 * Top-level browser Desktop Agent preset.
 *
 * Wraps the connector factory with host-contract options (`apps`, `intentResolver`)
 * so platform builders can import from `@finos/sail-desktop-agent` directly.
 */

import type { Context } from "@finos/fdc3"
import type { DirectoryApp } from "../core/app-directory/types"
import type { DesktopAgent } from "../core/desktop-agent"
import {
  createHostIntentResolver,
  type HostIntentResolverChoice,
  type HostIntentResolverHandler,
  type IntentHandler,
  type IntentResolutionChoice,
  type IntentResolver,
  type IntentResolverUIMethods,
  type IntentResolutionRequest,
} from "../host-contracts"
import {
  createBrowserDesktopAgent as createBrowserDesktopAgentCore,
  type BrowserDesktopAgentOptions as CoreBrowserDesktopAgentOptions,
} from "../connectors/browser/browser-desktop-agent.js"
import { getBrowserDesktopAgentSession } from "../connectors/browser/browser-desktop-agent-session.js"
import type { WCPConnector } from "../connectors/browser/wcp-connector.js"

const DEFAULT_WCP_INTENT_RESOLUTION_TIMEOUT_MS = 60000
const HOST_RESOLVER_TIMEOUT_BUFFER_MS = 1000

/**
 * Options for {@link createBrowserDesktopAgent} including host wiring.
 */
export interface BrowserDesktopAgentOptions extends CoreBrowserDesktopAgentOptions {
  /** Seed the App Directory without loading `appDirectories` URLs. */
  apps?: DirectoryApp[]

  /** Host intent resolver; wired to WCPConnector `intentResolverNeeded`. */
  intentResolver?: IntentResolver
}

export type BrowserDesktopAgent = DesktopAgent & {
  /** Framework-neutral host UI methods for ambiguous intent resolution. */
  readonly intentResolverUI?: IntentResolverUIMethods
}

function hasIntentResolverUI(
  resolver: IntentResolver
): resolver is IntentResolver & IntentResolverUIMethods {
  const candidate = resolver as Partial<IntentResolverUIMethods>
  return (
    typeof candidate.onRequest === "function" &&
    typeof candidate.select === "function" &&
    typeof candidate.cancel === "function" &&
    typeof candidate.getPendingRequests === "function"
  )
}

function mapHandler(intentName: string, handler: HostIntentResolverHandler): IntentHandler {
  return {
    app: handler,
    intent: { name: intentName, displayName: intentName },
    instanceId: handler.instanceId,
    isRunning: handler.isRunning,
  }
}

function mapChoice(choice: HostIntentResolverChoice): IntentResolutionChoice {
  return {
    intent: choice.intent,
    handler: {
      ...mapHandler(choice.intent.name, choice.handler),
      intent: choice.intent,
    },
  }
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
          handlers:
            payload.choices?.map(choice => mapChoice(choice).handler) ??
            payload.handlers.map(handler => mapHandler(payload.intent, handler)),
          choices:
            payload.choices?.map(choice => mapChoice(choice)) ??
            payload.handlers.map(handler => ({
              intent: { name: payload.intent, displayName: payload.intent },
              handler: mapHandler(payload.intent, handler),
            })),
        }

        const response = await resolver.resolve(request)

        const resolverResponse = {
          requestId: payload.requestId,
          selectedHandler: response
            ? {
                appId: response.target.appId,
                instanceId: response.target.instanceId,
              }
            : null,
          ...(response?.intent ? { intent: response.intent } : {}),
        }

        wcpConnector.resolveIntentSelection(resolverResponse)
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
 * Create a browser Desktop Agent with WCP edge coupled to {@link DesktopAgent.start}.
 */
export function createBrowserDesktopAgent(
  options?: BrowserDesktopAgentOptions
): BrowserDesktopAgent {
  const { intentResolver: providedIntentResolver, autoStart, ...coreOptions } = options ?? {}
  const wcpIntentResolutionTimeout =
    coreOptions.wcpOptions?.intentResolutionTimeout ?? DEFAULT_WCP_INTENT_RESOLUTION_TIMEOUT_MS
  const hostIntentResolver =
    providedIntentResolver ??
    createHostIntentResolver({
      timeoutMs: Math.max(0, wcpIntentResolutionTimeout - HOST_RESOLVER_TIMEOUT_BUFFER_MS),
    })
  const intentResolverUI = hasIntentResolverUI(hostIntentResolver) ? hostIntentResolver : undefined

  const desktopAgent = createBrowserDesktopAgentCore({
    ...coreOptions,
    autoStart: false,
  }) as BrowserDesktopAgent

  if (intentResolverUI) {
    Object.defineProperty(desktopAgent, "intentResolverUI", {
      value: intentResolverUI,
      enumerable: true,
      configurable: false,
    })
  }

  const session = getBrowserDesktopAgentSession(desktopAgent)
  session.intentResolverUI = intentResolverUI
  wireIntentResolver(session.wcpConnector, hostIntentResolver)

  if (autoStart !== false) {
    desktopAgent.start()
  }

  return desktopAgent
}
