import { StrictMode, type Dispatch, type SetStateAction } from "react"
import { createRoot } from "react-dom/client"
import {
  createBrowserDesktopAgent,
  DEFAULT_FDC3_USER_CHANNELS,
  type BrowserDesktopAgent,
  type DirectoryApp,
} from "@finos/sail-desktop-agent"
import type { AppIdentifier } from "@finos/fdc3"
import type { AppInstance } from "@finos/sail-desktop-agent"

import conformanceAppDirectory from "../../../conformance-appd.json"

import App from "./App"
import { createHarnessAppLauncher } from "./app-launcher"
import { createHarnessIntentResolver } from "./intent-resolver-wiring"
import { createPopupCloseWatcher, openHarnessPopup } from "./popup-launcher"
import type { HarnessPanel } from "./types"

const HARNESS_DEBUG = true

function extractConformance1Url(apps: DirectoryApp[]): string {
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

/**
 * Bootstrap FDC3 desktop agent before React renders so WCP1Hello is handled
 * as soon as the Conformance1 iframe loads.
 */
function bootstrapHarness(): {
  initialPanels: HarnessPanel[]
  onPanelsChange: (setter: Dispatch<SetStateAction<HarnessPanel[]>>) => void
} {
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
  // eslint-disable-next-line prefer-const
  let desktopAgent: BrowserDesktopAgent | undefined

  const removePanel = (instanceId: string) => {
    setPanels?.(current => current.filter(panel => panel.instanceId !== instanceId))
  }

  const popupWatcher = createPopupCloseWatcher({
    onPopupClosed: instanceId => {
      removePanel(instanceId)
      desktopAgent?.disconnectInstance(instanceId)
    },
  })

  const mountLaunchedPanel = (panel: HarnessPanel) => {
    if (panel.launchMode === "popup") {
      const popup = openHarnessPopup(panel)
      if (!popup) {
        console.error(
          `[ConformanceHarness] Failed to open tab for ${panel.appId} (${panel.instanceId}) — popup blocked?`
        )
        return
      }
      popupWatcher.registerPopup(panel.instanceId, popup)
    }

    setPanels?.(current => [...current, panel])
  }

  const appLauncher = createHarnessAppLauncher(mountLaunchedPanel)

  desktopAgent = createBrowserDesktopAgent({
    apps: conformanceApps,
    appLauncher,
    intentResolver: createHarnessIntentResolver(HARNESS_DEBUG),
    userChannels: DEFAULT_FDC3_USER_CHANNELS,
    wcpOptions: {
      getIntentResolverUrl: () => false,
      getChannelSelectorUrl: () => false,
    },
    logPayloadDetail: HARNESS_DEBUG ? "full" : "metadata",
    onAppConnected: (metadata: {
      appId: AppIdentifier["appId"]
      instanceId: AppInstance["instanceId"]
    }) => {
      console.log(`[ConformanceHarness] WCP connected: ${metadata.appId} (${metadata.instanceId})`)
    },
    onAppDisconnected: (instanceId: AppInstance["instanceId"]) => {
      popupWatcher.unregisterPopup(instanceId)
      removePanel(instanceId)
      console.log(`[ConformanceHarness] WCP disconnected: ${instanceId}`)
    },
  })

  if (HARNESS_DEBUG) {
    console.log("[ConformanceHarness] Desktop agent started (debug logging enabled)")
  }

  return {
    initialPanels,
    onPanelsChange: setter => {
      setPanels = setter
    },
  }
}

const { initialPanels, onPanelsChange } = bootstrapHarness()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App initialPanels={initialPanels} onPanelsChange={onPanelsChange} />
  </StrictMode>
)
