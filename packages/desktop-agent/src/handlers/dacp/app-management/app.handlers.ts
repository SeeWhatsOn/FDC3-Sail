import {
    validateDACPMessage,
    createDACPSuccessResponse,
    createDACPErrorResponse,
    DACP_ERROR_TYPES
} from "../../validation/dacp-validator";
import { GetinforequestSchema } from "../../validation/dacp-schemas";
import { DACPHandlerContext, logger } from "../../types";

/**
 * Implementation metadata constants
 */
const IMPLEMENTATION_METADATA = {
  fdc3Version: '2.2',
  provider: 'FDC3-Sail',
  providerVersion: '0.0.1',
  optionalFeatures: {
    OriginatingAppMetadata: true,
    UserChannelMembershipAPIs: true,
  }
}

/**
 * Handles getInfoRequest to return implementation metadata.
 */
export async function handleGetInfoRequest(
  message: unknown,
  context: DACPHandlerContext
): Promise<void> {
  const { socket } = context;

  try {
    const request = validateDACPMessage(message, GetinforequestSchema);

    const response = createDACPSuccessResponse(
      request,
      'getInfoResponse',
      IMPLEMENTATION_METADATA
    );

    socket.emit('fdc3_message', response);

  } catch (error) {
    logger.error('DACP: getInfoRequest failed', error);
    const errorResponse = createDACPErrorResponse(
      message as any,
      DACP_ERROR_TYPES.API_TIMEOUT, // Or a more appropriate error
      'getInfoResponse',
      error instanceof Error ? error.message : 'Failed to get implementation info'
    );
    socket.emit('fdc3_message', errorResponse);
  }
}
