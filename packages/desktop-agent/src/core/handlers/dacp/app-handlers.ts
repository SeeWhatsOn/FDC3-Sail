import { createDACPSuccessResponse } from "../../dacp-protocol/dacp-message-creators"
import { DACP_ERROR_TYPES } from "../../dacp-protocol/dacp-constants"
import { type DACPHandlerContext, type DACPMessage } from "../types"
import { sendDACPResponse, sendDACPErrorResponse } from "./utils/dacp-response-utils"
import type { Context } from "@finos/fdc3"
import type { DirectoryApp } from "../../app-directory/types"
import { getInstance, getInstancesByAppId } from "../../state/selectors"

/**
 * Handles getInfoRequest to return implementation metadata.
 */
export function handleGetInfoRequest(message: DACPMessage, context: DACPHandlerContext): void {
  const { transport, instanceId, implementationMetadata, logger } = context

  try {

    const response = createDACPSuccessResponse(message, "getInfoResponse", implementationMetadata)

    sendDACPResponse({ response, instanceId, transport })
  } catch (error) {
    logger.error("DACP: getInfoRequest failed", error)
    sendDACPErrorResponse({
      message,
      errorType: DACP_ERROR_TYPES.API_TIMEOUT,
      errorMessage: error instanceof Error ? error.message : "Failed to get implementation info",
      instanceId,
      transport,
    })
  }
}

/**
 * Handles openRequest to launch an app
 */
export async function handleOpenRequest(
  message: DACPMessage,
  context: DACPHandlerContext
): Promise<void> {
  const { transport, instanceId, appDirectory, appLauncher, logger } = context

  try {
    const payload = message.payload as {
      app: { appId: string; instanceId?: string }
      context?: Context
    }

    // Check if app launcher is available
    if (!appLauncher) {
      throw new Error("App launching not available - no AppLauncher configured")
    }

    const appId = payload.app.appId
    const targetInstanceId = payload.app.instanceId
    const launchContext = payload.context

    // Get app metadata from directory
    const apps = appDirectory.retrieveAppsById(appId)
    if (apps.length === 0) {
      throw new Error(`App not found in directory: ${appId}`)
    }
    const appMetadata = apps[0]

    logger.info("DACP: Launching app", {
      appId,
      targetInstanceId,
      hasContext: !!launchContext,
    })

    // Launch the app via injected launcher
    const launchResult = await appLauncher.launch(
      {
        app: payload.app,
        context: launchContext,
      },
      appMetadata
    )

    logger.info("DACP: App launched successfully", {
      appId: launchResult.appIdentifier.appId,
      instanceId: launchResult.appIdentifier.instanceId,
      method: launchResult.launchMetadata?.method,
    })

    // Return app identifier to caller
    const response = createDACPSuccessResponse(message, "openResponse", {
      appIdentifier: launchResult.appIdentifier,
    })

    sendDACPResponse({ response, instanceId, transport })
  } catch (error) {
    logger.error("DACP: openRequest failed", error)
    sendDACPErrorResponse({
      message,
      errorType: DACP_ERROR_TYPES.APP_LAUNCH_FAILED,
      errorMessage: error instanceof Error ? error.message : "Failed to open app",
      instanceId,
      transport,
    })
  }
}

/**
 * Handles findInstancesRequest to return all app instances for a given appId
 */
export function handleFindInstancesRequest(message: DACPMessage, context: DACPHandlerContext): void {
  const { transport, instanceId, getState, logger } = context

  try {
    const appIdentifier = (message.payload as { app: { appId: string; instanceId?: string } }).app

    logger.info("DACP: Finding instances for app", { appId: appIdentifier.appId })

    // Query for all instances of this app
    const instances = getInstancesByAppId(getState(), appIdentifier.appId)

    // Convert to FDC3 AppIdentifier format
    const appIdentifiers = instances.map(instance => ({
      appId: instance.appId,
      instanceId: instance.instanceId,
    }))

    const response = createDACPSuccessResponse(message, "findInstancesResponse", {
      appIdentifiers,
    })

    sendDACPResponse({ response, instanceId, transport })
  } catch (error) {
    logger.error("DACP: findInstancesRequest failed", error)
    sendDACPErrorResponse({
      message,
      errorType: DACP_ERROR_TYPES.APP_NOT_FOUND,
      errorMessage: error instanceof Error ? error.message : "Failed to find app instances",
      instanceId,
      transport,
    })
  }
}

