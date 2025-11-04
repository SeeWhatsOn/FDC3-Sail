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

// TODO: Implement this
export function handleOpenRequest(message: unknown, context: DACPHandlerContext): void {
  // this will need to be done in sail server to open the app. it will either need to send to the browser for web apps or to electron for desktop apps or to some other protocol for native apps
  //  OPEN_REQUEST: "openRequest",
  //  OPEN_RESPONSE: "openResponse",
  const { transport, instanceId } = context

  try {
    const request = validateDACPMessage(message, OpenrequestSchema)

    const response = createDACPSuccessResponse(request, "openResponse", IMPLEMENTATION_METADATA)

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
 * Handles findInstancesRequest to return all app instances.
 * @param message
 * @param context
 */
export function handleFindInstancesRequest(message: unknown, context: DACPHandlerContext): void {
  const { transport, instanceId, appInstanceRegistry } = context

  try {
    const request = validateDACPMessage(message, FindinstancesrequestSchema)

    const appInstances = appInstanceRegistry.getInstance(request.payload.app) || []

    const response = createDACPSuccessResponse(request, "findInstancesResponse", {
      instances: appInstances,
    })

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
 * Handles getAppMetadataRequest to return app metadata.
 * @param message
 * @param context
 */
export function handleGetAppMetadataRequest(message: unknown, context: DACPHandlerContext): void {
  const { transport, instanceId } = context

  try {
    const request = validateDACPMessage(message, GetappmetadatarequestSchema)
    // TODO: Implement this
    // const appMetadata = appDirectory.getAppMetadata(request.payload.app)

    const response = createDACPSuccessResponse(
      request,
      "getAppMetadataResponse",
      IMPLEMENTATION_METADATA
    )

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
