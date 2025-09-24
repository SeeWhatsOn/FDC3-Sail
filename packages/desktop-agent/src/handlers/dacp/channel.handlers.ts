import {
  validateDACPMessage,
  createDACPErrorResponse,
  createDACPSuccessResponse,
  createDACPEvent,
  DACP_ERROR_TYPES
} from '../validation/dacp-validator'
import {
  GetcurrentchannelrequestSchema,
  JoinuserchannelrequestSchema
} from '../validation/dacp-schemas'
import { DACPHandlerContext, logger } from '../types'
// TODO: Import from @finos/fdc3 standard Channel type instead
// For now, using minimal interfaces
interface ChannelState {
  id: string;
  type: number; // ChannelType enum value
  context: any[];
}

// Type for user channel membership tracking
interface ChannelMembership {
  instanceId: string
  appId: string
  channelId: string | null
  messagePort: MessagePort
}

// Global channel membership registry (in production, this should be per-user session)
const channelMemberships = new Map<string, ChannelMembership>()

/**
 * Handles get current channel requests
 * Implements DACP getCurrentChannelRequest message handling
 */
export async function handleGetCurrentChannelRequest(
  message: unknown,
  context: DACPHandlerContext
): Promise<void> {
  const { messagePort } = context

  try {
    const request = validateDACPMessage(message, GetcurrentchannelrequestSchema)

    logger.info('DACP: Processing get current channel request', {
      requestUuid: request.meta.requestUuid
    })

    const currentChannel = await getCurrentChannelFromContext()

    const response = createDACPSuccessResponse(
      request,
      'getCurrentChannelResponse',
      {
        channel: currentChannel
      }
    )

    messagePort.postMessage(response)

    logger.debug('DACP: Get current channel request completed', {
      currentChannel: currentChannel || null,
      requestUuid: request.meta.requestUuid
    })

  } catch (error) {
    logger.error('DACP: Get current channel request failed', error)

    const errorResponse = createDACPErrorResponse(
      message as any,
      DACP_ERROR_TYPES.CHANNEL_ERROR,
      'getCurrentChannelResponse',
      error instanceof Error ? error.message : 'Failed to get current channel'
    )

    messagePort.postMessage(errorResponse)
  }
}

/**
 * Handles join user channel requests
 * Implements DACP joinUserChannelRequest message handling
 */
export async function handleJoinUserChannelRequest(
  message: unknown,
  context: DACPHandlerContext
): Promise<void> {
  const { messagePort } = context

  try {
    const request = validateDACPMessage(message, JoinuserchannelrequestSchema)

    logger.info('DACP: Processing join user channel request', {
      channelId: request.payload.channelId,
      requestUuid: request.meta.requestUuid
    })

    const channelExists = await validateChannelExists(request.payload.channelId)
    if (!channelExists) {
      throw new Error(`Channel ${request.payload.channelId} does not exist`)
    }

    const { instanceId, appId } = getAppInfoFromContext()

    await updateChannelMembership(
      instanceId,
      appId,
      request.payload.channelId,
      messagePort
    )

    const response = createDACPSuccessResponse(
      request,
      'joinUserChannelResponse'
    )

    messagePort.postMessage(response)

    await notifyChannelChanged(instanceId, request.payload.channelId)

    logger.debug('DACP: Join user channel request completed', {
      channelId: request.payload.channelId,
      instanceId,
      requestUuid: request.meta.requestUuid
    })

  } catch (error) {
    logger.error('DACP: Join user channel request failed', error)

    const errorResponse = createDACPErrorResponse(
      message as any,
      error instanceof Error && error.message.includes('does not exist') 
        ? DACP_ERROR_TYPES.NO_CHANNEL_FOUND 
        : DACP_ERROR_TYPES.CHANNEL_ERROR,
      'joinUserChannelResponse',
      error instanceof Error ? error.message : 'Failed to join user channel'
    )

    messagePort.postMessage(errorResponse)
  }
}

/**
 * Handles leave current channel requests
 * Implements DACP leaveCurrentChannelRequest message handling
 */
export async function handleLeaveCurrentChannelRequest(
  message: unknown,
  context: DACPHandlerContext
): Promise<void> {
  const { messagePort } = context

  try {
    const request = message as any

    logger.info('DACP: Processing leave current channel request', {
      requestUuid: request.meta?.requestUuid
    })

    const { instanceId, appId } = getAppInfoFromContext()

    await updateChannelMembership(
      instanceId,
      appId,
      null,
      messagePort
    )

    const response = createDACPSuccessResponse(
      request,
      'leaveCurrentChannelResponse'
    )

    messagePort.postMessage(response)

    await notifyChannelChanged(instanceId, null)

    logger.debug('DACP: Leave current channel request completed', {
      instanceId,
      requestUuid: request.meta?.requestUuid
    })

  } catch (error) {
    logger.error('DACP: Leave current channel request failed', error)

    const errorResponse = createDACPErrorResponse(
      message as any,
      DACP_ERROR_TYPES.CHANNEL_ERROR,
      'leaveCurrentChannelResponse',
      error instanceof Error ? error.message : 'Failed to leave current channel'
    )

    messagePort.postMessage(errorResponse)
  }
}

