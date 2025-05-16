import { Socket } from "socket.io"
import { randomUUID } from "crypto"
import {
  AppRegistration,
  ChannelState,
  DirectoryApp,
  FDC3Server,
  InstanceID,
  ServerContext,
  State,
} from "@finos/fdc3-web-impl"
import { AppIdentifier } from "@finos/fdc3"
import { getIcon, SailDirectory } from "./SailDirectory"
import { AppIntent, Context, OpenError } from "@finos/fdc3"
import {
  FDC3_DA_EVENT,
  SAIL_APP_OPEN,
  SAIL_CHANNEL_SETUP,
  SAIL_INTENT_RESOLVE,
  SailAppOpenArgs,
  AppHosting,
  SailIntentResolveResponse,
  AugmentedAppIntent,
  AugmentedAppMetadata,
  SailAppOpenResponse,
  TabDetail,
  ContextHistory,
  SAIL_BROADCAST_CONTEXT,
} from "@finos/fdc3-sail-common"
import {
  BroadcastRequest,
  ChannelChangedEvent,
} from "@finos/fdc3-schema/dist/generated/api/BrowserTypes"
import { mapChannels } from "./SailFDC3Server"
import { MinimalFDC3ServerInternal, SailData } from "../../types"

export class SailServerContext implements ServerContext<SailData> {
  readonly directory: SailDirectory
  private instances: Map<InstanceID, SailData> = new Map()
  private fdc3Server: FDC3Server | undefined
  private readonly socket: Socket
  private readonly appStartDestinations: Map<string, string | null> = new Map()

  constructor(directory: SailDirectory, socket: Socket) {
    this.directory = directory
    this.socket = socket
  }

  public getDesktopAgentSocket(): Socket {
    return this.socket
  }

  setFDC3Server(server: FDC3Server): void {
    this.fdc3Server = server
  }

  post(message: object, instanceId: InstanceID): Promise<void> {
    const instance = this.instances.get(instanceId)
    if (instance) {
      if (!(message as { type?: string })?.type?.startsWith("heartbeat")) {
        this.log("Posting message to app: " + JSON.stringify(message))
      }
      instance.socket?.emit(FDC3_DA_EVENT, message)
    } else {
      this.log(`Can't find app: ${JSON.stringify(instanceId)}`)
    }
    return Promise.resolve()
  }

  notifyBroadcastContext(broadcastEvent: BroadcastRequest) {
    const channel = broadcastEvent.payload.channelId
    const context = broadcastEvent.payload.context
    this.socket.emit(SAIL_BROADCAST_CONTEXT, {
      channelId: channel,
      context: context,
    })
  }

  async open(appId: string): Promise<InstanceID> {
    const destination = this.appStartDestinations.get(appId)
    this.appStartDestinations.delete(appId)
    return this.openSail(appId, destination ?? null)
  }

  async openOnChannel(appId: string, channel: string): Promise<void> {
    this.appStartDestinations.set(appId, channel)
  }

  async openSail(appId: string, channel: string | null): Promise<InstanceID> {
    const app: DirectoryApp[] = this.directory.retrieveAppsById(appId)

    if (app.length == 0) {
      throw new Error(OpenError.AppNotFound)
    }

    const url = (app[0].details as { url?: string })?.url ?? undefined
    if (url) {
      // Determine if the app should be forced into a new window/tab,
      // based on its manifest configuration.
      const forceNewWindow = (
        app[0].hostManifests as { sail?: { forceNewWindow?: boolean } }
      )?.sail?.forceNewWindow
      // If forcing a new window or no channel is specified, host in a new Tab. Otherwise, host in an IFrame.
      const approach =
        forceNewWindow || channel === null ? AppHosting.Tab : AppHosting.Frame

      // Notify the client (Desktop Agent) to open the app and wait for acknowledgement.
      // The client will handle the actual instantiation of the app view (tab or iframe).
      const details: SailAppOpenResponse = await this.socket.emitWithAck(
        SAIL_APP_OPEN,
        {
          appDRecord: app[0],
          approach,
          channel,
        } as SailAppOpenArgs,
      )

      this.setInstanceDetails(details.instanceId, {
        appId,
        instanceId: details.instanceId,
        url,
        state: State.Pending,
        hosting: approach,
        channel: channel ?? null,
        instanceTitle: details.instanceTitle,
        channelSockets: [],
      })

      if (channel) {
        this.notifyUserChannelsChanged(details.instanceId, channel)
      }

      return details.instanceId
    }

    throw new Error(OpenError.AppNotFound)
  }

