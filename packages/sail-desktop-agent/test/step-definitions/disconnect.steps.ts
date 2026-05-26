import { When } from "@cucumber/cucumber"
import { CustomWorld } from "../world/index.ts"
import { getAppInstanceId } from "./generic.steps"

When("{string} disconnects from the DA", function (this: CustomWorld, appStr: string) {
  const instanceId = getAppInstanceId(this, appStr)
  this.desktopAgent.disconnectInstance(instanceId)
})
