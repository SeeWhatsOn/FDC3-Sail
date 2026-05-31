import type { AppLauncher, DirectoryApp } from "@finos/sail-desktop-agent"
import type { AppIdentifier, AppMetadata, BrowserTypes } from "@finos/fdc3"
import type { HarnessPanel } from "./types"

type AppMetadataWithDetails = AppMetadata & Partial<Pick<DirectoryApp, "details">>

export type HarnessLaunchCallback = (panel: HarnessPanel) => void

/**
 * Extract the web launch URL from FDC3 directory app metadata.
 */
function extractAppUrl(appMetadata: AppMetadataWithDetails): string | undefined {
  const details = appMetadata.details
  if (details && "url" in details && typeof details.url === "string") {
    return details.url
  }
  return undefined
}

/**
 * Minimal AppLauncher for the conformance harness.
 *
 * Each launch generates a fresh {@link crypto.randomUUID} instance id unless
 * the open request targets an existing instance. The returned id must match the
 * iframe `name` attribute so WCP4 identity validation can correlate the
 * connection with the host panel.
 */
export function createHarnessAppLauncher(onLaunch: HarnessLaunchCallback): AppLauncher {
  return {
    async launch(
      request: BrowserTypes.OpenRequestPayload,
      appMetadata: AppMetadata
    ): Promise<AppIdentifier> {
      // Reuse caller-supplied instance id when opening an existing instance.
      const instanceId = request.app.instanceId ?? crypto.randomUUID()
      const metadata = appMetadata as AppMetadataWithDetails
      const url = extractAppUrl(metadata)

      if (!url) {
        throw new Error(`Cannot launch app ${request.app.appId}: no URL found in app metadata`)
      }

      onLaunch({
        instanceId,
        appId: request.app.appId,
        url,
        title: metadata.title ?? metadata.name ?? request.app.appId,
      })

      return {
        appId: request.app.appId,
        instanceId,
      }
    },
  }
}