  // set the instance details for the given instance ID of an app
  setInstanceDetails(uuid: InstanceID, details: SailData): void {
    if (uuid != details.instanceId) {
      console.error(
        "UUID mismatch in setInstanceDetails. Instance may not be tracked correctly.",
        uuid,
        details.instanceId,
      )
    }
    this.instances.set(details.instanceId, details)
  }

  getInstanceDetails(uuid: InstanceID): SailData | undefined {
    return this.instances.get(uuid)
  }

  async setInitialChannel(app: AppIdentifier): Promise<void> {
    this.socket.emit(SAIL_CHANNEL_SETUP, app.instanceId)
  }

  async getConnectedApps(): Promise<AppRegistration[]> {
    return Array.from(this.instances.values())
      .filter((instanceData) => instanceData.state == State.Connected)
      .map((instanceData) => ({
        appId: instanceData.appId,
        instanceId: instanceData.instanceId,
        state: instanceData.state,
      }))
  }

  async isAppConnected(app: InstanceID): Promise<boolean> {
    const foundInstance = this.instances.get(app)
    return foundInstance != null && foundInstance.state == State.Connected
  }

  async setAppState(app: InstanceID, state: State): Promise<void> {
    const found = this.instances.get(app)
    if (found) {
      const needsInitialChannelSetup =
        found.state == State.Pending && state == State.Connected
      found.state = state
      if (needsInitialChannelSetup) {
        // If the app has just connected, perform initial channel setup.
        this.setInitialChannel(found)
      }

      if (state == State.Terminated) {
        // If the app instance is terminated, remove it from tracking and clean up server-side resources.
        this.instances.delete(app)
        this.fdc3Server?.cleanup(found.instanceId)
      }
    }
  }

  async getAllApps(): Promise<AppRegistration[]> {
    return Array.from(this.instances.values()).map((instanceData) => {
      return {
        appId: instanceData.appId,
        instanceId: instanceData.instanceId,
        state: instanceData.state,
      }
    })
  }

  createUUID(): string {
    return randomUUID()
  }

  log(message: string): void {
    console.log("SAIL:" + message)
  }

  provider(): string {
    return "FDC3 Sail"
  }

  providerVersion(): string {
    return "2.0"
  }

  fdc3Version(): string {
    return "2.0"
  }

  convertToTabDetail(channel: ChannelState): TabDetail {
    return {
      id: channel.id,
      icon: channel.displayMetadata?.glyph ?? "",
      background: channel.displayMetadata?.color ?? "",
    }
  }

  augmentIntents(appIntents: AppIntent[]): AugmentedAppIntent[] {
    return appIntents.map(({ intent, apps }) => ({
      intent,
      apps: apps.map((app) => {
        const dir = this.directory.retrieveAppsById(app.appId)
        const iconSrc = getIcon(dir[0])
        const title = dir.length > 0 ? dir[0]?.title : "Unknown App"

        // If the app has a running instance, augment with instance-specific details
        // like its current channel and instance title.
        if (app.instanceId) {
          const instance = this.getInstanceDetails(app.instanceId)
          const channel = this.getChannelDetails().find(
            (channel) => channel.id == instance?.channel,
          )
          return {
            ...app,
            channelData: channel ? this.convertToTabDetail(channel) : null,
            instanceTitle: instance?.instanceTitle ?? undefined,
            icons: [{ src: iconSrc }],
            title,
          } as AugmentedAppMetadata
        } else {
          // If no running instance, just provide general app metadata.
          return {
            ...app,
            icons: [{ src: iconSrc }],
            title,
          } as AugmentedAppMetadata
        }
      }),
    }))
  }

