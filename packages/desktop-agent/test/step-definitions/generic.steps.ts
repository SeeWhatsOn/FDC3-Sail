import { Given, When } from "@cucumber/cucumber"
import { CustomWorld } from "../world"
import type { Context, AppIdentifier } from "@finos/fdc3"

export const APP_FIELD = "apps"

export const contextMap: Record<string, Context> = {
  "fdc3.instrument": {
    type: "fdc3.instrument",
    name: "Apple",
    id: {
      ticker: "AAPL",
    },
  },
  "fdc3.country": {
    type: "fdc3.country",
    name: "Sweden",
    id: {
      COUNTRY_ISOALPHA2: "SE",
      COUNTRY_ISOALPHA3: "SWE",
    },
  },
  "fdc3.unsupported": {
    type: "fdc3.unsupported",
    bogus: true,
  },
  "fdc3.book": {
    type: "fdc3.book",
    author: "Greg Wallace",
    title: "Cooking with Greg",
    id: {
      ISBN: "1234",
    },
  },
  "fdc3.magazine": {
    type: "fdc3.magazine",
    title: "The Economist",
    price: 3.99,
    id: {
      ISSN: "1234",
    },
  },
  "fdc3.periodical": {
    type: "fdc3.periodical",
    title: "The American Poetry Review",
    price: 13.99,
    id: {
      ISSN: "45643",
    },
  },
  "fdc3.product": {
    type: "fdc3.product",
    title: "Current bun",
    id: {
      productId: "cb1",
    },
  },
}

function defaultChannels() {
  return [
    {
      id: "one",
      type: "user" as const,
      displayMetadata: {
        name: "One Channel",
        color: "orange",
      },
    },
    {
      id: "two",
      type: "user" as const,
      displayMetadata: {
        name: "Two Channel",
        color: "skyblue",
      },
    },
    {
      id: "three",
      type: "user" as const,
      displayMetadata: {
        name: "Three Channel",
        color: "ochre",
      },
    },
  ]
}

/**
 * Helper to create message metadata from app identifier string.
 * Supports both "appId" and "appId/instanceId" formats.
 */
export function createMeta(cw: CustomWorld, appStr: string) {
  let app: AppIdentifier
  if (appStr.includes("/")) {
    const [appId, instanceId] = appStr.split("/")
    app = { appId, instanceId }
  } else {
    app = { appId: appStr }
  }

  return {
    requestUuid: cw.createUUID(),
    timestamp: new Date(),
    source: app,
  }
}

/**
 * Helper to parse app identifier string and get/create instance ID.
 * Returns the instance ID that should be used for this app.
 */
export function getAppInstanceId(cw: CustomWorld, appStr: string): string {
  // Check if instance ID is already stored in props
  if (!cw.props.instances) {
    cw.props.instances = {}
  }

  // If appStr includes instance ID (app/instance format), use it
  if (appStr.includes("/")) {
    const [appId, instanceId] = appStr.split("/")
    cw.props.instances[appStr] = instanceId
    return instanceId
  }

  // Otherwise, look up or generate instance ID for this app
  if (cw.props.instances[appStr]) {
    return cw.props.instances[appStr]
  }

  // Generate new instance ID
  const instanceId = `uuid-${Object.keys(cw.props.instances).length}`
  cw.props.instances[appStr] = instanceId
  return instanceId
}

Given("A newly instantiated FDC3 Server", function (this: CustomWorld) {
  const apps = this.props[APP_FIELD] ?? []

  // Initialize DesktopAgent with clean architecture
  this.initializeDesktopAgent(apps, defaultChannels(), {
    intentTimeoutMs: 2000,
    appLaunchTimeoutMs: 2000,
  })
})

Given("A newly instantiated FDC3 Server with heartbeat checking", function (this: CustomWorld) {
  const apps = this.props[APP_FIELD] ?? []

  // Initialize DesktopAgent
  // TODO: Implement heartbeat checking in new architecture
  this.initializeDesktopAgent(apps, defaultChannels(), {
    intentTimeoutMs: 2000,
    appLaunchTimeoutMs: 2000,
  })
})

When("I shutdown the server", function (this: CustomWorld) {
  // Disconnect transport to simulate shutdown
  this.mockTransport.disconnect()
})

Given("schemas loaded", function (this: CustomWorld) {
  // Mark that schemas are loaded
  this.props["schemas_loaded"] = true
})

When("we wait for a period of {string} ms", async function (this: CustomWorld, ms: string) {
  await new Promise(resolve => setTimeout(resolve, parseInt(ms, 10)))
})

When("we wait for the listener timeout", async function (this: CustomWorld) {
  // Default listener timeout
  await new Promise(resolve => setTimeout(resolve, 2100))
})
