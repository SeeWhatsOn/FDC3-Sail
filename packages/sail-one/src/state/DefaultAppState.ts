import { DirectoryApp, WebAppDetails } from "@finos/sail-desktop-agent"
import { getClientState, getServerState } from "./index"

export enum AppHosting {
  Frame,
  Tab,
}

export interface AppOpenDetails {
  instanceId: string
  channel: string | null
  instanceTitle: string
}

export interface AppState {
  registerAppWindow(window: Window, instanceId: string): void
  getInstanceIdForWindow(window: Window): string | undefined
  open(detail: DirectoryApp, destination?: AppHosting): Promise<AppOpenDetails>
}

export function normalizeIdentityUrl(identityUrl: string): string {
  return identityUrl.replace(/\/+$/, "")
}

export class DefaultAppState implements AppState {
  windowInformation = new Map<Window, string>()

  getDirectoryAppForUrl(identityUrl: string): DirectoryApp | undefined {
    const strippedIdentityUrl = normalizeIdentityUrl(identityUrl)
    const applications: DirectoryApp[] = getServerState().getKnownApps()
    return applications.find((x) => {
      const d = x.details as WebAppDetails
      return (
        d.url == strippedIdentityUrl ||
        d.url == identityUrl ||
        (d.url.startsWith("/") && identityUrl.endsWith(d.url))
      )
    })
  }

  registerAppWindow(window: Window, instanceId: string): void {
    this.windowInformation.set(window, instanceId)
  }

  getInstanceIdForWindow(window: Window): string | undefined {
    return this.windowInformation.get(window)
  }

  createTitle(detail: DirectoryApp): string {
    const existingPanels = getClientState().getPanels()
    const usedNumbers = new Set(
      existingPanels
        .filter((p) => p.title.startsWith(detail.title))
        .map((p) => {
          const match = /\d+$/.exec(p.title)
          return match ? parseInt(match[0]) : 0
        }),
    )

    let number = 1
    while (usedNumbers.has(number)) {
      number++
    }

    return `${detail.title} ${number.toString()}`
  }

  open(
    detail: DirectoryApp,
    destination?: AppHosting,
  ): Promise<AppOpenDetails> {
    const sailManifest = detail.hostManifests?.sail ?? {}
    const forceNewWindow =
      (typeof sailManifest === "string" ? {} : sailManifest).forceNewWindow ??
      false
    const hosting: AppHosting =
      (forceNewWindow ? AppHosting.Tab : undefined) ??
      destination ??
      AppHosting.Frame
    const instanceTitle = this.createTitle(detail)

    if (hosting == AppHosting.Tab) {
      return getServerState()
        .registerAppLaunch(detail.appId, hosting, null, instanceTitle)
        .then((instanceId) => {
          const w = window.open(
            (detail.details as WebAppDetails).url,
            instanceId,
          )
          if (!w) {
            throw new Error("Failed to open window")
          }
          this.registerAppWindow(w, instanceId)
          return { instanceId, channel: null, instanceTitle }
        })
    }

    const channel = getClientState().getActiveTab().id
    return getServerState()
      .registerAppLaunch(detail.appId, hosting, channel, instanceTitle)
      .then((instanceId) => {
        getClientState().newPanel(detail, instanceId, instanceTitle)
        return { instanceId, channel, instanceTitle }
      })
  }
}
