import type { DirectoryApp } from "../app-directory/DirectoryInterface"
import type { ChannelState } from "../DacpRuntime"
import type { AppIdentifier, AppIntent } from "@finos/fdc3-standard"
import type { Context } from "@finos/fdc3-context"

/** Fetch apps from an FDC3 App Directory REST endpoint (e.g. …/v2/apps). */
export type AppDirectoryRestSource = {
  type: "rest"
  url: string
}

/**
 * Local App Directory document already loaded by the host UI
 * (bundled JSON, localStorage, etc.). Array form or `{ applications }` wrapper.
 */
export type AppDirectoryLocalSource = {
  type: "local"
  data: DirectoryApp[] | { applications: DirectoryApp[] }
}

export type AppDirectorySource =
  | AppDirectoryRestSource
  | AppDirectoryLocalSource

/**
 * Host opens an application (iframe/tab) and returns the instance id that will
 * be used as the browsing-context name for WCP host-instance adoption.
 */
export type DesktopAgentOpenAppHandler = (
  app: DirectoryApp,
  channel: string | null,
) => Promise<{ instanceId: string; instanceTitle?: string }>

export type DesktopAgentIntentResolveHandler = (
  raiser: AppIdentifier,
  appIntents: AppIntent[],
  context: Context,
) => Promise<AppIntent[]>

/** Configuration a host UI passes when creating/embedding the Desktop Agent. */
export type DesktopAgentHostConfig = {
  /** Zero or more directories; first-wins merge by appId. */
  directories?: AppDirectorySource[]
  /** User channels; defaults to fdc3.channel.1–8 when omitted. */
  channels?: ChannelState[]
  /** Required for fdc3.open / raiseIntent that launches apps. */
  openApp?: DesktopAgentOpenAppHandler
  /** Optional intent resolver UI; default keeps all candidate intents. */
  narrowIntents?: DesktopAgentIntentResolveHandler
  /** Called when an app finishes WCP and becomes Connected. */
  onInstanceConnected?: (instanceId: string) => void
  /** Called when app connection state should refresh in the host chrome. */
  onAppStateChanged?: () => void
  /**
   * Fallback when `window.name` is empty/unreadable cross-origin.
   * Should return the host-assigned launcher instance id for the source window.
   */
  resolveHostIdentifier?: (source: Window) => string | undefined
  provider?: string
  providerVersion?: string
  fdc3Version?: string
}
