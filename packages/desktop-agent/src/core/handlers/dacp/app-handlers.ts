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
 * Handles getAppMetadataRequest to return app metadata
 * TODO: This needs integration with AppDirectoryManager
 */
export function handleGetAppMetadataRequest(message: unknown, context: DACPHandlerContext): void {
  const { transport, instanceId, appInstanceRegistry } = context

  try {
    const request = validateDACPMessage(message, GetAppMetadataRequestSchema)

    // TODO: Integrate with AppDirectoryManager to get full app metadata
    // For now, check if we have a running instance and return basic metadata

    logger.warn("DACP: getAppMetadataRequest not fully implemented", {
      payload: request.payload,
    })

    // Try to get metadata from a running instance
    const payload = request.payload as { app: { appId: string; instanceId?: string } }
    const appId = payload.app.appId
    const specificInstanceId = payload.app.instanceId

    let instance
    if (specificInstanceId) {
      instance = appInstanceRegistry.getInstance(specificInstanceId)
    } else {
      const instances = appInstanceRegistry.queryInstances({ appId })
      instance = instances[0]
    }

    if (!instance) {
      throw new Error(`No metadata found for app: ${appId}`)
    }

    // Return basic metadata from the instance
    const response = createDACPSuccessResponse(request, "getAppMetadataResponse", {
      appMetadata: {
        appId: instance.appId,
        name: instance.appId, // TODO: Get from app directory
        version: "1.0.0", // TODO: Get from app directory
        instanceId: instance.instanceId,
      },
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
    logger.error("DACP: getAppMetadataRequest failed", error)
    const errorResponse = createDACPErrorResponse(
      message as { meta: { requestUuid: string } },
      DACP_ERROR_TYPES.APP_NOT_FOUND,
      "getAppMetadataResponse",
      error instanceof Error ? error.message : "Failed to get app metadata"
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
