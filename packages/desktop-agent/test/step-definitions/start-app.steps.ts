import { DataTable, Then, When } from "@cucumber/cucumber"
import { CustomWorld } from "../world"
import { contextMap, createMeta, getAppInstanceId } from "./generic.steps"
import { matchData } from "../support/testing-utils"
import { BrowserTypes } from "@finos/fdc3-schema"
import type { GetInfoRequest } from "@finos/fdc3-schema/dist/generated/api/BrowserTypes"
import { AppInstanceState } from "../../src/core/state/types"
import { cleanupDACPHandlers } from "../../src/core/handlers/dacp"
import type { DACPHandlerContext } from "../../src/core/handlers/types"
import { getInstance, getInstancesByState } from "../../src/core/state/selectors"
import { connectInstance, updateInstanceState } from "../../src/core/state/mutators"
import { consoleLogger } from "../../src/core/interfaces/logger"

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

    const state = world.getState()
    const existing = getInstance(state, instanceId)
    if (!existing) {
      // Test fixture setup: Create connected instance directly
      world.updateState(currentState =>
        updateInstanceState(
          connectInstance(currentState, {
            instanceId,
            appId: meta.source.appId,
            metadata: {
              appId: meta.source.appId,
              name: meta.source.appId,
            },
          }),
          instanceId,
          AppInstanceState.CONNECTED
        )
      )
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

    // Test fixture setup: Create app instance directly in state
    // This simulates an app that has already connected via WCP protocol
    const state = this.getState()
    const existing = getInstance(state, uuid)
    if (!existing) {
      this.updateState(currentState =>
        connectInstance(currentState, {
          instanceId: uuid,
          appId,
          metadata: {
            appId,
            name: appId,
          },
        })
      )
    }

    // Set to connected state
    this.updateState(currentState =>
      updateInstanceState(currentState, uuid, AppInstanceState.CONNECTED)
    )
  }
)

When("{string} is closed", function (this: CustomWorld, app: string) {
  const instanceId = getAppInstanceId(this, app)

  // Run cleanup handlers
  const context: DACPHandlerContext = {
    transport: this.mockTransport,
    instanceId,
    getState: () => this.getState(),
    setState: (fn) => {
      this.updateState(fn)
    },
    appDirectory: this.appDirectoryManager,
    appLauncher: this.mockAppLauncher,
    requestIntentResolution: this.mockIntentResolver.createCallback(),
    logger: consoleLogger,
    implementationMetadata: this.desktopAgent.getImplementationMetadata(),
  }

  cleanupDACPHandlers(context)

  // Update instance state
  this.updateState(currentState =>
    updateInstanceState(currentState, instanceId, AppInstanceState.TERMINATED)
  )
})

When("{string} sends validate", async function (this: CustomWorld, uuid: string) {
  const state = this.getState()
  const instance = getInstance(state, uuid)
  if (!instance) {
    throw new Error(`Did not find app instance ${uuid}`)
  }

  // Get app URL from app directory to match what WCP4 handler expects
  const apps = this.appDirectoryManager.retrieveAppsById(instance.appId)
  const appUrl = apps.length > 0 && apps[0].details && typeof apps[0].details === "object" && "url" in apps[0].details
    ? (apps[0].details.url)
    : `https://example.com/${instance.appId}`

  const message: WebConnectionProtocol4ValidateAppIdentity = {
    type: "WCP4ValidateAppIdentity",
    meta: {
      connectionAttemptUuid: this.createUUID(),
      timestamp: new Date(),
    },
    payload: {
      actualUrl: appUrl,
      identityUrl: appUrl,
    },
  }

  // Set to connected state
  this.updateState(currentState =>
    updateInstanceState(currentState, uuid, AppInstanceState.CONNECTED)
  )

  // Send message to DesktopAgent
  await this.mockTransport.receiveMessage(message)
})

When("{string} revalidates", async function (this: CustomWorld, uuid: string) {
  const state = this.getState()
  const instance = getInstance(state, uuid)
  // Get app URL from app directory to match what WCP4 handler expects.
  // If instance is missing, use an unknown app URL to trigger WCP5 failure.
  const appUrl = instance
    ? (() => {
        const apps = this.appDirectoryManager.retrieveAppsById(instance.appId)
        return apps.length > 0 &&
          apps[0].details &&
          typeof apps[0].details === "object" &&
          "url" in apps[0].details
          ? apps[0].details.url
          : `https://example.com/${instance.appId}`
      })()
    : `https://example.com/unknown-app/${uuid}`

  const message: WebConnectionProtocol4ValidateAppIdentity = {
    type: "WCP4ValidateAppIdentity",
    meta: {
      connectionAttemptUuid: this.createUUID(),
      timestamp: new Date(),
    },
    payload: {
      instanceId: uuid,
      instanceUuid: uuid,
      actualUrl: appUrl,
      identityUrl: appUrl,
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
  // 3. This validates that operations (like app launch, cleanup) correctly updated the state
  const state = this.getState()
  const instances = getInstancesByState(state, AppInstanceState.CONNECTED)

  const apps = instances.map((instance: { appId: string; instanceId: string }) => ({
    appId: instance.appId,
    instanceId: instance.instanceId,
    state: "connected",
  }))

  matchData(this, apps, dataTable)
})

When(
  "{string} opens app {string} [fdc3.open]",
  async function (this: CustomWorld, appStr: string, open: string) {
    // Test fixture setup: Ensure calling app instance exists
    ensureAppInstanceForTesting(this, appStr)
    
    const from = createMeta(this, appStr)

    // Send DACP openRequest message (corresponds to fdc3.open() API call)
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
  "{string} opens app {string} with context data {string} [fdc3.open]",
  async function (this: CustomWorld, appStr: string, open: string, context: string) {
    // Test fixture setup: Ensure calling app instance exists
    ensureAppInstanceForTesting(this, appStr)
    
    const from = createMeta(this, appStr)

    // Send DACP openRequest message with context (corresponds to fdc3.open() API call)
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
  "{string} requests metadata for {string} [fdc3.getAppMetadata]",
  async function (this: CustomWorld, appStr: string, open: string) {
    // Test fixture setup: Ensure calling app instance exists
    ensureAppInstanceForTesting(this, appStr)
    
    const from = createMeta(this, appStr)

    // Send DACP getAppMetadataRequest message (corresponds to fdc3.getAppMetadata() API call)
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
  "{string} requests info on the DesktopAgent [fdc3.getInfo]",
  async function (this: CustomWorld, appStr: string) {
    // Test fixture setup: Ensure calling app instance exists
    ensureAppInstanceForTesting(this, appStr)
    
    const from = createMeta(this, appStr)

    // Send DACP getInfoRequest message (corresponds to fdc3.getInfo() API call)
    const message: GetInfoRequest = {
      type: "getInfoRequest",
      meta: from,
      payload: {},
    }

    await this.mockTransport.receiveMessage(message)
  }
)

When(
  "{string} findsInstances of {string} [fdc3.findInstances]",
  async function (this: CustomWorld, appStr: string, open: string) {
    // Test fixture setup: Ensure calling app instance exists
    ensureAppInstanceForTesting(this, appStr)
    
    const from = createMeta(this, appStr)

    // Send DACP findInstancesRequest message (corresponds to fdc3.findInstances() API call)
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
