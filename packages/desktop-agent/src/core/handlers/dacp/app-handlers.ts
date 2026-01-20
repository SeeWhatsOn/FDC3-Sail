import {
  validateDACPMessage,
  createDACPSuccessResponse,
  createDACPErrorResponse,
  DACP_ERROR_TYPES,
} from "../validation/dacp-validator"
import {
  FindInstancesRequestSchema,
  GetAppMetadataRequestSchema,
  GetInfoRequestSchema,
  OpenRequestSchema,
} from "../validation/dacp-schemas"
import { type DACPHandlerContext, logger } from "../types"
import type { Context } from "@finos/fdc3"
import type { DirectoryApp } from "../../app-directory/types"

/**
 * Implementation metadata constants.
 * TODO: Get this from the env or move to a config file.
 */
const IMPLEMENTATION_METADATA = {
  fdc3Version: "2.2",
  provider: "FDC3-Sail",
  providerVersion: "0.0.1",
  optionalFeatures: {
    OriginatingAppMetadata: true,
    UserChannelMembershipAPIs: true,
  },
}

/**
 * Handles getInfoRequest to return implementation metadata.
 */
export function handleGetInfoRequest(message: unknown, context: DACPHandlerContext): void {
  const { transport, instanceId } = context

  try {
    const request = validateDACPMessage(message, GetInfoRequestSchema)

    const response = createDACPSuccessResponse(request, "getInfoResponse", IMPLEMENTATION_METADATA)

    // Add routing metadata
    const responseWithRouting = {
      ...response,
      meta: {
        ...response.meta,
        destination: { instanceId },
      },
    }

    transport.send(responseWithRouting)
  } catch (error) {
    logger.error("DACP: getInfoRequest failed", error)
    const errorResponse = createDACPErrorResponse(
      message as { meta: { requestUuid: string } },
      DACP_ERROR_TYPES.API_TIMEOUT, // Or a more appropriate error
      "getInfoResponse",
      error instanceof Error ? error.message : "Failed to get implementation info"
    )
    // Add routing metadata
    const errorResponseWithRouting = {
      ...errorResponse,
      meta: {
        ...errorResponse.meta,
        destination: { instanceId },
      },
    }

    transport.send(errorResponseWithRouting)
  }
}

/**
 * Handles openRequest to launch an app
 */
export async function handleOpenRequest(
  message: unknown,
  context: DACPHandlerContext
): Promise<void> {
  const { transport, instanceId, appDirectory, appLauncher } = context

  try {
    const request = validateDACPMessage(message, OpenRequestSchema)
    const payload = request.payload as {
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
    const response = createDACPSuccessResponse(request, "openResponse", {
      appIdentifier: launchResult.appIdentifier,
    })
    // Add routing metadata
    const responseWithRouting = {
      ...response,
      meta: {
        ...response.meta,
        destination: { instanceId },
      },
    }

    transport.send(responseWithRouting)
  } catch (error) {
    logger.error("DACP: openRequest failed", error)
    const errorResponse = createDACPErrorResponse(
      message as { meta: { requestUuid: string } },
      DACP_ERROR_TYPES.APP_LAUNCH_FAILED,
      "openResponse",
      error instanceof Error ? error.message : "Failed to open app"
    )
    // Add routing metadata
    const errorResponseWithRouting = {
      ...errorResponse,
      meta: {
        ...errorResponse.meta,
        destination: { instanceId },
      },
    }

    transport.send(errorResponseWithRouting)
  }
}

/**
 * Handles findInstancesRequest to return all app instances for a given appId
 */
export function handleFindInstancesRequest(message: unknown, context: DACPHandlerContext): void {
  const { transport, instanceId, appInstanceRegistry } = context

  try {
    const request = validateDACPMessage(message, FindInstancesRequestSchema)
    const appIdentifier = request.payload.app

    logger.info("DACP: Finding instances for app", { appId: appIdentifier.appId })

    // Query for all instances of this app
    const instances = appInstanceRegistry.queryInstances({ appId: appIdentifier.appId })

    // Convert to FDC3 AppIdentifier format
    const appIdentifiers = instances.map(instance => ({
      appId: instance.appId,
      instanceId: instance.instanceId,
    }))

    const response = createDACPSuccessResponse(request, "findInstancesResponse", {
      appIdentifiers,
    })

    // Add routing metadata
    const responseWithRouting = {
      ...response,
      meta: {
        ...response.meta,
        destination: { instanceId },
      },
    }

    transport.send(responseWithRouting)
  } catch (error) {
    logger.error("DACP: findInstancesRequest failed", error)
    const errorResponse = createDACPErrorResponse(
      message as { meta: { requestUuid: string } },
      DACP_ERROR_TYPES.APP_NOT_FOUND,
      "findInstancesResponse",
      error instanceof Error ? error.message : "Failed to find app instances"
    )
    // Add routing metadata
    const errorResponseWithRouting = {
      ...errorResponse,
      meta: {
        ...errorResponse.meta,
        destination: { instanceId },
      },
    }

    transport.send(errorResponseWithRouting)
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
export function handleGetAppMetadataRequest(message: unknown, context: DACPHandlerContext): void {
  const { transport, instanceId, appInstanceRegistry, appDirectory } = context

  try {
    const request = validateDACPMessage(message, GetAppMetadataRequestSchema)

    // Parse request payload
    const payload = request.payload as { app: { appId: string; instanceId?: string } }
    const appId = payload.app.appId
    const specificInstanceId = payload.app.instanceId

    // Step 1: Try to get metadata from a running instance
    let runningInstance
    if (specificInstanceId) {
      runningInstance = appInstanceRegistry.getInstance(specificInstanceId)
    } else {
      const instances = appInstanceRegistry.queryInstances({ appId })
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

        const response = createDACPSuccessResponse(request, "getAppMetadataResponse", {
          appMetadata,
        })

        const responseWithRouting = {
          ...response,
          meta: {
            ...response.meta,
            destination: { instanceId },
          },
        }

        transport.send(responseWithRouting)
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

      const response = createDACPSuccessResponse(request, "getAppMetadataResponse", {
        appMetadata,
      })

      const responseWithRouting = {
        ...response,
        meta: {
          ...response.meta,
          destination: { instanceId },
        },
      }

      transport.send(responseWithRouting)
      return
    }

    // Step 3: No running instance - fallback to App Directory
    const directoryApps = appDirectory.retrieveAppsById(appId)
    if (directoryApps.length > 0) {
      const appMetadata = convertDirectoryAppToAppMetadata(directoryApps[0])

      const response = createDACPSuccessResponse(request, "getAppMetadataResponse", {
        appMetadata,
      })

      const responseWithRouting = {
        ...response,
        meta: {
          ...response.meta,
          destination: { instanceId },
        },
      }

      transport.send(responseWithRouting)
      return
    }

    // Step 4: App not found anywhere - return error
    throw new Error(`No metadata found for app: ${appId}`)
  } catch (error) {
    logger.error("DACP: getAppMetadataRequest failed", error)
    const errorResponse = createDACPErrorResponse(
      message as { meta: { requestUuid: string } },
      DACP_ERROR_TYPES.TARGET_APP_UNAVAILABLE,
      "getAppMetadataResponse",
      error instanceof Error ? error.message : "Failed to get app metadata"
    )

    const errorResponseWithRouting = {
      ...errorResponse,
      meta: {
        ...errorResponse.meta,
        destination: { instanceId },
      },
    }

    transport.send(errorResponseWithRouting)
  }
}
