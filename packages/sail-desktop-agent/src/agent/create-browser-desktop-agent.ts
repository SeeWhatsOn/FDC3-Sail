/**
 * Browser Desktop Agent preset — local DA + DA-owned WCP app connection + host intent resolver wiring.
 */

import type { Context } from "@finos/fdc3"
import { DesktopAgent } from "./desktop-agent"
import type { DesktopAgentOptions } from "./desktop-agent"
import type { AgentState } from "../state/types"
import { loadDirectoryIntoState } from "../state/mutators/app-directory"
import type { SailImplementationMetadata } from "./default-config"
import { consoleLogger } from "../interfaces/logger"
import type { Logger, LogPayloadDetail } from "../interfaces/logger"
import { BrowserAppConnection } from "../app-connection/browser-app-connection"
import type {
  AppConnectionMetadata,
  AppConnectionOptions,
} from "../app-connection/browser-app-connection"
import {
  createHostIntentResolver,
  type HostIntentResolverChoice,
  type HostIntentResolverHandler,
  type IntentHandler,
  type IntentResolver,
  type IntentResolverUIMethods,
  type IntentResolutionChoice,
  type IntentResolutionRequest,
} from "../host-contracts"
import {
  createBrowserHostControllers,
  markCollapsedBrowserDesktopAgent,
  type BrowserHostControllers,
} from "./browser-session.js"

const DEFAULT_WCP_INTENT_RESOLUTION_TIMEOUT_MS = 60000
const HOST_RESOLVER_TIMEOUT_BUFFER_MS = 1000

/** Preset-only access to DesktopAgent private state for async directory URL loading. */
type DesktopAgentMutableState = { state: AgentState }

async function loadAppDirectoriesFromUrls(agent: DesktopAgent, urls: string[]): Promise<void> {
  const internal = agent as unknown as DesktopAgentMutableState
  for (const url of urls) {
    internal.state = await loadDirectoryIntoState(internal.state, url)
  }
}

/**
 * Options for {@link createBrowserDesktopAgent}.
 */
export interface BrowserDesktopAgentOptions extends Pick<
  DesktopAgentOptions,
  | "appLauncher"
  | "userChannels"
  | "apps"
  | "openContextListenerTimeoutMs"
  | "heartbeatEnabled"
  | "heartbeatIntervalMs"
  | "heartbeatTimeoutMs"
> {
  implementationMetadata?: Partial<SailImplementationMetadata>
  appConnectionOptions?: AppConnectionOptions
  appDirectories?: string[]
  logger?: Logger
  logPayloadDetail?: LogPayloadDetail
  /**
   * Call {@link DesktopAgent.start} before returning.
   * @defaultValue `true`
   */
  autoStart?: boolean
  onAppConnected?: (metadata: AppConnectionMetadata) => void
  onAppDisconnected?: (instanceId: string) => void
  onHandshakeFailed?: (error: Error, connectionAttemptUuid: string) => void
  /** Host intent resolver; wired to WCPConnector `intentResolverNeeded`. */
  intentResolver?: IntentResolver
}

export type BrowserDesktopAgent = DesktopAgent &
  BrowserHostControllers & {
    readonly intentResolverUI?: IntentResolverUIMethods
  }

function hasIntentResolverUI(
  resolver: IntentResolver,
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

function wireIntentResolver(
  browserAppConnection: BrowserAppConnection,
  resolver: IntentResolver,
): void {
  browserAppConnection.on("intentResolverNeeded", payload => {
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

        browserAppConnection.resolveIntentSelection({
          requestId: payload.requestId,
          selectedHandler: response
            ? {
                appId: response.target.appId,
                instanceId: response.target.instanceId,
              }
            : null,
          ...(response?.intent ? { intent: response.intent } : {}),
        })
      } catch {
        browserAppConnection.resolveIntentSelection({
          requestId: payload.requestId,
          selectedHandler: null,
        })
      }
    })()
  })
}

