import { DataTable, Then, When } from '@cucumber/cucumber';
import { CustomWorld } from '../world';
import { contextMap, createMeta, getAppInstanceId } from './generic.steps';
import { matchData } from '../support/testing-utils';
import { BrowserTypes } from '@finos/fdc3-schema';
import { GetInfoRequest } from '@finos/fdc3-schema/dist/generated/api/BrowserTypes';
import { AppInstanceState } from '../../src/core/state/app-instance-registry';
import { cleanupDACPHandlers } from '../../src/core/handlers/dacp';

type OpenRequest = BrowserTypes.OpenRequest;
type GetAppMetadataRequest = BrowserTypes.GetAppMetadataRequest;
type FindInstancesRequest = BrowserTypes.FindInstancesRequest;
type WebConnectionProtocol4ValidateAppIdentity = BrowserTypes.WebConnectionProtocol4ValidateAppIdentity;

When('{string} is opened with connection id {string}', function (this: CustomWorld, app: string, uuid: string) {
  const meta = createMeta(this, app);
  const appId = meta.source.appId;
  
  // Store instance ID mapping
  this.props.instances = this.props.instances || {};
  this.props.instances[app] = uuid;
  
  // Create app instance in registry
  const existing = this.appInstanceRegistry.getInstance(uuid);
  if (!existing) {
    this.appInstanceRegistry.createInstance({
      instanceId: uuid,
      appId,
      metadata: {
        appId,
        name: appId,
        type: 'web',
      },
    });
  }
  
  // Set to connected state
  this.appInstanceRegistry.updateInstanceState(uuid, AppInstanceState.CONNECTED);
});

When('{string} is closed', function (this: CustomWorld, app: string) {
  const instanceId = getAppInstanceId(this, app);
  
  // Run cleanup handlers
  const context = {
    transport: this.mockTransport,
    instanceId,
    appInstanceRegistry: this.appInstanceRegistry,
    intentRegistry: this.intentRegistry,
    channelContextRegistry: this.channelContextRegistry,
    appChannelRegistry: this.appChannelRegistry,
    userChannelRegistry: this.userChannelRegistry,
    appDirectory: this.appDirectory,
    appLauncher: this.mockAppLauncher,
    requestIntentResolution: this.mockIntentResolver.createCallback(),
  };
  
  cleanupDACPHandlers(context);
  
  // Update instance state
  this.appInstanceRegistry.updateInstanceState(instanceId, AppInstanceState.TERMINATED);
});

When('{string} sends validate', async function (this: CustomWorld, uuid: string) {
  const instance = this.appInstanceRegistry.getInstance(uuid);
  if (!instance) {
    throw new Error(`Did not find app instance ${uuid}`);
  }
  
  const message: WebConnectionProtocol4ValidateAppIdentity = {
    type: 'WCP4ValidateAppIdentity',
    meta: {
      connectionAttemptUuid: this.createUUID(),
      timestamp: new Date(),
      source: {
        appId: instance.appId,
        instanceId: uuid,
      },
    },
    payload: {
      actualUrl: 'something',
      identityUrl: 'something',
    },
  };
  
  // Set to connected state
  this.appInstanceRegistry.updateInstanceState(uuid, AppInstanceState.CONNECTED);
  
  // Send message to DesktopAgent
  await this.mockTransport.receiveMessage(message);
});

When('{string} revalidates', async function (this: CustomWorld, uuid: string) {
  const instance = this.appInstanceRegistry.getInstance(uuid);
  if (!instance) {
    throw new Error(`Did not find app instance ${uuid}`);
  }
  
  const message: WebConnectionProtocol4ValidateAppIdentity = {
    type: 'WCP4ValidateAppIdentity',
    meta: {
      connectionAttemptUuid: this.createUUID(),
      timestamp: new Date(),
      source: {
        appId: instance.appId,
        instanceId: uuid,
      },
    },
    payload: {
      instanceUuid: uuid,
      actualUrl: 'something',
      identityUrl: 'something',
    },
  };

  await this.mockTransport.receiveMessage(message);
});

Then('running apps will be', async function (this: CustomWorld, dataTable: DataTable) {
  // Get all connected app instances
  const instances = this.appInstanceRegistry.queryInstances({
    state: AppInstanceState.CONNECTED,
  });
  
  const apps = instances.map(instance => ({
    appId: instance.appId,
    instanceId: instance.instanceId,
    state: 'connected',
  }));
  
  matchData(this, apps, dataTable);
});

