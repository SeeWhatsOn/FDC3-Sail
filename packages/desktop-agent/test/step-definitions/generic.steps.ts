import { Before, DataTable, Given, Then, When } from "@cucumber/cucumber"
import { CustomWorld } from "../world"
import type { Context, AppIdentifier } from "@finos/fdc3"
import { TEST_USER_CHANNELS } from "../support/channel-data"

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
    author: "Tim Berners-Lee",
    title: "This is for everyone",
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
  "fdc3.portfolio": {
    type: "fdc3.portfolio",
    name: "My Portfolio",
    positions: [
      {
        type: "fdc3.instrument",
        id: {
          ticker: "AAPL",
        },
        holding: 100,
      },
      {
        type: "fdc3.instrument",
        id: {
          ticker: "MSFT",
        },
        holding: 50,
      },
    ],
  },
  "fdc3.chart": {
    type: "fdc3.chart",
    instruments: [
      {
        type: "fdc3.instrument",
        id: {
          ticker: "AAPL",
        },
      },
    ],
    range: {
      type: "fdc3.timeRange",
      startTime: new Date("2024-01-01").toISOString(),
      endTime: new Date("2024-12-31").toISOString(),
    },
  },
}

/**
 * Helper to create message metadata from app identifier string.
 * Supports FDC3 AppIdentifier-like formats:
 * - "appId" (instanceId optional)
 * - "appId: App1, instanceId: a1" (explicit FDC3 AppIdentifier format)
 * - "App1/a1" (legacy format, still supported for backwards compatibility)
 */
export function createMeta(cw: CustomWorld, appStr: string) {
  let app: AppIdentifier
  const desktopAgentName = cw.desktopAgent?.getImplementationMetadata()?.provider ?? "unknown"

  // Parse FDC3 AppIdentifier format: "appId: App1, instanceId: a1"
  if (appStr.includes("appId:") && appStr.includes("instanceId:")) {
    const appIdMatch = appStr.match(/appId:\s*([^,]+)/)
    const instanceIdMatch = appStr.match(/instanceId:\s*(.+)/)
    const appId = appIdMatch?.[1]?.trim()
    const instanceId = instanceIdMatch?.[1]?.trim()

    if (appId) {
      app = instanceId ? { appId, instanceId, desktopAgent: desktopAgentName } : { appId, desktopAgent: desktopAgentName }
    } else {
      throw new Error(`Invalid AppIdentifier format: ${appStr}`)
    }
  }
  // Legacy format: "App1/a1"
  else if (appStr.includes("/")) {
    const [appId, instanceId] = appStr.split("/")
    app = { appId, instanceId, desktopAgent: desktopAgentName }
  }
  // Simple format: just appId
  else {
    app = { appId: appStr, desktopAgent: desktopAgentName }
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
 * Supports FDC3 AppIdentifier-like formats:
 * - "appId: App1, instanceId: a1" (explicit FDC3 AppIdentifier format)
 * - "App1/a1" (legacy format, still supported for backwards compatibility)
 * - "appId" (will generate instance ID)
 */
export function getAppInstanceId(cw: CustomWorld, appStr: string): string {
  // Check if instance ID is already stored in props
  if (!cw.props.instances) {
    cw.props.instances = {}
  }

  // Parse FDC3 AppIdentifier format: "appId: App1, instanceId: a1"
  if (appStr.includes("appId:") && appStr.includes("instanceId:")) {
    const instanceIdMatch = appStr.match(/instanceId:\s*(.+)/)
    const instanceId = instanceIdMatch?.[1]?.trim()
    if (instanceId) {
      cw.props.instances[appStr] = instanceId
      return instanceId
    }
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

// Create a desktop agent by default before each scenario
// Scenarios can call "A desktop agent" again to reset with different apps
Before(function (this: CustomWorld) {
  const apps = this.props[APP_FIELD] ?? []

  // Initialize DesktopAgent with clean architecture
  this.initializeDesktopAgent(apps, TEST_USER_CHANNELS)
})

Given("A desktop agent", function (this: CustomWorld) {
  const apps = this.props[APP_FIELD] ?? []

  // Reinitialize DesktopAgent (useful when apps are defined after the Before hook runs,
  // or when you need a fresh desktop agent mid-scenario)
  this.initializeDesktopAgent(apps, TEST_USER_CHANNELS)
})

Given("A desktop agent with heartbeat checking", function (this: CustomWorld) {
  const apps = this.props[APP_FIELD] ?? []

  // Initialize DesktopAgent
  // TODO: Implement heartbeat checking in new architecture
  this.initializeDesktopAgent(apps, TEST_USER_CHANNELS)
})

When("I shutdown the server", function (this: CustomWorld) {
  // Disconnect transport to simulate shutdown
  this.mockTransport.disconnect()
})

Given("I refer to {string} as {string}", function (this: CustomWorld, value: string, name: string) {
  // Store a value with a name so it can be referenced later as {name}
  this.props[name] = value
})

When("we wait for a period of {string} ms", async function (this: CustomWorld, ms: string) {
  await new Promise(resolve => setTimeout(resolve, parseInt(ms, 10)))
})

When("we wait for the listener timeout", async function (this: CustomWorld) {
  // Default listener timeout
  await new Promise(resolve => setTimeout(resolve, 2100))
})

Then('{string} is true', function (this: CustomWorld, propName: string) {
  const value = this.props[propName]
  if (value !== true) {
    throw new Error(`Expected ${propName} to be true, but got ${JSON.stringify(value)}`)
  }
})

Then('{string} is false', function (this: CustomWorld, propName: string) {
  const value = this.props[propName]
  if (value !== false) {
    throw new Error(`Expected ${propName} to be false, but got ${JSON.stringify(value)}`)
  }
})

Then('{string} is empty', function (this: CustomWorld, propName: string) {
  const value = this.props[propName]
  if (value !== null && value !== undefined && !(Array.isArray(value) && value.length === 0)) {
    throw new Error(`Expected ${propName} to be empty, but got ${JSON.stringify(value)}`)
  }
})

Then('{string} is an array of objects with the following contents', function (this: CustomWorld, propName: string, dataTable: DataTable) {
  const value = this.props[propName]
  if (!Array.isArray(value)) {
    throw new Error(`Expected ${propName} to be an array, but got ${JSON.stringify(value)}`)
  }
  
  const expected = dataTable.hashes()
  if (value.length !== expected.length) {
    throw new Error(`Expected array length ${expected.length}, but got ${value.length}`)
  }
  
  // Simple comparison - could be enhanced
  for (let i = 0; i < expected.length; i++) {
    const expectedRow = expected[i]
    const actualRow = value[i]
    
    for (const [key, expectedValue] of Object.entries(expectedRow)) {
      if (actualRow[key] !== expectedValue) {
        throw new Error(`Expected ${propName}[${i}].${key} to be ${expectedValue}, but got ${actualRow[key]}`)
      }
    }
  }
})