  /**
   * Attempts to automatically resolve an intent if specific conditions are met.
   * This is a helper for the narrowIntents method.
   *
   * @param raiser The application instance that raised the intent.
   * @param augmentedIntent The single augmented intent to potentially auto-resolve.
   * @param runningAppsInChannelFn A function to count running apps in a channel for the intent.
   * @param raiserChannelFn A function to get the raiser's current channel.
   * @returns The AppIntent array if auto-resolved, otherwise null.
   */
  private _tryAutoResolveIntent(
    raiser: AppIdentifier,
    augmentedIntent: AugmentedAppIntent,
    runningAppsInChannelFn: (
      appIntent: AugmentedAppIntent,
      channel: string | null,
    ) => number,
    raiserChannelFn: (raiser: AppIdentifier) => string | null,
  ): AppIntent[] | null {
    const channel = raiserChannelFn(raiser)
    const runners = runningAppsInChannelFn(augmentedIntent, channel)

    if (runners === 0) {
      // Case 1: No instances of the target app are running in the raiser's channel.
      // Set the app to be started in the raiser's channel.
      this.appStartDestinations.set(augmentedIntent.apps[0].appId, channel)
      return [augmentedIntent] // Return the single intent for automatic dispatch.
    } else if (runners === 1) {
      // Case 2: Exactly one instance of the target app is running in the raiser's channel.
      // The intent can be directly raised in this existing app instance.
      return [augmentedIntent] // Return the single intent for automatic dispatch.
    }
    return null // Not auto-resolved
  }

  /**
   * Delegates intent resolution to the Desktop Agent UI when auto-resolution is not possible.
   *
   * @param augmentedIntents The list of augmented intents to present to the user.
   * @param context The context object passed with the intent.
   * @returns A promise that resolves with the AppIntent array selected by the user.
   */
  private _resolveIntentViaDesktopAgent(
    augmentedIntents: AppIntent[],
    context: Context,
  ): Promise<AppIntent[]> {
    return new Promise<AppIntent[]>((resolve) => {
      console.log(
        "SAIL Narrowing intents for DA resolver",
        augmentedIntents,
        context,
      )

      this.socket.emit(
        SAIL_INTENT_RESOLVE, // Event to trigger the DA's resolver UI
        {
          appIntents: augmentedIntents,
          context,
        },
        async (response: SailIntentResolveResponse, err: string) => {
          if (err) {
            console.error("Error from DA intent resolver:", err)
            resolve([]) // Resolve with empty if there's an error from the DA resolver
          } else {
            console.log("SAIL Narrowed intents from DA resolver", response)

            // Helper to check if the resolved intent means a new app instance needs to be started.
            function appNeedsStarting(appIntents: AppIntent[]) {
              return (
                appIntents.length == 1 && // Only one intent selected/resolved
                appIntents[0].apps.length == 1 && // That intent points to a single app
                appIntents[0].apps[0].instanceId == null // And that app doesn't have an instanceId (i.e., not yet running)
              )
            }

            if (appNeedsStarting(response.appIntents)) {
              // If the user selected an app that isn't running,
              // set its starting channel based on the resolver's response.
              const theAppIntent = response.appIntents[0]
              const theApp = theAppIntent.apps[0]
              this.appStartDestinations.set(theApp.appId, response.channel)
            }

            resolve(response.appIntents) // Return the intents selected/confirmed by the user.
          }
        },
      )
    })
  }

  /**
   * This method refines a list of intents to present to the user or to auto-resolve
   * based on the current context, raising app, and running instances.
   * It's used when the intent resolver UI is managed by the desktop agent.
   */
  async narrowIntents(
    raiser: AppIdentifier, // The application instance that raised the intent
    incomingIntents: AppIntent[], // The initial list of intents matching the criteria
    context: Context, // The context object passed with the intent
  ): Promise<AppIntent[]> {
    // Helper to count how many apps for a given intent are running in a specific channel
    const runningAppsInChannel = (
      appIntent: AugmentedAppIntent,
      channel: string | null,
    ): number => {
      return appIntent.apps.filter(
        (app) => app.instanceId && app.channelData?.id == channel,
      ).length
    }

    const uniqueApps = (appIntent: AppIntent): number =>
      appIntent.apps
        .map((app) => app.appId)
        .filter((value, index, self) => self.indexOf(value) === index).length

    const isRunningInTab = (arg0: AppIdentifier): boolean => {
      const details = this.getInstanceDetails(arg0.instanceId!)
      return details?.hosting == AppHosting.Tab
    }

    const raiserChannel = (arg0: AppIdentifier): string | null =>
      this.getInstanceDetails(arg0.instanceId!)?.channel ?? null

    const augmentedIntents = this.augmentIntents(incomingIntents)

    // in this case, the tab needs the intent resolver
    if (isRunningInTab(raiser)) return augmentedIntents

    if (augmentedIntents.length == 0) return augmentedIntents

    // Auto-resolution logic:
    // If there's only one intent and that intent points to a single unique app.
    if (augmentedIntents.length == 1 && uniqueApps(augmentedIntents[0]) == 1) {
      const autoResolvedIntent = this._tryAutoResolveIntent(
        raiser,
        augmentedIntents[0],
        runningAppsInChannel,
        raiserChannel,
      )
      if (autoResolvedIntent) {
        return autoResolvedIntent
      }
      // If runners > 1, or other complex scenarios, proceed to manual resolution via Desktop Agent UI.
    }

    // If auto-resolution isn't possible, delegate to the Desktop Agent's intent resolver UI.
    return this._resolveIntentViaDesktopAgent(augmentedIntents, context)
  }

