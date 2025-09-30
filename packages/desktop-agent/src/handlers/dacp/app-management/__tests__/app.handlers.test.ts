import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { registerDACPHandlers, cleanupDACPHandlers } from '../../index'
import { generateRequestUuid } from '../../../validation/dacp-validator'
import { appInstanceRegistry, AppInstance, AppInstanceState } from '../../../../state/AppInstanceRegistry';
import { getDesktopAgent } from '../../../../desktopAgent';

// Mock the DesktopAgent to control its metadata
vi.mock('../../../../desktopAgent', () => {
    const DesktopAgent = vi.fn();
    DesktopAgent.prototype.getImplementationMetadata = vi.fn(() => ({
        fdc3Version: "2.2",
        provider: "FDC3-Sail",
        providerVersion: "0.1.0",
        optionalFeatures: {
            OriginatingAppMetadata: true,
            UserChannelMembershipAPIs: true,
            PrivateChannels: false, // Not yet implemented
        }
    }));
    const getDesktopAgent = vi.fn(() => new DesktopAgent());
    return { getDesktopAgent };
});

const mockInstance: AppInstance = {
  instanceId: 'test-instance-id',
  appId: 'test-app',
  state: AppInstanceState.CONNECTED,
  contextListeners: new Set(),
  intentListeners: new Set(),
  privateChannels: new Set(),
  currentChannel: null,
  createdAt: new Date(),
  lastActivity: new Date(),
  metadata: { appId: 'test-app', name: 'Test App' }
};

describe('DACP App Management Handlers', () => {
  let messageChannel: MessageChannel
  let port1: MessagePort
  let port2: MessagePort
  let receivedMessages: any[]

  beforeEach(() => {
    messageChannel = new MessageChannel()
    port1 = messageChannel.port1
    port2 = messageChannel.port2

    receivedMessages = []
    port2.onmessage = (event) => {
      receivedMessages.push(event.data)
    }

    port1.start()
    port2.start()

    appInstanceRegistry.createInstance(mockInstance);

    // Register handlers with a mock context
    const mockFDC3Server = { handlers: [], cleanup: vi.fn() };
    const mockServerContext = {
        getDesktopAgent: getDesktopAgent
    };
    registerDACPHandlers(port1, mockServerContext, mockFDC3Server, mockInstance.instanceId)
  })

  afterEach(() => {
    cleanupDACPHandlers(mockInstance.instanceId)
    port1.close()
    port2.close()
    vi.clearAllMocks();
  })

  it('should handle getInfoRequest and return implementation metadata', async () => {
    const getInfoRequest = {
      type: 'getInfoRequest',
      payload: {},
      meta: {
        requestUuid: generateRequestUuid(),
        timestamp: new Date()
      }
    }

    // Send the message
    port2.postMessage(getInfoRequest)

    // Wait for the response
    await new Promise(resolve => setTimeout(resolve, 200))

    // Verify the response
    expect(receivedMessages).toHaveLength(1)
    const response = receivedMessages[0];
    expect(response.type).toBe('getInfoResponse')
    expect(response.meta.requestUuid).toBe(getInfoRequest.meta.requestUuid)
    expect(response.payload.error).toBeUndefined()

    const metadata = response.payload;
    expect(metadata.fdc3Version).toBe('2.2');
    expect(metadata.provider).toBe('FDC3-Sail');
    expect(metadata.optionalFeatures.PrivateChannels).toBe(false);
  })
})
