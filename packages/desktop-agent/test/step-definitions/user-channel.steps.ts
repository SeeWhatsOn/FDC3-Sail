import { When } from '@cucumber/cucumber';
import { CustomWorld } from '../world';
import { createMeta, getAppInstanceId } from './generic.steps';
import { BrowserTypes } from '@finos/fdc3-schema';
import { handleResolve } from '../support/testing-utils';
import { AppInstanceState } from '../../src/core/state/app-instance-registry';

type GetUserChannelsRequest = BrowserTypes.GetUserChannelsRequest;
type GetCurrentChannelRequest = BrowserTypes.GetCurrentChannelRequest;
type JoinUserChannelRequest = BrowserTypes.JoinUserChannelRequest;
type LeaveCurrentChannelRequest = BrowserTypes.LeaveCurrentChannelRequest;
type GetCurrentContextRequest = BrowserTypes.GetCurrentContextRequest;

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

When('{string} gets the list of user channels', async function (this: CustomWorld, app: string) {
  ensureAppInstance(this, app);
  const meta = createMeta(this, app);
  
  const message: GetUserChannelsRequest = {
    meta,
    payload: {},
    type: 'getUserChannelsRequest',
  };

  await this.mockTransport.receiveMessage(message);
});

When('{string} gets the current user channel', async function (this: CustomWorld, app: string) {
  ensureAppInstance(this, app);
  const meta = createMeta(this, app);
  
  const message: GetCurrentChannelRequest = {
    meta,
    payload: {},
    type: 'getCurrentChannelRequest',
  };

  await this.mockTransport.receiveMessage(message);
});

When('{string} leaves the current user channel', async function (this: CustomWorld, app: string) {
  ensureAppInstance(this, app);
  const meta = createMeta(this, app);
  
  const message: LeaveCurrentChannelRequest = {
    meta,
    payload: {},
    type: 'leaveCurrentChannelRequest',
  };

  await this.mockTransport.receiveMessage(message);
});

When('{string} joins user channel {string}', async function (this: CustomWorld, app: string, channel: string) {
  ensureAppInstance(this, app);
  const meta = createMeta(this, app);
  
  const message: JoinUserChannelRequest = {
    meta,
    payload: {
      channelId: handleResolve(channel, this),
    },
    type: 'joinUserChannelRequest',
  };

  await this.mockTransport.receiveMessage(message);
});

When(
  '{string} gets the latest context on {string} with type {string}',
  async function (this: CustomWorld, app: string, channel: string, type: string) {
    ensureAppInstance(this, app);
    const meta = createMeta(this, app);
    
    const message: GetCurrentContextRequest = {
      meta,
      payload: {
        channelId: handleResolve(channel, this),
        contextType: handleResolve(type, this),
      },
      type: 'getCurrentContextRequest',
    };

    await this.mockTransport.receiveMessage(message);
  }
);
