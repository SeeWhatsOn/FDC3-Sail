import { When } from "@cucumber/cucumber"
import { CustomWorld } from "../world"
import { createMeta, getAppInstanceId } from "./generic.steps"
import { handleResolve } from "../support/testing-utils"
import { BrowserTypes } from "@finos/fdc3-schema"
import { AppInstanceState } from "../../src/core/state/app-instance-registry"
type GetOrCreateChannelRequest = BrowserTypes.GetOrCreateChannelRequest

/**
 * Helper to ensure app instance exists and is connected before sending messages
 */
function ensureAppInstance(world: CustomWorld, appStr: string): string {
  const instanceId = getAppInstanceId(world, appStr)
  const meta = createMeta(world, appStr)

  const instance = world.appInstanceRegistry.getInstance(instanceId)
  if (!instance) {
    world.appInstanceRegistry.createInstance({
      instanceId,
      appId: meta.source.appId,
      metadata: {
        appId: meta.source.appId,
        name: meta.source.appId,
        type: "web",
      },
    })
    world.appInstanceRegistry.updateInstanceState(instanceId, AppInstanceState.CONNECTED)
  }

  return instanceId
}

When(
  "{string} creates or gets an app channel called {string}",
  async function (this: CustomWorld, app: string, channel: string) {
    ensureAppInstance(this, app)
    const meta = createMeta(this, app)

    const message: GetOrCreateChannelRequest = {
      meta,
      payload: {
        channelId: handleResolve(channel, this),
      },
      type: "getOrCreateChannelRequest",
    }

    await this.mockTransport.receiveMessage(message)
  }
)
