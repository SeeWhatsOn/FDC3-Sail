// Simplified FDC3 Server - merges SailFDC3Server and SailServerContext
import { Socket } from "socket.io"
import { randomUUID } from "crypto"
import {
  ChannelState,
  ChannelType,
  DirectoryApp,
  State,
} from "@finos/fdc3-web-impl"
import { AppIdentifier, AppIntent, Context, OpenError } from "@finos/fdc3"
import {
  FDC3_DA_EVENT,
  SAIL_APP_OPEN,
  SAIL_CHANNEL_SETUP,
  SAIL_INTENT_RESOLVE,
  SAIL_BROADCAST_CONTEXT,
  SailAppOpenArgs,
  SailAppOpenResponse,
  AppHosting,
  TabDetail,
  ContextHistory,
  AugmentedAppIntent,
  AugmentedAppMetadata,
  SailIntentResolveResponse,
  DesktopAgentHelloArgs,
} from "@finos/fdc3-sail-common"
import { getIcon, SailDirectory } from "./model/fdc3/SailDirectory"
import { FDC3Server, AppInstance } from "./sessions"

export class SimpleFDC3Server extends DefaultFDC3Server implements FDC3Server {
  private readonly socket: Socket
  private readonly directory: SailDirectory
  private instances = new Map<string, AppInstance>()
  private channels: ChannelState[] = []
  private appStartDestinations = new Map<string, string | null>()

  constructor(socket: Socket, helloArgs: DesktopAgentHelloArgs) {
    this.socket = socket
    this.directory = new SailDirectory()

    // Initialize channels from hello args
    if (helloArgs.channels) {
      this.channels = helloArgs.channels.map((ch: TabDetail) => ({
        id: ch.id,
        type: ChannelType.user,
        displayMetadata: {
          name: ch.id,
          glyph: ch.icon,
          color: ch.background,
        },
        context: [],
      }))
    }

    // Load app directories
    if (helloArgs.directories && helloArgs.directories.length > 0) {
      // Note: This is async but we can't await in constructor
      // Initialize with empty directories and load them later if needed
      this.directory
        .replaceAppsFromAppDirectories(helloArgs.directories)
        .catch(console.error)
    }
  }

  // FDC3Server interface implementation
  async shutdown(): Promise<void> {
    // Clean up all app instances
    this.instances.clear()
    this.channels = []
    this.appStartDestinations.clear()
  }

  getAppDirectory() {
    return this.directory
  }

  // Expose serverContext interface for compatibility
  get serverContext() {
    return {
      getDesktopAgentSocket: () => this.socket,
      getInstanceDetails: (instanceId: string) =>
        this.instances.get(instanceId),
      setInstanceDetails: (instanceId: string, details: AppInstance) => {
        this.instances.set(instanceId, details as AppInstance)
      },
      getActiveAppInstances: async () => Array.from(this.instances.values()),
      getTabs: () => this.getChannelsAsTabDetails(),
      cleanupDisconnectedChannelSockets: () =>
        this.cleanupDisconnectedSockets(),
      reloadAppDirectories: (urls: string[], customApps: DirectoryApp[]) =>
        this.reloadDirectories(urls, customApps),
      updateChannelData: (channels: TabDetail[], history?: ContextHistory) =>
        this.updateChannels(channels, history),
      setAppState: (instanceId: string, state: State) =>
        this.setAppState(instanceId, state),
      post: (message: object, instanceId: string) =>
        this.postMessage(message, instanceId),
      notifyUserChannelsChanged: (
        instanceId: string,
        channelId: string | null,
      ) => this.notifyChannelChange(instanceId, channelId),
      narrowIntents: (
        raiser: AppIdentifier,
        intents: AppIntent[],
        context: Context,
      ) => this.narrowIntents(raiser, intents, context),
      open: (appId: string) => this.openApp(appId),
      openOnChannel: (appId: string, channel: string) =>
        this.openAppOnChannel(appId, channel),
      isAppConnected: (instanceId: string) => this.isConnected(instanceId),
      getConnectedApps: () => this.getConnectedApps(),
      setInitialChannel: (app: AppIdentifier) => this.setInitialChannel(app),
      notifyBroadcastContext: (event: {
        payload: { channelId: string; context: Context }
      }) => this.broadcastContext(event),
    }
  }

  // Core FDC3 operations
  async openApp(appId: string): Promise<string> {
    const destination = this.appStartDestinations.get(appId)
    this.appStartDestinations.delete(appId)
    return this.openAppInternal(appId, destination ?? null)
  }

  async openAppOnChannel(appId: string, channel: string): Promise<void> {
    this.appStartDestinations.set(appId, channel)
  }

