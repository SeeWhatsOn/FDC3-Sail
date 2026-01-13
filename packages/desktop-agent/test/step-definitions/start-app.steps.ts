import { DataTable, Then, When } from "@cucumber/cucumber"
import { CustomWorld } from "../world"
import { contextMap, createMeta, getAppInstanceId } from "./generic.steps"
import { matchData } from "../support/testing-utils"
import { BrowserTypes } from "@finos/fdc3-schema"
import type { GetInfoRequest } from "@finos/fdc3-schema/dist/generated/api/BrowserTypes"
import { AppInstanceState } from "../../src/core/state/app-instance-registry"
import { cleanupDACPHandlers } from "../../src/core/handlers/dacp"
import type { DACPHandlerContext } from "../../src/core/handlers/types"

type OpenRequest = BrowserTypes.OpenRequest
type GetAppMetadataRequest = BrowserTypes.GetAppMetadataRequest
type FindInstancesRequest = BrowserTypes.FindInstancesRequest
type WebConnectionProtocol4ValidateAppIdentity =
  BrowserTypes.WebConnectionProtocol4ValidateAppIdentity

/**
 * Test fixture helper: Ensures an app instance exists before sending DACP messages.
 * 
 * This simulates an app that has already connected via WCP protocol.
 * In real scenarios, apps connect via WCP4ValidateAppIdentity before sending DACP messages.
 * For tests, we directly create the instance to set up the test fixture.
 * 
 * @param world - The Cucumber world context
 * @param appStr - The app identifier string (e.g., "App1" or "appId: App1, instanceId: a1")
 * @returns The instanceId that was created or already existed
 */
function ensureAppInstanceForTesting(world: CustomWorld, appStr: string): string {
  const meta = createMeta(world, appStr)
  const instanceId = getAppInstanceId(world, appStr)

  const existing = world.desktopAgent.getAppInstanceRegistry().getInstance(instanceId)
  if (!existing) {
    // Test fixture setup: Create connected instance directly
    world.desktopAgent.getAppInstanceRegistry().createInstance({
      instanceId,
      appId: meta.source.appId,
      metadata: {
        appId: meta.source.appId,
        name: meta.source.appId,
      },
    })
    world.desktopAgent.getAppInstanceRegistry().updateInstanceState(instanceId, AppInstanceState.CONNECTED)
  }

  return instanceId
}

When(
  "{string} is opened with connection id {string}",
  function (this: CustomWorld, app: string, uuid: string) {
    const meta = createMeta(this, app)
    const appId = meta.source.appId

    // Store instance ID mapping
    this.props.instances = this.props.instances || {}
    this.props.instances[app] = uuid

    // Test fixture setup: Create app instance directly in registry
    // This simulates an app that has already connected via WCP protocol
    const existing = this.desktopAgent.getAppInstanceRegistry().getInstance(uuid)
    if (!existing) {
      this.desktopAgent.getAppInstanceRegistry().createInstance({
        instanceId: uuid,
        appId,
        metadata: {
          appId,
          name: appId,
        },
      })
    }

    // Set to connected state
    this.desktopAgent.getAppInstanceRegistry().updateInstanceState(uuid, AppInstanceState.CONNECTED)
  }
)

When("{string} is closed", function (this: CustomWorld, app: string) {
  const instanceId = getAppInstanceId(this, app)

  // Run cleanup handlers
  const context: DACPHandlerContext = {
    transport: this.mockTransport,
    instanceId,
    appInstanceRegistry: this.desktopAgent.getAppInstanceRegistry(),
    intentRegistry: this.desktopAgent.getIntentRegistry(),
    channelContextRegistry: this.desktopAgent.getChannelContextRegistry(),
    appChannelRegistry: this.desktopAgent.getAppChannelRegistry(),
    userChannelRegistry: this.desktopAgent.getUserChannelRegistry(),
    appDirectory: this.desktopAgent.getAppDirectory(),
    appLauncher: this.mockAppLauncher,
    requestIntentResolution: this.mockIntentResolver.createCallback(),
  }

  cleanupDACPHandlers(context)

  // Update instance state
  this.desktopAgent
    .getAppInstanceRegistry()
    .updateInstanceState(instanceId, AppInstanceState.TERMINATED)
})

When("{string} sends validate", async function (this: CustomWorld, uuid: string) {
  const instance = this.desktopAgent.getAppInstanceRegistry().getInstance(uuid)
  if (!instance) {
    throw new Error(`Did not find app instance ${uuid}`)
  }

  const message: WebConnectionProtocol4ValidateAppIdentity = {
    type: "WCP4ValidateAppIdentity",
    meta: {
      connectionAttemptUuid: this.createUUID(),
      timestamp: new Date(),
    },
    payload: {
      actualUrl: "something",
      identityUrl: "something",
    },
  }

  // Set to connected state
  this.desktopAgent.getAppInstanceRegistry().updateInstanceState(uuid, AppInstanceState.CONNECTED)

  // Send message to DesktopAgent
  await this.mockTransport.receiveMessage(message)
})

