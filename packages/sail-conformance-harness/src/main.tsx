import { StrictMode, type Dispatch, type SetStateAction } from "react"
import { createRoot } from "react-dom/client"
import {
  createBrowserDesktopAgent,
  DEFAULT_FDC3_USER_CHANNELS,
  type DirectoryApp,
} from "@finos/sail-desktop-agent"
import type { AppIdentifier } from "@finos/fdc3"
import type { AppInstance } from "@finos/sail-desktop-agent"

import conformanceAppDirectory from "../../../conformance-appd.json"

import App from "./App"
import { createHarnessAppLauncher } from "./app-launcher"
import { createHarnessIntentResolver } from "./intent-resolver-wiring"
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
    },
  ]

  let appendPanel: Dispatch<SetStateAction<HarnessPanel[]>> | null = null

  const appLauncher = createHarnessAppLauncher(panel => {
    appendPanel?.(current => [...current, panel])
  })

  void createBrowserDesktopAgent({
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
      console.log(`[ConformanceHarness] WCP disconnected: ${instanceId}`)
    },
  })

  if (HARNESS_DEBUG) {
    console.log("[ConformanceHarness] Desktop agent started (debug logging enabled)")
  }

  return {
    initialPanels,
    onPanelsChange: setter => {
      appendPanel = setter
    },
  }
}

const { initialPanels, onPanelsChange } = bootstrapHarness()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App initialPanels={initialPanels} onPanelsChange={onPanelsChange} />
  </StrictMode>
)