  private async openAppInternal(
    appId: string,
    channel: string | null,
  ): Promise<string> {
    const apps = this.directory.retrieveAppsById(appId)
    if (apps.length === 0) {
      throw new Error(OpenError.AppNotFound)
    }

    const app = apps[0]
    const url = (app.details as { url?: string })?.url
    if (!url) {
      throw new Error(OpenError.AppNotFound)
    }

    // Determine hosting approach
    const forceNewWindow = (
      app.hostManifests as { sail?: { forceNewWindow?: boolean } }
    )?.sail?.forceNewWindow
    const approach =
      forceNewWindow || channel === null ? AppHosting.Tab : AppHosting.Frame

    // Request app opening from desktop agent
    const response: SailAppOpenResponse = await this.socket.emitWithAck(
      SAIL_APP_OPEN,
      {
        appDRecord: app,
        approach,
        channel,
      } as SailAppOpenArgs,
    )

    // Create app instance
    const instance: AppInstance = {
      instanceId: response.instanceId,
      appId,
      url,
      state: State.Pending,
      hosting: approach,
      channel: channel ?? null,
      instanceTitle: response.instanceTitle,
      channelSockets: [],
    }

    this.instances.set(response.instanceId, instance)

    if (channel) {
      await this.notifyChannelChange(response.instanceId, channel)
    }

    return response.instanceId
  }

  // App lifecycle management
  async setAppState(instanceId: string, state: State): Promise<void> {
    const instance = this.instances.get(instanceId)
    if (!instance) return

    const needsInitialChannelSetup =
      instance.state === State.Pending && state === State.Connected
    instance.state = state

    if (needsInitialChannelSetup) {
      await this.setInitialChannel({ instanceId, appId: instance.appId })
    }

    if (state === State.Terminated) {
      this.instances.delete(instanceId)
    }
  }

  async isConnected(instanceId: string): Promise<boolean> {
    const instance = this.instances.get(instanceId)
    return instance?.state === State.Connected || false
  }

  async getConnectedApps(): Promise<
    Array<{ appId: string; instanceId: string; state: State }>
  > {
    return Array.from(this.instances.values())
      .filter((instance) => instance.state === State.Connected)
      .map((instance) => ({
        appId: instance.appId,
        instanceId: instance.instanceId,
        state: instance.state,
      }))
  }

  async setInitialChannel(app: AppIdentifier): Promise<void> {
    this.socket.emit(SAIL_CHANNEL_SETUP, app.instanceId)
  }

  // Channel management
  private getChannelsAsTabDetails(): TabDetail[] {
    return this.channels.map((channel) => ({
      id: channel.id,
      icon: channel.displayMetadata?.glyph ?? "",
      background: channel.displayMetadata?.color ?? "",
    }))
  }

  private updateChannels(
    channelData: TabDetail[],
    history?: ContextHistory,
  ): void {
    const existingChannels = new Map(this.channels.map((c) => [c.id, c]))

    this.channels = channelData.map((tabDetail) => {
      const existing = existingChannels.get(tabDetail.id)
      const historicalContext = history?.[tabDetail.id]?.filter(
        (h, i, a) => a.findIndex((h2) => h2.type === h.type) === i,
      )

      return {
        id: tabDetail.id,
        type: ChannelType.user,
        displayMetadata: {
          name: tabDetail.id,
          glyph: tabDetail.icon,
          color: tabDetail.background,
        },
        context: historicalContext ?? existing?.context ?? [],
      }
    })
  }

  private cleanupDisconnectedSockets(): void {
    this.instances.forEach((instance) => {
      if (instance.channelSockets) {
        const originalLength = instance.channelSockets.length
        instance.channelSockets = instance.channelSockets.filter(
          (socket) => socket.connected,
        )
        if (instance.channelSockets.length < originalLength) {
          console.log(
            `Cleaned up ${originalLength - instance.channelSockets.length} disconnected sockets for ${instance.instanceId}`,
          )
        }
      }
    })
  }