/**
 * Create a browser Desktop Agent with DA-owned WCP app connection coupled to {@link DesktopAgent.start}.
 */
export function createBrowserDesktopAgent(
  options?: BrowserDesktopAgentOptions,
): BrowserDesktopAgent {
  const { intentResolver: providedIntentResolver, autoStart, ...localOptions } = options ?? {}
  const logger = localOptions.logger ?? consoleLogger

  const wcpIntentResolutionTimeout =
    localOptions.appConnectionOptions?.intentResolutionTimeout ??
    DEFAULT_WCP_INTENT_RESOLUTION_TIMEOUT_MS
  const hostIntentResolver =
    providedIntentResolver ??
    createHostIntentResolver({
      timeoutMs: Math.max(0, wcpIntentResolutionTimeout - HOST_RESOLVER_TIMEOUT_BUFFER_MS),
    })
  const intentResolverUI = hasIntentResolverUI(hostIntentResolver) ? hostIntentResolver : undefined

  const browserAppConnection = new BrowserAppConnection({
    ...localOptions.appConnectionOptions,
    logger,
  })

  const desktopAgent = new DesktopAgent({
    appLauncher: localOptions.appLauncher,
    apps: localOptions.apps,
    userChannels: localOptions.userChannels,
    implementationMetadata: localOptions.implementationMetadata,
    openContextListenerTimeoutMs: localOptions.openContextListenerTimeoutMs,
    heartbeatEnabled: localOptions.heartbeatEnabled,
    heartbeatIntervalMs: localOptions.heartbeatIntervalMs,
    heartbeatTimeoutMs: localOptions.heartbeatTimeoutMs,
    logger,
    logPayloadDetail: localOptions.logPayloadDetail,
    requestIntentResolution: request => browserAppConnection.requestIntentResolution(request),
  }) as BrowserDesktopAgent

  const agentWithState = desktopAgent as unknown as DesktopAgentMutableState
  browserAppConnection.bindAgentState({
    getAgentState: () => desktopAgent.getState(),
    setAgentState: callback => {
      agentWithState.state = callback(agentWithState.state)
    },
  })

  desktopAgent.attachAppConnection(browserAppConnection)
  markCollapsedBrowserDesktopAgent(desktopAgent, browserAppConnection, intentResolverUI)

  if (localOptions.appDirectories && localOptions.appDirectories.length > 0) {
    void loadAppDirectoriesFromUrls(desktopAgent, localOptions.appDirectories)
  }

  browserAppConnection.on("appConnected", metadata => {
    logger.info(`[BrowserDA] App connected: ${metadata.appId} (${metadata.instanceId})`)
    localOptions.onAppConnected?.(metadata)
  })

  browserAppConnection.on("appDisconnected", instanceId => {
    logger.info(`[BrowserDA] App disconnected: ${instanceId}`)
    localOptions.onAppDisconnected?.(instanceId)
  })

  browserAppConnection.on("handshakeFailed", (error, connectionAttemptUuid) => {
    logger.error(`[BrowserDA] WCP handshake failed for ${connectionAttemptUuid}:`, error)
    localOptions.onHandshakeFailed?.(error, connectionAttemptUuid)
  })

  wireIntentResolver(browserAppConnection, hostIntentResolver)

  if (intentResolverUI) {
    Object.defineProperty(desktopAgent, "intentResolverUI", {
      value: intentResolverUI,
      enumerable: true,
      configurable: false,
    })
  }

  const controllers = createBrowserHostControllers({
    desktopAgent,
    browserAppConnection,
    intentResolverUI,
  })

  for (const [key, controller] of Object.entries(controllers) as Array<
    [keyof BrowserHostControllers, BrowserHostControllers[keyof BrowserHostControllers]]
  >) {
    Object.defineProperty(desktopAgent, key, {
      value: controller,
      enumerable: true,
      configurable: false,
    })
  }

  if (autoStart !== false) {
    desktopAgent.start()
  }

  return desktopAgent
}
