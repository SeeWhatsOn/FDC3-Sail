/**
 * Browser-ready Sail Desktop Agent.
 *
 * Owns the browser WCP app connection and exposes host shell controls directly
 * on the agent instance. Lower-level WCP mechanics stay in BrowserAppConnection.
 */

import type { Context } from "@finos/fdc3"

import { BrowserAppConnection } from "../app-connection/browser-app-connection"
import type {
  AppConnectionMetadata,
  AppConnectionOptions,
} from "../app-connection/browser-app-connection"
import type { DirectoryApp } from "../app-directory/types"
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
import { consoleLogger, type Logger, type LogPayloadDetail } from "../interfaces/logger"
import type { SailImplementationMetadata } from "./default-config"
import {
  DesktopAgent,
  type DesktopAgentAppInstance,
  type DesktopAgentOpenOptions,
  type DesktopAgentOptions,
} from "./desktop-agent"
import type { BrowserTypes } from "@finos/fdc3"

const DEFAULT_WCP_INTENT_RESOLUTION_TIMEOUT_MS = 60000
const HOST_RESOLVER_TIMEOUT_BUFFER_MS = 1000

export interface AppChannelChangeEvent {
  instanceId: string
  channelId: string | null
  channel: BrowserTypes.Channel | null
}

export interface HandshakeFailureEvent {
  error: Error
  connectionAttemptUuid: string
}

export interface SailDesktopAgentChannels {
  getUserChannels: () => BrowserTypes.Channel[]
  getAppChannelId: (instanceId: string) => string | null
  getAppChannel: (instanceId: string) => BrowserTypes.Channel | null
  changeAppChannel: (instanceId: string, channelId: string | null) => Promise<void>
  onAppChannelChange: (listener: (event: AppChannelChangeEvent) => void) => () => void
}

export interface SailDesktopAgentApps {
  add: (app: DirectoryApp) => void
  addAll: (apps: DirectoryApp[]) => void
  addDirectory: (url: string) => Promise<void>
  remove: (appId: string) => void
  getAll: () => DirectoryApp[]
  getById: (appId: string) => DirectoryApp | undefined
  open: (
    app: string | BrowserTypes.AppIdentifier,
    options?: DesktopAgentOpenOptions,
  ) => Promise<BrowserTypes.AppIdentifier>
  getInstances: () => DesktopAgentAppInstance[]
  getInstance: (instanceId: string) => DesktopAgentAppInstance | undefined
  getConnections: () => AppConnectionMetadata[]
  getConnection: (instanceId: string) => AppConnectionMetadata | undefined
  disconnect: (instanceId: string) => void
  onConnect: (listener: (metadata: AppConnectionMetadata) => void) => () => void
  onDisconnect: (listener: (instanceId: string) => void) => () => void
  onHandshakeFailure: (listener: (event: HandshakeFailureEvent) => void) => () => void
}

export interface SailDesktopAgentHostControllers {
  intentResolver: IntentResolverUIMethods
  channels: SailDesktopAgentChannels
  apps: SailDesktopAgentApps
}

export interface SailDesktopAgentOptions extends Pick<
  DesktopAgentOptions,
  | "appLauncher"
  | "userChannels"
  | "apps"
  | "validation"
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
  autoStart?: boolean
  onAppConnected?: (metadata: AppConnectionMetadata) => void
  onAppDisconnected?: (instanceId: string) => void
  onHandshakeFailed?: (error: Error, connectionAttemptUuid: string) => void
  intentResolver?: IntentResolver
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

