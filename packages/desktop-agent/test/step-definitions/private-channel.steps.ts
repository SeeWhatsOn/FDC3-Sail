import { When } from '@cucumber/cucumber';
import { CustomWorld } from '../world';
import { createMeta, getAppInstanceId } from './generic.steps';
import { BrowserTypes } from '@finos/fdc3-schema';
import { handleResolve } from '../support/testing-utils';
import { AppInstanceState } from '../../src/core/state/app-instance-registry';

type CreatePrivateChannelRequest = BrowserTypes.CreatePrivateChannelRequest;
type PrivateChannelAddEventListenerRequest = BrowserTypes.PrivateChannelAddEventListenerRequest;
type PrivateChannelUnsubscribeEventListenerRequest = BrowserTypes.PrivateChannelUnsubscribeEventListenerRequest;
type PrivateChannelDisconnectRequest = BrowserTypes.PrivateChannelDisconnectRequest;

/**
 * Helper to ensure app instance exists and is connected before sending messages
 */
function ensureAppInstance(world: CustomWorld, appStr: string): string {
  const instanceId = getAppInstanceId(world, appStr);
  const meta = createMeta(world, appStr);
  
  let instance = world.appInstanceRegistry.getInstance(instanceId);
  if (!instance) {
    world.appInstanceRegistry.createInstance({
      instanceId,
      appId: meta.source.appId,
      metadata: {
        appId: meta.source.appId,
        name: meta.source.appId,
        type: 'web',
      },
    });
    world.appInstanceRegistry.updateInstanceState(instanceId, AppInstanceState.CONNECTED);
  }
  
  return instanceId;
}

When('{string} creates a private channel', async function (this: CustomWorld, app: string) {
  ensureAppInstance(this, app);
  const meta = createMeta(this, app);
  
  const message: CreatePrivateChannelRequest = {
    meta,
    payload: {},
    type: 'createPrivateChannelRequest',
  };

  await this.mockTransport.receiveMessage(message);
});

When('{string} removes event listener {string}', async function (this: CustomWorld, app: string, listenerUUID: string) {
  ensureAppInstance(this, app);
  const meta = createMeta(this, app);
  
  const message: PrivateChannelUnsubscribeEventListenerRequest = {
    meta,
    payload: {
      listenerUUID,
    },
    type: 'privateChannelUnsubscribeEventListenerRequest',
  };

  await this.mockTransport.receiveMessage(message);
});

When(
  '{string} adds an {string} event listener on {string}',
  async function (this: CustomWorld, app: string, listenerType: string, channelId: string) {
    ensureAppInstance(this, app);
    const meta = createMeta(this, app);
    
    const message: PrivateChannelAddEventListenerRequest = {
      meta,
      payload: {
        privateChannelId: handleResolve(channelId, this),
        listenerType,
      },
      type: 'privateChannelAddEventListenerRequest',
    };

    await this.mockTransport.receiveMessage(message);
  }
);

When(
  '{string} disconnects from private channel {string}',
  async function (this: CustomWorld, app: string, channelId: string) {
    ensureAppInstance(this, app);
    const meta = createMeta(this, app);

    const message: PrivateChannelDisconnectRequest = {
      meta,
      payload: {
        channelId: handleResolve(channelId, this),
      },
      type: 'privateChannelDisconnectRequest',
    };

    await this.mockTransport.receiveMessage(message);
  }
);