When('{string} opens app {string}', async function (this: CustomWorld, appStr: string, open: string) {
  const from = createMeta(this, appStr);
  const instanceId = getAppInstanceId(this, appStr);
  
  // Ensure instance exists in registry
  let instance = this.appInstanceRegistry.getInstance(instanceId);
  if (!instance) {
    this.appInstanceRegistry.createInstance({
      instanceId,
      appId: from.source.appId,
      metadata: {
        appId: from.source.appId,
        name: from.source.appId,
        type: 'web',
      },
    });
    this.appInstanceRegistry.updateInstanceState(instanceId, AppInstanceState.CONNECTED);
  }
  
  const message: OpenRequest = {
    type: 'openRequest',
    meta: from,
    payload: {
      app: {
        appId: open,
        desktopAgent: 'n/a',
      },
    },
  };
  
  await this.mockTransport.receiveMessage(message);
});

When(
  '{string} opens app {string} with context data {string}',
  async function (this: CustomWorld, appStr: string, open: string, context: string) {
    const from = createMeta(this, appStr);
    const instanceId = getAppInstanceId(this, appStr);
    
    // Ensure instance exists in registry
    let instance = this.appInstanceRegistry.getInstance(instanceId);
    if (!instance) {
      this.appInstanceRegistry.createInstance({
        instanceId,
        appId: from.source.appId,
        metadata: {
          appId: from.source.appId,
          name: from.source.appId,
          type: 'web',
        },
      });
      this.appInstanceRegistry.updateInstanceState(instanceId, AppInstanceState.CONNECTED);
    }
    
    const message: OpenRequest = {
      type: 'openRequest',
      meta: from,
      payload: {
        app: {
          appId: open,
          desktopAgent: 'n/a',
        },
        context: contextMap[context],
      },
    };
    
    await this.mockTransport.receiveMessage(message);
  }
);

When('{string} requests metadata for {string}', async function (this: CustomWorld, appStr: string, open: string) {
  const from = createMeta(this, appStr);
  const instanceId = getAppInstanceId(this, appStr);
  
  // Ensure instance exists in registry
  let instance = this.appInstanceRegistry.getInstance(instanceId);
  if (!instance) {
    this.appInstanceRegistry.createInstance({
      instanceId,
      appId: from.source.appId,
      metadata: {
        appId: from.source.appId,
        name: from.source.appId,
        type: 'web',
      },
    });
    this.appInstanceRegistry.updateInstanceState(instanceId, AppInstanceState.CONNECTED);
  }
  
  const message: GetAppMetadataRequest = {
    type: 'getAppMetadataRequest',
    meta: from,
    payload: {
      app: {
        appId: open,
        desktopAgent: 'n/a',
      },
    },
  };
  
  await this.mockTransport.receiveMessage(message);
});

When('{string} requests info on the DesktopAgent', async function (this: CustomWorld, appStr: string) {
  const from = createMeta(this, appStr);
  const instanceId = getAppInstanceId(this, appStr);
  
  // Ensure instance exists in registry
  let instance = this.appInstanceRegistry.getInstance(instanceId);
  if (!instance) {
    this.appInstanceRegistry.createInstance({
      instanceId,
      appId: from.source.appId,
      metadata: {
        appId: from.source.appId,
        name: from.source.appId,
        type: 'web',
      },
    });
    this.appInstanceRegistry.updateInstanceState(instanceId, AppInstanceState.CONNECTED);
  }
  
  const message: GetInfoRequest = {
    type: 'getInfoRequest',
    meta: from,
    payload: {},
  };
  
  await this.mockTransport.receiveMessage(message);
});

When('{string} findsInstances of {string}', async function (this: CustomWorld, appStr: string, open: string) {
  const from = createMeta(this, appStr);
  const instanceId = getAppInstanceId(this, appStr);
  
  // Ensure instance exists in registry
  let instance = this.appInstanceRegistry.getInstance(instanceId);
  if (!instance) {
    this.appInstanceRegistry.createInstance({
      instanceId,
      appId: from.source.appId,
      metadata: {
        appId: from.source.appId,
        name: from.source.appId,
        type: 'web',
      },
    });
    this.appInstanceRegistry.updateInstanceState(instanceId, AppInstanceState.CONNECTED);
  }
  
  const message: FindInstancesRequest = {
    type: 'findInstancesRequest',
    meta: from,
    payload: {
      app: {
        appId: open,
      },
    },
  };
  
  await this.mockTransport.receiveMessage(message);
});
