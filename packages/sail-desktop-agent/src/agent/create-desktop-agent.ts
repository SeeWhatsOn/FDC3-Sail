import { State } from "../AppRegistration"
import type { AppRegistration, ReceivableMessage } from "../AppRegistration"
import { BrowserAppConnection } from "../app-connection/browser-app-connection"
import type { DesktopAgentHostConfig } from "../host-contracts/types"
import { AppState } from "../PendingApp"
import type { ChannelState } from "../DacpRuntime"
import { BrowserDacpRuntime } from "./browser-dacp-runtime"
import { defaultUserChannels } from "./default-user-channels"
import { loadDirectoryFromSources } from "./load-directories"
import type { DirectoryApp } from "../app-directory/DirectoryInterface"

/** Host-facing Desktop Agent handle. Does not expose runtime/connection internals. */
export type DesktopAgent = {
  getApps: () => DirectoryApp[]
  start: (listenTarget?: EventTarget) => void
  stop: () => void
  reloadDirectories: (
    sources?: DesktopAgentHostConfig["directories"],
  ) => Promise<DirectoryApp[]>
  /**
   * Pre-register a host-launched instance before the app completes WCP
   * (so identity can adopt the host-assigned instance id).
   */
  registerPendingLaunch: (
    appId: string,
    instanceId: string,
    extras?: { instanceTitle?: string; channel?: string | null },
  ) => void
  /** Add a user channel if one with the same id is not already present. */
  ensureUserChannel: (channel: ChannelState) => void
  /** Bind an app instance to a user channel by id (no-op channel if unknown). */
  setUserChannel: (instanceId: string, channelId: string) => void
  /** Snapshot of known app instances and their connection state. */
  getAppRegistrations: () => Promise<AppRegistration[]>
}

type AgentInternals = {
  connection: BrowserAppConnection
  runtime: BrowserDacpRuntime
}

const agentInternals = new WeakMap<DesktopAgent, AgentInternals>()

/**
 * Package-internal access for unit tests. Not exported from the package root.
 */
export function getDesktopAgentInternals(agent: DesktopAgent): AgentInternals {
  const internals = agentInternals.get(agent)
  if (!internals) {
    throw new Error("getDesktopAgentInternals: unknown agent instance")
  }
  return internals
}

/**
 * Create a browser-resident Desktop Agent: App Directory + WCP connection + DACP handlers.
 */
export async function createDesktopAgent(
  config: DesktopAgentHostConfig = {},
): Promise<DesktopAgent> {
  let directorySources = config.directories
  let { directory, apps } = await loadDirectoryFromSources(directorySources)

  const openApp =
    config.openApp ??
    (async () => {
      throw new Error(
        "createDesktopAgent: openApp host callback is required to launch apps",
      )
    })

  // Connection and runtime reference each other during construction.
  const runtimeRef: { current?: BrowserDacpRuntime } = {}

  const connection = new BrowserAppConnection({
    getApps: () => apps,
    provider: config.provider ?? "sail-desktop-agent",
    providerVersion: config.providerVersion,
    fdc3Version: config.fdc3Version ?? "2.2",
    resolveHostIdentifier: config.resolveHostIdentifier,
    adoptInstanceId: ({ appId, hostIdentifier }) => {
      if (!hostIdentifier || !runtimeRef.current) {
        return undefined
      }
      const details = runtimeRef.current.getInstanceDetails(hostIdentifier)
      if (
        details &&
        details.appId === appId &&
        details.state === State.Pending
      ) {
        return hostIdentifier
      }
      return undefined
    },
  })

  const runtime = new BrowserDacpRuntime({
    directory,
    channels: config.channels ?? defaultUserChannels(),
    sendToApp: (instanceId, message) => {
      connection.sendToAppInstance(instanceId, message)
    },
    openApp,
    narrowIntents: config.narrowIntents,
    provider: config.provider,
    providerVersion: config.providerVersion,
    fdc3Version: config.fdc3Version,
    onInstanceConnected: config.onInstanceConnected,
  })
  runtimeRef.current = runtime

  connection.onAppMessage((message, instanceId) => {
    void runtime.receive(message as ReceivableMessage, instanceId)
  })

  connection.on("appConnected", (metadata) => {
    const existing = runtime.getInstanceDetails(metadata.instanceId)
    if (!existing) {
      runtime.setInstanceDetails(metadata.instanceId, {
        appId: metadata.appId,
        instanceId: metadata.instanceId,
        state: State.Pending,
      })
    }
    void runtime.setAppState(metadata.instanceId, State.Connected)

    // WCP4 is handled in BrowserAppConnection (not OpenHandler). Complete any
    // fdc3.open PendingApp that was waiting for this instance to connect.
    const pendingOpen = runtime.getPendingApp(metadata.instanceId)
    if (pendingOpen?.state === AppState.Opening) {
      pendingOpen.setOpened({
        appId: metadata.appId,
        instanceId: metadata.instanceId,
      })
    }

    config.onAppStateChanged?.()
  })

  connection.on("appDisconnected", (instanceId) => {
    void runtime.setAppState(instanceId, State.Terminated)
    config.onAppStateChanged?.()
  })

  const agent: DesktopAgent = {
    getApps: () => apps,
    start: (listenTarget) => {
      connection.start(listenTarget)
    },
    stop: () => {
      connection.stop()
      void runtime.shutdown()
    },
    reloadDirectories: async (sources) => {
      directorySources = sources ?? directorySources
      const loaded = await loadDirectoryFromSources(directorySources)
      directory = loaded.directory
      apps = loaded.apps
      runtime.replaceDirectory(directory)
      return apps
    },
    registerPendingLaunch: (appId, instanceId, extras) => {
      runtime.registerPendingLaunch(appId, instanceId, extras)
    },
    ensureUserChannel: (channel) => {
      if (!runtime.getChannelById(channel.id)) {
        runtime.addChannelState(channel)
      }
    },
    setUserChannel: (instanceId, channelId) => {
      const channel = runtime.getChannelById(channelId)
      runtime.setCurrentChannel(instanceId, channel)
    },
    getAppRegistrations: () => runtime.getAllApps(),
  }

  agentInternals.set(agent, { connection, runtime })
  return agent
}
