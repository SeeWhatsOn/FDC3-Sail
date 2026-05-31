import { describe, expect, it } from "vitest"
import type { BrowserTypes } from "@finos/fdc3"
import { MockTransport } from "../../../../__tests__/utils/mock-transport"
import { AppDirectoryManager } from "../../../app-directory/app-directory-manager"
import type { DirectoryApp } from "../../../app-directory/types"
import { DEFAULT_FDC3_USER_CHANNELS } from "../../../default-user-channels"
import { connectInstance, updateInstanceState } from "../../../state/mutators"
import { createInitialState } from "../../../state/initial-state"
import { AppInstanceState } from "../../../state/types"
import { handleGetAppMetadataRequest } from "../app-handlers"
import { createDACPTestContext } from "./test-context"

const TEST_PROVIDER = "test-provider"

const chartApp: DirectoryApp = {
  appId: "chartApp",
  name: "chartApp",
  title: "Chart App",
  type: "web",
  details: { url: "https://example.com/chart" },
}

function createAppDirectory(apps: DirectoryApp[]): AppDirectoryManager {
  const directory = new AppDirectoryManager()
  directory.addApplications(apps)
  return directory
}

function createRequestMeta(requestUuid: string): BrowserTypes.RequestMessage["meta"] {
  return {
    requestUuid,
    timestamp: new Date(),
    source: { appId: "portfolioApp", instanceId: "a1" },
  }
}

type GetAppMetadataSuccessResponse = {
  type: "getAppMetadataResponse"
  payload: {
    appMetadata: {
      appId: string
      instanceId?: string
      desktopAgent?: string
    }
  }
}

function getAppMetadataResponse(transport: MockTransport): GetAppMetadataSuccessResponse {
  const last = transport.getLastMessage() as GetAppMetadataSuccessResponse
  expect(last.type).toBe("getAppMetadataResponse")
  return last
}

function createConnectedCallerState() {
  let state = createInitialState(DEFAULT_FDC3_USER_CHANNELS)
  state = connectInstance(state, {
    instanceId: "a1",
    appId: "portfolioApp",
    metadata: { appId: "portfolioApp", name: "portfolioApp" },
  })
  state = updateInstanceState(state, "a1", AppInstanceState.CONNECTED)
  return state
}

describe("getAppMetadata desktopAgent field", () => {
  it("includes desktopAgent for directory-only lookup", () => {
    const state = createConnectedCallerState()
    const transport = new MockTransport()
    const directory = createAppDirectory([chartApp])
    const { context } = createDACPTestContext({ instanceId: "a1", initialState: state })

    handleGetAppMetadataRequest(
      {
        type: "getAppMetadataRequest",
        meta: createRequestMeta("get-app-metadata-directory-only"),
        payload: {
          app: { appId: "chartApp" },
        },
      },
      {
        ...context,
        transport,
        appDirectory: directory,
        implementationMetadata: {
          ...context.implementationMetadata,
          provider: TEST_PROVIDER,
        },
      }
    )

    const response = getAppMetadataResponse(transport)
    expect(response.payload.appMetadata.appId).toBe("chartApp")
    expect(response.payload.appMetadata.instanceId).toBeUndefined()
    expect(response.payload.appMetadata.desktopAgent).toBe(TEST_PROVIDER)
  })

  it("includes instanceId and desktopAgent for running instance", () => {
    let state = createConnectedCallerState()
    state = connectInstance(state, {
      instanceId: "chart-123",
      appId: "chartApp",
      metadata: { appId: "chartApp", name: "chartApp" },
    })
    state = updateInstanceState(state, "chart-123", AppInstanceState.CONNECTED)

    const transport = new MockTransport()
    const directory = createAppDirectory([chartApp])
    const { context } = createDACPTestContext({ instanceId: "a1", initialState: state })

    handleGetAppMetadataRequest(
      {
        type: "getAppMetadataRequest",
        meta: createRequestMeta("get-app-metadata-running-instance"),
        payload: {
          app: { appId: "chartApp" },
        },
      },
      {
        ...context,
        transport,
        appDirectory: directory,
        implementationMetadata: {
          ...context.implementationMetadata,
          provider: TEST_PROVIDER,
        },
      }
    )

    const response = getAppMetadataResponse(transport)
    expect(response.payload.appMetadata.appId).toBe("chartApp")
    expect(response.payload.appMetadata.instanceId).toBe("chart-123")
    expect(response.payload.appMetadata.desktopAgent).toBe(TEST_PROVIDER)
  })
})
