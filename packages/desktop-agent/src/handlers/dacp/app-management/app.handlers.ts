import {
    validateDACPMessage,
    createDACPSuccessResponse,
    createDACPErrorResponse,
    DACP_ERROR_TYPES
} from "../../validation/dacp-validator";
import { GetinforequestSchema } from "../../validation/dacp-schemas";
import { TransportAgnosticDACPHandlerContext, logger } from "../../types";
import { getDesktopAgent } from "../../../desktopAgent";

/**
 * Handles getInfoRequest to return implementation metadata.
 */
export async function handleGetInfoRequest(
  message: unknown,
  context: TransportAgnosticDACPHandlerContext
): Promise<void> {
  const { reply } = context;

  try {
    const request = validateDACPMessage(message, GetinforequestSchema);

    // The singleton DesktopAgent instance holds the metadata
    const desktopAgent = getDesktopAgent();
    const implementationMetadata = desktopAgent.getImplementationMetadata();

    const response = createDACPSuccessResponse(
      request,
      'getInfoResponse',
      implementationMetadata
    );

    reply(response);

  } catch (error) {
    logger.error('DACP: getInfoRequest failed', error);
    const errorResponse = createDACPErrorResponse(
      message as any,
      DACP_ERROR_TYPES.API_TIMEOUT, // Or a more appropriate error
      'getInfoResponse',
      error instanceof Error ? error.message : 'Failed to get implementation info'
    );
    reply(errorResponse);
  }
}