When("{string} revalidates", async function (this: CustomWorld, uuid: string) {
  const instance = this.desktopAgent.getAppInstanceRegistry().getInstance(uuid)
  if (!instance) {
    throw new Error(`Did not find app instance ${uuid}`)
  }

  const message: WebConnectionProtocol4ValidateAppIdentity = {
    type: "WCP4ValidateAppIdentity",
    meta: {
      connectionAttemptUuid: this.createUUID(),
      timestamp: new Date(),
    },
    payload: {
      instanceUuid: uuid,
      actualUrl: "something",
      identityUrl: "something",
    },
  }

  await this.mockTransport.receiveMessage(message)
})

Then("running apps will be", function (this: CustomWorld, dataTable: DataTable) {
  // Assertion: Verify internal state of connected app instances
  // 
  // Note: This queries internal state directly rather than via DACP because:
  // 1. There's no FDC3 API to list "all running apps" (findInstances requires an appId)
  // 2. This is an integration test verifying the Desktop Agent's internal state management
  // 3. This validates that operations (like app launch, cleanup) correctly updated the registry
  const instances = this.desktopAgent.getAppInstanceRegistry().queryInstances({
    state: AppInstanceState.CONNECTED,
  })

  const apps = instances.map(instance => ({
    appId: instance.appId,
    instanceId: instance.instanceId,
    state: "connected",
  }))

  matchData(this, apps, dataTable)
})

When(
  "{string} opens app {string}",
  async function (this: CustomWorld, appStr: string, open: string) {
    // Test fixture setup: Ensure calling app instance exists
    ensureAppInstanceForTesting(this, appStr)
    
    const from = createMeta(this, appStr)

    // Send DACP openRequest message (this is what we're testing)
    const message: OpenRequest = {
      type: "openRequest",
      meta: from,
      payload: {
        app: {
          appId: open,
          desktopAgent: "n/a",
        },
      },
    }

    await this.mockTransport.receiveMessage(message)
  }
)

When(
  "{string} opens app {string} with context data {string}",
  async function (this: CustomWorld, appStr: string, open: string, context: string) {
    // Test fixture setup: Ensure calling app instance exists
    ensureAppInstanceForTesting(this, appStr)
    
    const from = createMeta(this, appStr)

    // Send DACP openRequest message with context (this is what we're testing)
    const message: OpenRequest = {
      type: "openRequest",
      meta: from,
      payload: {
        app: {
          appId: open,
          desktopAgent: "n/a",
        },
        context: contextMap[context],
      },
    }

    await this.mockTransport.receiveMessage(message)
  }
)

When(
  "{string} requests metadata for {string}",
  async function (this: CustomWorld, appStr: string, open: string) {
    // Test fixture setup: Ensure calling app instance exists
    ensureAppInstanceForTesting(this, appStr)
    
    const from = createMeta(this, appStr)

    // Send DACP getAppMetadataRequest message (this is what we're testing)
    const message: GetAppMetadataRequest = {
      type: "getAppMetadataRequest",
      meta: from,
      payload: {
        app: {
          appId: open,
          desktopAgent: "n/a",
        },
      },
    }

    await this.mockTransport.receiveMessage(message)
  }
)

When(
  "{string} requests info on the DesktopAgent",
  async function (this: CustomWorld, appStr: string) {
    // Test fixture setup: Ensure calling app instance exists
    ensureAppInstanceForTesting(this, appStr)
    
    const from = createMeta(this, appStr)

    // Send DACP getInfoRequest message (this is what we're testing)
    const message: GetInfoRequest = {
      type: "getInfoRequest",
      meta: from,
      payload: {},
    }

    await this.mockTransport.receiveMessage(message)
  }
)

When(
  "{string} findsInstances of {string}",
  async function (this: CustomWorld, appStr: string, open: string) {
    // Test fixture setup: Ensure calling app instance exists
    ensureAppInstanceForTesting(this, appStr)
    
    const from = createMeta(this, appStr)

    // Send DACP findInstancesRequest message (this is what we're testing)
    const message: FindInstancesRequest = {
      type: "findInstancesRequest",
      meta: from,
      payload: {
        app: {
          appId: open,
        },
      },
    }

    await this.mockTransport.receiveMessage(message)
  }
)
