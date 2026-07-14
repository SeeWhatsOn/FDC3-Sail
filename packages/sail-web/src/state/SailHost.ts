import {
  ChannelType,
  createDesktopAgent,
  type DirectoryApp,
  type DesktopAgent,
  type ChannelState,
  type AppDirectorySource,
  type AppRegistration,
  State,
} from "@finos/sail-desktop-agent"
import { AppIdentifier, AppIntent, ResolveError } from "@finos/fdc3-standard"
import type { Context } from "@finos/fdc3-context"
import { SailClientStateArgs, TabDetail } from "./ClientState"
import { AppHosting } from "./DefaultAppState"
import { getAppState, getClientState } from "./index"

type SailIntentResolveResponse = {
  appIntents: AppIntent[]
  requestId: string
  channel: string | null
  error: string | null
}

export interface ServerState {
  registerDesktopAgent(props: SailClientStateArgs): Promise<void>
  registerAppLaunch(
    appId: string,
    hosting: AppHosting,
    channel: string | null,
    instanceTitle: string,
  ): Promise<string>
  getKnownApps(): DirectoryApp[]
  getApplications(): Promise<DirectoryApp[]>
  getAppInstanceState(instanceId: string): State | undefined
  addStateChangeCallback(cb: () => void): void
  setUserChannel(instanceId: string, channel: string): Promise<void>
  intentChosen(
    requestId: string,
    ai: AppIdentifier | null,
    intent: string | null,
    channel: string | null,
  ): void
  sendClientState(cs: SailClientStateArgs): Promise<void>
}

function tabsToChannels(tabs: TabDetail[]): ChannelState[] {
  return tabs.map((c) => ({
    id: c.id,
    type: ChannelType.user,
    displayMetadata: {
      name: c.id,
      glyph: c.icon,
      color: c.background,
    },
    context: [],
  }))
}

function toDirectorySources(args: SailClientStateArgs): AppDirectorySource[] {
  const sources: AppDirectorySource[] = []
  for (const url of args.directories) {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      sources.push({ type: "rest", url })
    }
  }
  if (args.customApps?.length) {
    sources.push({ type: "local", data: args.customApps })
  }
  return sources
}

function directorySyncKey(cs: SailClientStateArgs): string {
  return JSON.stringify({
    directories: cs.directories,
    customApps: cs.customApps,
  })
}

function channelSyncKey(cs: SailClientStateArgs): string {
  return JSON.stringify(cs.channels.map((c) => c.id))
}

export class SailHost implements ServerState {
  private agent: DesktopAgent | null = null
  private resolveCallback: ((x: SailIntentResolveResponse) => void) | null =
    null
  private pendingIntentRequestId: string | null = null
  private appRegistrations: AppRegistration[] = []
  private callbacks: (() => void)[] = []
  private lastDirectoryKey: string | null = null
  private lastChannelKey: string | null = null

  addStateChangeCallback(cb: () => void): void {
    this.callbacks.push(cb)
  }

  private notify(): void {
    this.callbacks.forEach((cb) => cb())
  }

  async registerDesktopAgent(props: SailClientStateArgs): Promise<void> {
    this.agent = await createDesktopAgent({
      directories: toDirectorySources(props),
      channels: tabsToChannels(props.channels),
      provider: "fdc3-sail",
      openApp: async (app, channel) => {
        const hosting = channel ? AppHosting.Frame : AppHosting.Tab
        if (channel) {
          await getClientState().setActiveTabId(channel)
        }
        const openDetails = await getAppState().open(app, hosting)
        return {
          instanceId: openDetails.instanceId,
          instanceTitle: openDetails.instanceTitle,
        }
      },
      resolveHostIdentifier: (source) => this.resolveHostIdentifier(source),
      narrowIntents: (raiser, appIntents, context) =>
        this.narrowIntents(raiser, appIntents, context),
      onInstanceConnected: (instanceId) => {
        const panel = getClientState()
          .getPanels()
          .find((p) => p.panelId === instanceId)
        if (panel) {
          void this.setUserChannel(instanceId, panel.tabId)
        }
      },
      onAppStateChanged: () => {
        void this.refreshAppRegistrations()
      },
    })

    this.agent.start()
    this.lastDirectoryKey = directorySyncKey(props)
    this.lastChannelKey = channelSyncKey(props)
    void this.refreshAppRegistrations()
    this.notify()
  }

