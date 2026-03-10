import { createDACPSuccessResponse } from "../../dacp-protocol/dacp-message-creators"
import { type DACPHandlerContext } from "../types"
import { sendDACPResponse, sendDACPErrorResponse } from "./utils/dacp-response-utils"
import type { BrowserTypes } from "@finos/fdc3"
import { OpenError, ResolveError } from "@finos/fdc3"
import { AppNotFoundError, ErrorOnLaunchError } from "../../errors/fdc3-errors"
import type { DirectoryApp } from "../../app-directory/types"
import { getInstance, getInstancesByAppId } from "../../state/selectors"
import { registerOpenWithContext } from "./utils/open-with-context"
import { isValidContext } from "./utils/context-validation"

/**
 * Handles getInfoRequest to return implementation metadata.
 */
export function handleGetInfoRequest(
  message: BrowserTypes.GetInfoRequest,
  context: DACPHandlerContext
): void {
  const { transport, instanceId, implementationMetadata, logger, getState, appDirectory } = context

  try {
    const callerInstance = getInstance(getState(), instanceId)
    // TODO: this should not fall back to default values if implementationMetadata is not provided. Should it error instead?
    const baseMetadata = implementationMetadata ?? {
      fdc3Version: "2.2",
      provider: "FDC3-Sail",
      providerVersion: "0.0.0",
    }
    let appMetadata: BrowserTypes.AppMetadata | undefined

    if (callerInstance) {
      const directoryApps = appDirectory.retrieveAppsById(callerInstance.appId)
      if (directoryApps.length > 0) {
        appMetadata = convertDirectoryAppToAppMetadata(directoryApps[0], instanceId)
      } else {
        appMetadata = {
          appId: callerInstance.appId,
          name: callerInstance.metadata?.name ?? callerInstance.appId,
          instanceId,
          desktopAgent: baseMetadata.provider ?? "FDC3-Sail",
        }
      }
    }

    const resolvedImplementationMetadata = {
      ...baseMetadata,
      ...(appMetadata ? { appMetadata } : {}),
    }

    const response = createDACPSuccessResponse(message, "getInfoResponse", {
      implementationMetadata: resolvedImplementationMetadata,
    })

    sendDACPResponse({ response, instanceId, transport })
  } catch (error) {
    logger.error("DACP: getInfoRequest failed", error)
    sendDACPErrorResponse({
      message,
      errorType: OpenError.ApiTimeout,
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
  message: BrowserTypes.OpenRequest,
  context: DACPHandlerContext
): Promise<void> {
  const { transport, instanceId, appDirectory, appLauncher, logger } = context

  try {
    const payload = message.payload

    // Check if app launcher is available
    if (!appLauncher) {
      throw new Error("App launching not available - no AppLauncher configured")
    }

    const appId = payload.app.appId
    const targetInstanceId = payload.app.instanceId
    const launchContext = payload.context

    if (launchContext !== undefined && !isValidContext(launchContext)) {
      sendDACPErrorResponse({
        message,
        errorType: OpenError.MalformedContext,
        errorMessage: "Invalid context: context must be an object with a string type property",
        instanceId,
        transport,
      })
      return
    }

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
    const appIdentifier = await appLauncher.launch(
      {
        app: payload.app,
        context: launchContext,
      },
      appMetadata
    )

    logger.info("DACP: App launched successfully", {
      appId: appIdentifier.appId,
      instanceId: appIdentifier.instanceId,
    })

    if (!appIdentifier.instanceId) {
      throw new Error("App launcher did not return an instanceId")
    }

    if (launchContext) {
      registerOpenWithContext(message, appIdentifier, launchContext, context)
      return
    }

    const response = createDACPSuccessResponse(message, "openResponse", {
      appIdentifier,
    })

    sendDACPResponse({ response, instanceId, transport })
  } catch (error) {
    logger.error("DACP: openRequest failed", error)

    // Extract FDC3 error type from error instance
    let errorType: OpenError = OpenError.ErrorOnLaunch
    const errorMessage = error instanceof Error ? error.message : "Failed to open app"

    if (error instanceof AppNotFoundError) {
      errorType = error.errorType
    } else if (error instanceof ErrorOnLaunchError) {
      errorType = error.errorType
    } else if (errorMessage.includes("not found") || errorMessage.includes("App not found")) {
      errorType = OpenError.AppNotFound
    } else if (errorMessage.includes("Invalid context") || errorMessage.includes("Malformed")) {
      errorType = OpenError.MalformedContext
    }

    sendDACPErrorResponse({
      message,
      errorType,
      errorMessage,
      instanceId,
      transport,
    })
  }
}

/**
 * Handles findInstancesRequest to return all app instances for a given appId
 */
export function handleFindInstancesRequest(
  message: BrowserTypes.FindInstancesRequest,
  context: DACPHandlerContext
): void {
  const { transport, instanceId, getState, logger } = context

  try {
    const { app: appIdentifier } = message.payload

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
      errorType: OpenError.AppNotFound,
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
export function handleGetAppMetadataRequest(
  message: BrowserTypes.GetAppMetadataRequest,
  context: DACPHandlerContext
): void {
  const { transport, instanceId, getState, appDirectory, logger } = context

  try {
    // Parse request payload
    const payload = message.payload
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
      errorType: ResolveError.TargetAppUnavailable,
      errorMessage: error instanceof Error ? error.message : "Failed to get app metadata",
      instanceId,
      transport,
    })
  }
}