/**
 * Helper function to convert DirectoryApp to AppMetadata format
 * Maps FDC3 App Directory fields to FDC3 AppMetadata response format
 *
 * @param app - The DirectoryApp from app directory
 * @param instanceId - Optional instance ID if app is running
 * @returns AppMetadata object ready for DACP response
 */
function convertDirectoryAppToAppMetadata(app: DirectoryApp, instanceId?: string) {
  return {
    appId: app.appId,
    name: app.name,
    version: app.version,
    title: app.title,
    tooltip: app.tooltip,
    description: app.description,
    icons: app.icons || [],
    screenshots: app.screenshots || [],
    instanceId,
    desktopAgent: instanceId ? "FDC3-Sail" : undefined,
  }
}

/**
 * Handles getAppMetadataRequest to return app metadata
 * Returns metadata from running instances or from the App Directory
 */
export function handleGetAppMetadataRequest(message: DACPMessage, context: DACPHandlerContext): void {
  const { transport, instanceId, getState, appDirectory, logger } = context

  try {

    // Parse request payload
    const payload = message.payload as { app: { appId: string; instanceId?: string } }
    const appId = payload.app.appId
    const specificInstanceId = payload.app.instanceId

    // Step 1: Try to get metadata from a running instance
    let runningInstance
    if (specificInstanceId) {
      runningInstance = getInstance(getState(), specificInstanceId)
    } else {
      const instances = getInstancesByAppId(getState(), appId)
      runningInstance = instances[0]
    }

    // Step 2: If running instance found, return metadata with instanceId
    if (runningInstance) {
      // Query directory for full metadata
      const directoryApps = appDirectory.retrieveAppsById(appId)
      const directoryApp = directoryApps[0]

      if (directoryApp) {
        // Combine directory metadata with instance information
        const appMetadata = convertDirectoryAppToAppMetadata(
          directoryApp,
          runningInstance.instanceId
        )

        const response = createDACPSuccessResponse(message, "getAppMetadataResponse", {
          appMetadata,
        })

        sendDACPResponse({ response, instanceId, transport })
        return
      }

      // Fallback: running instance but no directory entry (shouldn't happen normally)
      logger.warn("DACP: Running instance found but no directory entry", { appId })
      const appMetadata = {
        appId: runningInstance.appId,
        name: runningInstance.appId,
        instanceId: runningInstance.instanceId,
        desktopAgent: "FDC3-Sail",
      }

      const response = createDACPSuccessResponse(message, "getAppMetadataResponse", {
        appMetadata,
      })

      sendDACPResponse({ response, instanceId, transport })
      return
    }

    // Step 3: No running instance - fallback to App Directory
    const directoryApps = appDirectory.retrieveAppsById(appId)
    if (directoryApps.length > 0) {
      const appMetadata = convertDirectoryAppToAppMetadata(directoryApps[0])

        const response = createDACPSuccessResponse(message, "getAppMetadataResponse", {
          appMetadata,
        })

        sendDACPResponse({ response, instanceId, transport })
        return
    }

    // Step 4: App not found anywhere - return error
    throw new Error(`No metadata found for app: ${appId}`)
  } catch (error) {
    logger.error("DACP: getAppMetadataRequest failed", error)
    sendDACPErrorResponse({
      message,
      errorType: DACP_ERROR_TYPES.TARGET_APP_UNAVAILABLE,
      errorMessage: error instanceof Error ? error.message : "Failed to get app metadata",
      instanceId,
      transport,
    })
  }
}
