import {
  validateDACPMessage,
  createDACPSuccessResponse,
  createDACPErrorResponse,
  DACP_ERROR_TYPES,
} from "../../validation/dacp-validator"
import {
  FindinstancesrequestSchema,
  GetappmetadatarequestSchema,
  GetinforequestSchema,
  OpenrequestSchema,
} from "../../validation/dacp-schemas"
import { type DACPHandlerContext, logger } from "../../types"

/**
 * Implementation metadata constants
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
    const request = validateDACPMessage(message, GetinforequestSchema)

    const response = createDACPSuccessResponse(request, "getInfoResponse", IMPLEMENTATION_METADATA)

    transport.send(instanceId, response)
  } catch (error) {
    logger.error("DACP: getInfoRequest failed", error)
    const errorResponse = createDACPErrorResponse(
      message as { meta: { requestUuid: string } },
      DACP_ERROR_TYPES.API_TIMEOUT, // Or a more appropriate error
      "getInfoResponse",
      error instanceof Error ? error.message : "Failed to get implementation info"
    )
    transport.send(instanceId, errorResponse)
  }
}

/**
 * Handles openRequest to launch an app
 * TODO: This needs integration with sail-server to actually launch apps
 */
export function handleOpenRequest(message: unknown, context: DACPHandlerContext): void {
  const { transport, instanceId } = context

  try {
    const request = validateDACPMessage(message, OpenrequestSchema)

    // TODO: Implement actual app launching logic
    // For now, this is a placeholder that returns an error
    // The actual implementation will need to:
    // 1. Query app directory for app metadata
    // 2. Determine app type (web/desktop/native)
    // 3. Launch app via appropriate mechanism (browser/electron/protocol)
    // 4. Wait for app to connect and register
    // 5. Return app instance information

    logger.warn("DACP: openRequest not fully implemented - app launching disabled", {
      payload: request.payload,
    })

    throw new Error("App launching not yet implemented")

    // When implemented, response should look like:
    // const response = createDACPSuccessResponse(request, "openResponse", {
    //   appIdentifier: { appId: launchedApp.appId, instanceId: launchedApp.instanceId }
    // })
    // transport.send(instanceId, response)
  } catch (error) {
    logger.error("DACP: openRequest failed", error)
    const errorResponse = createDACPErrorResponse(
      message as { meta: { requestUuid: string } },
      DACP_ERROR_TYPES.APP_LAUNCH_FAILED,
      "openResponse",
      error instanceof Error ? error.message : "Failed to open app"
    )
    transport.send(instanceId, errorResponse)
  }
}

/**
 * Handles findInstancesRequest to return all app instances for a given appId
 */
export function handleFindInstancesRequest(message: unknown, context: DACPHandlerContext): void {
  const { transport, instanceId, appInstanceRegistry } = context

  try {
    const request = validateDACPMessage(message, FindinstancesrequestSchema)
    const appId = request.payload.app

    logger.info("DACP: Finding instances for app", { appId })

    // Query for all instances of this app
    const instances = appInstanceRegistry.queryInstances({ appId })

    // Convert to FDC3 AppIdentifier format
    const appIdentifiers = instances.map(instance => ({
      appId: instance.appId,
      instanceId: instance.instanceId,
    }))

    const response = createDACPSuccessResponse(request, "findInstancesResponse", {
      appIdentifiers,
    })

    transport.send(instanceId, response)
  } catch (error) {
    logger.error("DACP: findInstancesRequest failed", error)
    const errorResponse = createDACPErrorResponse(
      message as { meta: { requestUuid: string } },
      DACP_ERROR_TYPES.APP_NOT_FOUND,
      "findInstancesResponse",
      error instanceof Error ? error.message : "Failed to find app instances"
    )
    transport.send(instanceId, errorResponse)
  }
}

/**
 * Handles getAppMetadataRequest to return app metadata
 * TODO: This needs integration with AppDirectoryManager
 */
export function handleGetAppMetadataRequest(message: unknown, context: DACPHandlerContext): void {
  const { transport, instanceId, appInstanceRegistry } = context

  try {
    const request = validateDACPMessage(message, GetappmetadatarequestSchema)

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

    transport.send(instanceId, response)
  } catch (error) {
    logger.error("DACP: getAppMetadataRequest failed", error)
    const errorResponse = createDACPErrorResponse(
      message as { meta: { requestUuid: string } },
      DACP_ERROR_TYPES.APP_NOT_FOUND,
      "getAppMetadataResponse",
      error instanceof Error ? error.message : "Failed to get app metadata"
    )
    transport.send(instanceId, errorResponse)
  }
}
