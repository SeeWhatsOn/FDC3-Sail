import { World, setWorldConstructor } from "@cucumber/cucumber"
import { createTestDacpRuntime } from "../support/TestDacpRuntime"
import { BasicDirectory } from "../../src/app-directory/BasicDirectory"

export class CustomWorld extends World {
  sc = createTestDacpRuntime(this, [], new BasicDirectory([]), false)
  props: Record<string, any> = {}
}

setWorldConstructor(CustomWorld)