/**
 * Handles get user channels requests
 * Implements DACP getUserChannelsRequest message handling
 */
export async function handleGetUserChannelsRequest(
  message: unknown,
  context: DACPHandlerContext
): Promise<void> {
  const { messagePort } = context

  try {
    const request = message as any

    logger.info('DACP: Processing get user channels request', {
      requestUuid: request.meta?.requestUuid
    })

    const userChannels = await getUserChannelsFromContext()

    const response = createDACPSuccessResponse(
      request,
      'getUserChannelsResponse',
      {
        userChannels: userChannels
      }
    )

    messagePort.postMessage(response)

    logger.debug('DACP: Get user channels request completed', {
      channelCount: userChannels.length,
      requestUuid: request.meta?.requestUuid
    })

  } catch (error) {
    logger.error('DACP: Get user channels request failed', error)

    const errorResponse = createDACPErrorResponse(
      message as any,
      DACP_ERROR_TYPES.CHANNEL_ERROR,
      'getUserChannelsResponse',
      error instanceof Error ? error.message : 'Failed to get user channels'
    )

    messagePort.postMessage(errorResponse)
  }
}

async function getCurrentChannelFromContext(): Promise<string | null> {
  try {
    logger.debug('Getting current channel from Sail server context')
    return 'red'

  } catch (error) {
    logger.error('Failed to get current channel from server context', error)
    return null
  }
}

async function validateChannelExists(channelId: string): Promise<boolean> {
  try {
    logger.debug('Validating channel exists', { channelId })
    const validChannels = ['red', 'blue', 'green', 'yellow', 'orange', 'purple']
    return validChannels.includes(channelId)

  } catch (error) {
    logger.error('Failed to validate channel exists', error)
    return false
  }
}

function getAppInfoFromContext(): { instanceId: string; appId: string } {
  return {
    instanceId: 'current-app-instance-id',
    appId: 'current-app-id'
  }
}

async function updateChannelMembership(
  instanceId: string,
  appId: string,
  channelId: string | null,
  messagePort: MessagePort
): Promise<void> {
  try {
    logger.debug('Updating channel membership', {
      instanceId,
      appId,
      channelId
    })

    const membership: ChannelMembership = {
      instanceId,
      appId,
      channelId,
      messagePort
    }

    channelMemberships.set(instanceId, membership)

  } catch (error) {
    logger.error('Failed to update channel membership', error)
    throw error
  }
}

async function getUserChannelsFromContext(): Promise<ChannelState[]> {
  try {
    logger.debug('Getting user channels from server context')

    const mockChannels: ChannelState[] = [
      {
        id: 'red',
        type: ChannelType.user,
        displayMetadata: { name: 'Red', color: '#FF0000', glyph: '🔴' },
        context: [],
      },
      {
        id: 'blue',
        type: ChannelType.user,
        displayMetadata: { name: 'Blue', color: '#0000FF', glyph: '🔵' },
        context: [],
      },
      {
        id: 'green',
        type: ChannelType.user,
        displayMetadata: { name: 'Green', color: '#00FF00', glyph: '🟢' },
        context: [],
      }
    ]

    return mockChannels

  } catch (error) {
    logger.error('Failed to get user channels from server context', error)
    throw error
  }
}

async function notifyChannelChanged(instanceId: string, channelId: string | null): Promise<void> {
  try {
    const membership = channelMemberships.get(instanceId)
    if (!membership) {
      logger.warn('No membership found for channel change notification', { instanceId })
      return
    }

    const channelChangedEvent = createDACPEvent('channelChangedEvent', {
      channelId,
      identity: {
        appId: membership.appId,
        instanceId: membership.instanceId
      }
    })

    membership.messagePort.postMessage(channelChangedEvent)

    logger.debug('Channel changed event sent', {
      instanceId,
      channelId,
      appId: membership.appId
    })

  } catch (error) {
    logger.error('Failed to notify channel changed', error)
  }
}

export function getCurrentChannelForInstance(instanceId: string): string | null {
  const membership = channelMemberships.get(instanceId)
  return membership?.channelId || null
}

export function getInstancesOnChannel(channelId: string): string[] {
  return Array.from(channelMemberships.values())
    .filter(membership => membership.channelId === channelId)
    .map(membership => membership.instanceId)
}

export function cleanupChannelMembership(instanceId: string): void {
  const removed = channelMemberships.delete(instanceId)
  if (removed) {
    logger.debug('Cleaned up channel membership', { instanceId })
  }
}