function resolveUserChannelById(
  desktopAgent: DesktopAgent,
  channelId: string | null,
): BrowserTypes.Channel | null {
  if (channelId === null) {
    return null
  }
  return desktopAgent.getUserChannels().find(channel => channel.id === channelId) ?? null
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

export class SailDesktopAgent extends DesktopAgent implements SailDesktopAgentHostControllers {
  readonly connector: BrowserAppConnection
  readonly intentResolver: IntentResolverUIMethods
  readonly channels: SailDesktopAgentChannels
  readonly apps: SailDesktopAgentApps
  readonly intentResolverUI?: IntentResolverUIMethods

  constructor(options?: SailDesktopAgentOptions) {
    const { intentResolver: providedIntentResolver, autoStart, ...localOptions } = options ?? {}
    const logger = localOptions.logger ?? consoleLogger
    const browserAppConnection = new BrowserAppConnection({
      ...localOptions.appConnectionOptions,
      logger,
      validation: localOptions.validation,
    })
    const wcpIntentResolutionTimeout =
      localOptions.appConnectionOptions?.intentResolutionTimeout ??
      DEFAULT_WCP_INTENT_RESOLUTION_TIMEOUT_MS
    const hostIntentResolver =
      providedIntentResolver ??
      createHostIntentResolver({
        timeoutMs: Math.max(0, wcpIntentResolutionTimeout - HOST_RESOLVER_TIMEOUT_BUFFER_MS),
      })
    const intentResolverUI = hasIntentResolverUI(hostIntentResolver)
      ? hostIntentResolver
      : undefined

    super({
      appLauncher: localOptions.appLauncher,
      apps: localOptions.apps,
      userChannels: localOptions.userChannels,
      validation: localOptions.validation,
      implementationMetadata: localOptions.implementationMetadata,
      openContextListenerTimeoutMs: localOptions.openContextListenerTimeoutMs,
      heartbeatEnabled: localOptions.heartbeatEnabled,
      heartbeatIntervalMs: localOptions.heartbeatIntervalMs,
      heartbeatTimeoutMs: localOptions.heartbeatTimeoutMs,
      logger,
      logPayloadDetail: localOptions.logPayloadDetail,
      requestIntentResolution: request => browserAppConnection.requestIntentResolution(request),
    })

    this.connector = browserAppConnection
    this.intentResolverUI = intentResolverUI
    this.intentResolver = this.createIntentResolverController(intentResolverUI)
    this.channels = this.createChannelsController()
    this.apps = this.createAppsController()

    browserAppConnection.bindAgentState({
      getAgentState: () => this.getState(),
      setAgentState: callback => {
        this.updateState(callback)
      },
    })
    this.attachAppConnection(browserAppConnection)
    wireIntentResolver(browserAppConnection, hostIntentResolver)
    this.wireLifecycleCallbacks(localOptions, logger)

    if (localOptions.appDirectories && localOptions.appDirectories.length > 0) {
      for (const url of localOptions.appDirectories) {
        void this.addAppDirectory(url)
      }
    }

    if (autoStart !== false) {
      this.start()
    }
  }

  private createIntentResolverController(
    intentResolverUI: IntentResolverUIMethods | undefined,
  ): IntentResolverUIMethods {
    return {
      getPendingRequests: () => intentResolverUI?.getPendingRequests() ?? [],
      onRequest: listener => intentResolverUI?.onRequest(listener) ?? (() => {}),
      select: (requestId, choice) => {
        intentResolverUI?.select(requestId, choice)
      },
      cancel: requestId => {
        intentResolverUI?.cancel(requestId)
      },
    }
  }

  private createChannelsController(): SailDesktopAgentChannels {
    return {
      getUserChannels: () => this.getUserChannels(),
      getAppChannelId: instanceId => this.getAppUserChannelId(instanceId),
      getAppChannel: instanceId => {
        const channelId = this.getAppUserChannelId(instanceId)
        return resolveUserChannelById(this, channelId)
      },
      changeAppChannel: (instanceId, channelId) => this.changeAppChannel(instanceId, channelId),
      onAppChannelChange: listener => {
        const handler = (instanceId: string, channelId: string | null) => {
          listener({
            instanceId,
            channelId,
            channel: resolveUserChannelById(this, channelId),
          })
        }
        this.connector.on("channelChanged", handler)
        return () => {
          this.connector.off("channelChanged", handler)
        }
      },
    }
  }

  private createAppsController(): SailDesktopAgentApps {
    return {
      add: app => {
        this.addApp(app)
      },
      addAll: apps => {
        this.addApps(apps)
      },
      addDirectory: url => this.addAppDirectory(url),
      remove: appId => {
        this.removeApp(appId)
      },
      getAll: () => this.getApps(),
      getById: appId => this.getApp(appId),
      open: (app, openOptions) => this.openApp(app, openOptions),
      getInstances: () => this.getAppInstances(),
      getInstance: instanceId => this.getAppInstance(instanceId),
      getConnections: () => this.getAppConnections(),
      getConnection: instanceId => this.getAppConnection(instanceId),
      disconnect: instanceId => {
        this.connector.disconnectAppByInstanceId(instanceId)
      },
      onConnect: listener => {
        this.connector.on("appConnected", listener)
        return () => {
          this.connector.off("appConnected", listener)
        }
      },
      onDisconnect: listener => {
        this.connector.on("appDisconnected", listener)
        return () => {
          this.connector.off("appDisconnected", listener)
        }
      },
      onHandshakeFailure: listener => {
        const handler = (error: Error, connectionAttemptUuid: string) => {
          listener({ error, connectionAttemptUuid })
        }
        this.connector.on("handshakeFailed", handler)
        return () => {
          this.connector.off("handshakeFailed", handler)
        }
      },
    }
  }

  private changeAppChannel(instanceId: string, channelId: string | null): Promise<void> {
    if (channelId !== null && !this.getUserChannels().find(channel => channel.id === channelId)) {
      return Promise.reject(new Error(`Channel "${channelId}" does not exist`))
    }

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup()
        reject(new Error(`Channel change timeout for instance ${instanceId}`))
      }, 10000)

      const handleChannelChanged = (changedInstanceId: string, changedChannelId: string | null) => {
        if (changedInstanceId === instanceId && changedChannelId === channelId) {
          cleanup()
          resolve()
        }
      }

      const cleanup = () => {
        clearTimeout(timeout)
        this.connector.off("channelChanged", handleChannelChanged)
      }

      this.connector.on("channelChanged", handleChannelChanged)

      try {
        this.changeAppUserChannel(instanceId, channelId)
      } catch (error) {
        cleanup()
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
  }

  private wireLifecycleCallbacks(
    options: Omit<SailDesktopAgentOptions, "intentResolver" | "autoStart">,
    logger: Logger,
  ): void {
    this.connector.on("appConnected", metadata => {
      logger.info(`[SailDesktopAgent] App connected: ${metadata.appId} (${metadata.instanceId})`)
      options.onAppConnected?.(metadata)
    })

    this.connector.on("appDisconnected", instanceId => {
      logger.info(`[SailDesktopAgent] App disconnected: ${instanceId}`)
      options.onAppDisconnected?.(instanceId)
    })

    this.connector.on("handshakeFailed", (error, connectionAttemptUuid) => {
      logger.error(`[SailDesktopAgent] WCP handshake failed for ${connectionAttemptUuid}:`, error)
      options.onHandshakeFailed?.(error, connectionAttemptUuid)
    })
  }
}