  async notifyUserChannelsChanged(
    instanceId: string,
    channelId: string | null,
  ): Promise<void> {
    console.log("SAIL User channels changed", instanceId, channelId)
    const instance = this.getInstanceDetails(instanceId!)
    if (instance) {
      instance.channel = channelId
      // Create a standard FDC3 event to notify the specific app instance about the channel change.
      const channelChangeEvent: ChannelChangedEvent = {
        type: "channelChangedEvent",
        payload: {
          newChannelId: channelId,
        },
        meta: {
          eventUuid: randomUUID(),
          timestamp: new Date(),
        },
      }
      this.post(channelChangeEvent, instanceId)
    }
  }

  async reloadAppDirectories(urls: string[], customApps: DirectoryApp[]) {
    await this.directory.replaceAppsFromAppDirectories(urls)
    customApps.forEach((app) => this.directory.addApp(app))
  }

  private getChannelDetails(): ChannelState[] {
    const internalServer = this.fdc3Server as
      | MinimalFDC3ServerInternal
      | undefined
    if (
      internalServer &&
      internalServer.handlers &&
      internalServer.handlers.length > 0
    ) {
      // Assumes the first handler in the FDC3Server is the primary one managing channel state.
      // This might need refinement if multiple channel handlers exist or if the structure changes.
      return internalServer.handlers[0].state
    }
    return []
  }

  getTabs(): TabDetail[] {
    return this.getChannelDetails().map((channelState) =>
      this.convertToTabDetail(channelState),
    )
  }

  updateChannelData(channelData: TabDetail[], history?: ContextHistory): void {
    function relevantHistory(
      id: string,
      history?: ContextHistory,
    ): undefined | Context[] {
      if (history) {
        const basicHistory = history[id]
        // just the first item of each unique type
        const relevantHistory = basicHistory.filter(
          (h, i, a) => a.findIndex((h2) => h2.type == h.type) == i,
        )
        return relevantHistory
      }
      return undefined
    }

    const internalServer = this.fdc3Server as
      | MinimalFDC3ServerInternal
      | undefined

    if (
      !internalServer ||
      !internalServer.handlers ||
      internalServer.handlers.length === 0
    ) {
      console.warn(
        "SAIL: FDC3Server or its handlers are not initialized for updateChannelData.",
      )
      return
    }

    // Assumes the first handler is the one responsible for managing channel states.
    const channelHandler = internalServer.handlers[0]
    // Preserve the current channel states before clearing, to allow retaining context if no new history is provided.
    const previousChannelStates: ChannelState[] = [...channelHandler.state]

    channelHandler.state.length = 0 // Clear existing state to replace it entirely.
    const newState = mapChannels(channelData).map((c) => {
      // Determine the context for the channel:
      // 1. Use relevant context from the provided history, if any.
      // 2. Else, use the context from the channel's previous state (before clearing), if any.
      // 3. Else, default to an empty context array.
      const historicalContext = relevantHistory(c.id, history)
      const previousChannel = previousChannelStates.find(
        (pcs) => pcs.id === c.id,
      )
      const preservedContext = previousChannel?.context
      const finalContext = historicalContext ?? preservedContext ?? []

      return {
        ...c,
        context: finalContext,
      }
    })
    channelHandler.state.push(...newState) // Apply the new state.
    console.log("SAIL Updated channel data", channelHandler.state)
  }
}
