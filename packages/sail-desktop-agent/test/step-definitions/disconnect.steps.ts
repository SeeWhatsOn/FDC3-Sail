import { When } from "@cucumber/cucumber"
import { CustomWorld } from "../world/index.ts"
import { getAppInstanceId } from "./generic.steps"
import { cleanupDACPHandlers } from "../../src/core/handlers/dacp"

/**
 * Production-path disconnect: only runs cleanupDACPHandlers with the agent's real
 * pending-intent map (no manual removeInstance / empty promise map).
 */
When("{string} disconnects from the DA", function (this: CustomWorld, appStr: string) {
  const instanceId = getAppInstanceId(this, appStr)
  const context = this.desktopAgent.createHandlerContextForTesting(instanceId)
  cleanupDACPHandlers(context)
})
