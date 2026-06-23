import type { Dispatch, SetStateAction } from "react"
import type { AppConnectionMetadata } from "@finos/sail-desktop-agent/browser"
import {
  DEFAULT_FDC3_USER_CHANNELS,
  SailDesktopAgent,
  type DirectoryApp,
} from "@finos/sail-desktop-agent"

import conformanceAppDirectory from "../conformance-appd.json"

import { createHarnessAppLauncher } from "./app-launcher"
import {
  createHarnessInstanceCleanup,
  type HarnessInstanceCleanup,
} from "./harness-instance-lifecycle"
import { createHarnessIntentResolver } from "./intent-resolver-wiring"
import { createPopupCloseWatcher, openHarnessPopup } from "./popup-launcher"
import type { HarnessPanel } from "./types"

export const HARNESS_DEBUG = true

export function extractConformance1Url(apps: DirectoryApp[]): string {
  const conformance1 = apps.find(app => app.appId === "Conformance1")
  const url =
    conformance1?.type === "web" &&
    conformance1.details &&
    "url" in conformance1.details &&
    typeof conformance1.details.url === "string"
      ? conformance1.details.url
      : undefined

  if (!url) {
    throw new Error("Conformance1 app with web details.url not found in conformance-appd.json")
  }

  return url
}

export type HarnessBootstrap = {
  desktopAgent: SailDesktopAgent
  initialPanels: HarnessPanel[]
  onPanelsChange: (setter: Dispatch<SetStateAction<HarnessPanel[]>>) => void
  popupWatcher: ReturnType<typeof createPopupCloseWatcher>
}

/**
 * Bootstrap FDC3 desktop agent before React renders so WCP1Hello is handled
 * as soon as the Conformance1 iframe loads.
 */
export function createHarnessBootstrap(options?: { debug?: boolean }): HarnessBootstrap {
  const debug = options?.debug ?? HARNESS_DEBUG
  const conformanceApps = conformanceAppDirectory.applications as DirectoryApp[]
  const conformance1InstanceId = crypto.randomUUID()
  const conformance1Url = extractConformance1Url(conformanceApps)

  const initialPanels: HarnessPanel[] = [
    {
      instanceId: conformance1InstanceId,
      appId: "Conformance1",
      url: conformance1Url,
      title: "FDC3 Conformance Framework",
      launchMode: "iframe",
    },
  ]

  let setPanels: Dispatch<SetStateAction<HarnessPanel[]>> | null = null

  const removePanel = (instanceId: string) => {
    setPanels?.(current => current.filter(panel => panel.instanceId !== instanceId))
  }

  const instanceCleanup: HarnessInstanceCleanup = {
    prepareLaunchedHostInstance() {},
    closeHarnessBrowsingContext() {
      return false
    },
    disconnectHarnessInstance() {},
  }

  const popupWatcher = createPopupCloseWatcher({
    onPopupClosed: instanceId => {
      instanceCleanup.disconnectHarnessInstance(instanceId)
    },
  })

  const mountLaunchedPanel = (panel: HarnessPanel) => {
    instanceCleanup.prepareLaunchedHostInstance(panel)

    if (panel.launchMode === "popup") {
      const popup = openHarnessPopup(panel)
      if (!popup) {
        console.error(
          `[ConformanceHarness] Failed to open tab for ${panel.appId} (${panel.instanceId}) — popup blocked?`,
        )
        return
      }
      popupWatcher.registerPopup(panel.instanceId, popup)
    }

    setPanels?.(current => [...current, panel])
  }

  const appLauncher = createHarnessAppLauncher(mountLaunchedPanel, {
    closePopup: instanceId => instanceCleanup.closeHarnessBrowsingContext(instanceId),
    removePanel,
  })

  const desktopAgent = new SailDesktopAgent({
    apps: conformanceApps,
    appLauncher,
    intentResolver: createHarnessIntentResolver(debug),
    userChannels: DEFAULT_FDC3_USER_CHANNELS,
    appConnectionOptions: {
      // Sail host UI is wired externally (no injected resolver/selector iframes).
      getIntentResolverUrl: () => false,
      getChannelSelectorUrl: () => false,
      fdc3Version: "2.2",
    },
    logPayloadDetail: debug ? "full" : "metadata",
    onAppConnected: (metadata: AppConnectionMetadata) => {
      if (metadata.source) {
        popupWatcher.remapPopupByWindow(metadata.source, metadata.instanceId)
      }
      console.log(`[ConformanceHarness] WCP connected: ${metadata.appId} (${metadata.instanceId})`)
    },
    onAppDisconnected: instanceId => {
      console.log(`[ConformanceHarness] WCP disconnected: ${instanceId}`)
      instanceCleanup.disconnectHarnessInstance(instanceId)
    },
  })

  Object.assign(
    instanceCleanup,
    createHarnessInstanceCleanup({
      desktopAgent,
      popupWatcher,
      removePanel,
    }),
  )

  desktopAgent.registerPendingHostInstance({
    appId: "Conformance1",
    instanceId: conformance1InstanceId,
  })

  if (debug) {
    console.log("[ConformanceHarness] Desktop agent started (debug logging enabled)")
  }

  return {
    desktopAgent,
    initialPanels,
    onPanelsChange: setter => {
      setPanels = setter
    },
    popupWatcher,
  }
}

export function getConformance1PanelState(
  bootstrap: HarnessBootstrap,
): { instanceId: string; state: "pending" | "connected" } | undefined {
  const panel = bootstrap.initialPanels.find(entry => entry.appId === "Conformance1")
  if (!panel) {
    return undefined
  }

  const instance = bootstrap.desktopAgent.apps.getInstance(panel.instanceId)
  if (!instance) {
    return undefined
  }

  return { instanceId: panel.instanceId, state: instance.status }
}