  getKnownApps(): DirectoryApp[] {
    if (!this.agent) {
      return []
    }
    return this.agent.getApps()
  }

  async getApplications(): Promise<DirectoryApp[]> {
    if (!this.agent) {
      throw new Error("Desktop Agent not registered")
    }
    return this.agent.getApps()
  }

  getAppInstanceState(instanceId: string): State | undefined {
    return this.appRegistrations.find((x) => x.instanceId === instanceId)?.state
  }

  async registerAppLaunch(
    appId: string,
    _hosting: AppHosting,
    channel: string | null,
    instanceTitle: string,
  ): Promise<string> {
    if (!this.agent) {
      throw new Error("Desktop Agent not registered")
    }
    const instanceId = "sail-app-" + crypto.randomUUID()
    this.agent.registerPendingLaunch(appId, instanceId, {
      instanceTitle,
      channel,
    })
    void this.refreshAppRegistrations()
    return instanceId
  }

  async sendClientState(cs: SailClientStateArgs): Promise<void> {
    if (!this.agent) {
      return
    }

    const nextDirectoryKey = directorySyncKey(cs)
    if (nextDirectoryKey !== this.lastDirectoryKey) {
      await this.agent.reloadDirectories(toDirectorySources(cs))
      this.lastDirectoryKey = nextDirectoryKey
      this.notify()
    }

    const nextChannelKey = channelSyncKey(cs)
    if (nextChannelKey !== this.lastChannelKey) {
      for (const channel of tabsToChannels(cs.channels)) {
        this.agent.ensureUserChannel(channel)
      }
      this.lastChannelKey = nextChannelKey
    }
  }

  async setUserChannel(instanceId: string, channelId: string): Promise<void> {
    if (!this.agent) {
      return
    }
    this.agent.setUserChannel(instanceId, channelId)
  }

  intentChosen(
    requestId: string,
    ai: AppIdentifier | null,
    intent: string | null,
    channel: string | null,
  ): void {
    if (!this.resolveCallback || this.pendingIntentRequestId !== requestId) {
      return
    }
    if (ai && intent) {
      this.resolveCallback({
        appIntents: [
          {
            intent: { name: intent },
            apps: [ai],
          },
        ],
        channel,
        requestId,
        error: null,
      })
    } else {
      this.resolveCallback({
        appIntents: [],
        channel: null,
        requestId,
        error: ResolveError.UserCancelled,
      })
    }
    this.resolveCallback = null
    this.pendingIntentRequestId = null
  }

  /**
   * Map a connecting Window to the host launcher instance id.
   * Needed when cross-origin `window.name` is empty/unreadable.
   */
  private resolveHostIdentifier(source: Window): string | undefined {
    const fromMap = getAppState().getInstanceIdForWindow(source)
    if (fromMap) {
      return fromMap
    }

    for (const panel of getClientState().getPanels()) {
      const iframe = document.getElementById(
        "iframe_" + panel.panelId,
      ) as HTMLIFrameElement | null
      if (iframe?.contentWindow === source) {
        return panel.panelId
      }
    }

    return undefined
  }

  private async narrowIntents(
    _raiser: AppIdentifier,
    appIntents: AppIntent[],
    context: Context,
  ): Promise<AppIntent[]> {
    if (appIntents.length === 0) {
      return appIntents
    }
    const uniqueAppIds = new Set(
      appIntents.flatMap((i) => i.apps.map((a) => a.appId)),
    )
    if (appIntents.length === 1 && uniqueAppIds.size === 1) {
      return appIntents
    }

    const requestId = crypto.randomUUID()
    return new Promise<AppIntent[]>((resolve) => {
      this.pendingIntentRequestId = requestId
      this.resolveCallback = (response) => {
        if (response.error) {
          resolve([])
        } else {
          resolve(response.appIntents)
        }
      }
      void getClientState().setIntentResolution({
        appIntents: appIntents.map((ai) => ({
          intent: ai.intent,
          apps: ai.apps.map((a) => ({
            ...a,
            channelData: null,
          })),
        })),
        context,
        requestId,
      })
    })
  }

  private async refreshAppRegistrations(): Promise<void> {
    if (!this.agent) {
      return
    }
    this.appRegistrations = await this.agent.getAppRegistrations()
    this.notify()
  }
}
