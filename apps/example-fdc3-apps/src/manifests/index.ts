// Export app directory manifests for programmatic access

// Example apps manifests (hosted by Sail)
import benzingaManifest from "../apps/benzinga/manifest.json"
import polygonManifest from "../apps/polygon/manifest.json"
import tradingViewManifest from "../apps/tradingview/manifest.json"
import trainingBroadcastManifest from "../apps/training-broadcast/manifest.json"
import trainingReceiveManifest from "../apps/training-receive/manifest.json"
import trainingPricerManifest from "../apps/training-pricer/manifest.json"
import trainingTradelistManifest from "../apps/training-tradelist/manifest.json"
import wcpTestManifest from "../apps/wcp-test/manifest.json"
import oldFdc3Manifest from "../apps/old/manifest.json"
import chartsManifest from "../apps/charts/manifest.json"
import newsManifest from "../apps/news/manifest.json"
import portfolioManifest from "../apps/portfolio/manifest.json"

// External apps (reference implementations not hosted by Sail)
import workbenchManifest from "../apps/external/workbench.json"
import conformanceManifest from "../apps/external/conformance.json"

// Re-export individual manifests
export {
  benzingaManifest,
  polygonManifest,
  tradingViewManifest,
  trainingBroadcastManifest,
  trainingReceiveManifest,
  trainingPricerManifest,
  trainingTradelistManifest,
  wcpTestManifest,
  oldFdc3Manifest,
  chartsManifest,
  newsManifest,
  portfolioManifest,
  workbenchManifest,
  conformanceManifest,
}

// Combine all training apps into a single manifest for convenience
export const trainingManifest = {
  applications: [
    ...trainingBroadcastManifest.applications,
    ...trainingReceiveManifest.applications,
    ...trainingPricerManifest.applications,
    ...trainingTradelistManifest.applications,
  ],
  message: "OK",
}

// Legacy name for compatibility
export const sailManifest = oldFdc3Manifest

// Convenience export of all example app manifests
export const exampleManifests: any[] = [
  benzingaManifest,
  polygonManifest,
  tradingViewManifest,
  trainingBroadcastManifest,
  trainingReceiveManifest,
  trainingPricerManifest,
  trainingTradelistManifest,
  wcpTestManifest,
  oldFdc3Manifest,
  chartsManifest,
  newsManifest,
  portfolioManifest,
]

// External apps convenience export
export const externalManifests: any[] = [workbenchManifest, conformanceManifest]

// All manifests (example + external)
export const allManifests: any[] = [...exampleManifests, ...externalManifests]

// Flatten all applications from all manifests
export const allApplications: any[] = exampleManifests.flatMap(
  (manifest: any) => manifest.applications
)

// Default app directory: portfolio, news, charts, and wcp-test
export const defaultAppDirectory: any[] = [
  portfolioManifest,
  newsManifest,
  chartsManifest,
  wcpTestManifest,
]

// Flatten applications from default app directory
export const defaultApplications: any[] = defaultAppDirectory.flatMap(
  (manifest: any) => manifest.applications
)