  // Message handling
  async postMessage(message: object, instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId)
    if (instance?.socket) {
      if (!(message as { type?: string })?.type?.startsWith("heartbeat")) {
        console.log("Posting message to app:", JSON.stringify(message))
      }
      instance.socket.emit(FDC3_DA_EVENT, message)
    } else {
      console.log(`Can't find app: ${instanceId}`)
    }
  }

  private broadcastContext(broadcastEvent: {
    payload: { channelId: string; context: Context }
  }): void {
    this.socket.emit(SAIL_BROADCAST_CONTEXT, {
      channelId: broadcastEvent.payload.channelId,
      context: broadcastEvent.payload.context,
    })
  }

  async notifyChannelChange(
    instanceId: string,
    channelId: string | null,
  ): Promise<void> {
    console.log("User channels changed", instanceId, channelId)
    const instance = this.instances.get(instanceId)
    if (instance) {
      instance.channel = channelId
      const channelChangeEvent = {
        type: "channelChangedEvent",
        payload: { newChannelId: channelId },
        meta: { eventUuid: randomUUID(), timestamp: new Date() },
      }
      await this.postMessage(channelChangeEvent, instanceId)
    }
  }

  // Directory management
  async reloadDirectories(
    urls: string[],
    customApps: DirectoryApp[],
  ): Promise<void> {
    await this.directory.replaceAppsFromAppDirectories(urls)
    customApps.forEach((app) => this.directory.addApp(app))
  }

  // Intent handling (re-implemented from original complex logic)
  async narrowIntents(
    raiser: AppIdentifier,
    incomingIntents: AppIntent[],
    context: Context,
  ): Promise<AppIntent[]> {
    const augmentedIntents = this.augmentIntents(incomingIntents)

    // Helper to count unique apps for an intent
    const uniqueApps = (appIntent: AppIntent): number =>
      appIntent.apps
        .map((app) => app.appId)
        .filter((value, index, self) => self.indexOf(value) === index).length

    // Auto-resolution logic:
    // If there's only one intent and that intent points to a single unique app.
    if (
      augmentedIntents.length === 1 &&
      uniqueApps(augmentedIntents[0]) === 1
    ) {
      const autoResolvedIntent = this._tryAutoResolveIntent(
        raiser,
        augmentedIntents[0],
      )
      if (autoResolvedIntent) {
        return autoResolvedIntent
      }
    }

    // If auto-resolution isn't possible, delegate to the Desktop Agent's intent resolver UI.
    return this._resolveIntentViaDesktopAgent(augmentedIntents, context)
  }

  private augmentIntents(appIntents: AppIntent[]): AugmentedAppIntent[] {
    return appIntents.map(({ intent, apps }) => ({
      intent,
      apps: apps.map((app) => {
        const dir = this.directory.retrieveAppsById(app.appId)
        const iconSrc = getIcon(dir[0])
        const title = dir.length > 0 ? dir[0]?.title : "Unknown App"

        if (app.instanceId) {
          const instance = this.instances.get(app.instanceId)
          const channel = this.channels.find(
            (channel) => channel.id === instance?.channel,
          )
          return {
            ...app,
            channelData: channel
              ? this.getChannelsAsTabDetails().find((c) => c.id === channel.id)
              : null,
            instanceTitle: instance?.instanceTitle ?? undefined,
            icons: [{ src: iconSrc }],
            title,
          } as AugmentedAppMetadata
        } else {
          return {
            ...app,
            icons: [{ src: iconSrc }],
            title,
          } as AugmentedAppMetadata
        }
      }),
    }))
  }

  private _tryAutoResolveIntent(
    raiser: AppIdentifier,
    augmentedIntent: AugmentedAppIntent,
  ): AppIntent[] | null {
    const raiserInstance = this.instances.get(raiser.instanceId!)
    const channel = raiserInstance?.channel ?? null

    const runningAppsInChannel = augmentedIntent.apps.filter(
      (app) =>
        app.instanceId &&
        this.instances.get(app.instanceId)?.channel === channel,
    ).length

    if (runningAppsInChannel === 0) {
      this.appStartDestinations.set(augmentedIntent.apps[0].appId, channel)
      return [augmentedIntent]
    } else if (runningAppsInChannel === 1) {
      return [augmentedIntent]
    }

    return null // Not auto-resolved
  }

  private _resolveIntentViaDesktopAgent(
    augmentedIntents: AppIntent[],
    context: Context,
  ): Promise<AppIntent[]> {
    return new Promise<AppIntent[]>((resolve) => {
      console.log(
        "Delegating intent resolution to Desktop Agent:",
        augmentedIntents,
        context,
      )

      this.socket.emit(
        SAIL_INTENT_RESOLVE,
        { appIntents: augmentedIntents, context },
        (response: SailIntentResolveResponse, err: string) => {
          if (err) {
            console.error("Error from DA intent resolver:", err)
            resolve([])
            return
          }

          const appNeedsStarting =
            response.appIntents.length === 1 &&
            response.appIntents[0].apps.length === 1 &&
            response.appIntents[0].apps[0].instanceId == null

          if (appNeedsStarting) {
            const theApp = response.appIntents[0].apps[0]
            this.appStartDestinations.set(theApp.appId, response.channel)
          }

          resolve(response.appIntents)
        },
      )
    })
  }
}
