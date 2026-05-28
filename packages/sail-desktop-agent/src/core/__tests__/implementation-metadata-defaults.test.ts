import { afterEach, describe, expect, it } from "vitest"
import type { BrowserTypes } from "@finos/fdc3"

import { MockTransport } from "../../__tests__/utils/mock-transport"
import { AppDirectoryManager } from "../app-directory/app-directory-manager"
import { DesktopAgent } from "../desktop-agent"
import { DEFAULT_FDC3_USER_CHANNELS } from "../default-user-channels"
import { handleGetInfoRequest } from "../handlers/dacp/app-handlers"
import { createDACPTestContext } from "../handlers/dacp/__tests__/test-context"
import {
  clearAllHeartbeatTimersForTesting,
} from "../handlers/dacp/heartbeat-runtime"
import { handleWcp4ValidateAppIdentity } from "../handlers/dacp/wcp-handlers"
import { createInitialState } from "../state/initial-state"
import { connectInstance, updateInstanceState } from "../state/mutators"
import { AppInstanceState } from "../state/types"

afterEach(() => {
  clearAllHeartbeatTimersForTesting()
})

function getAgentDefaultProviderVersion(): string {
  const metadata = new DesktopAgent().getImplementationMetadata()
  expect(metadata?.providerVersion).toBeDefined()
  return metadata!.providerVersion!
}

function createHandlerContextWithoutImplementationMetadata(instanceId: string) {
  let state = createInitialState(DEFAULT_FDC3_USER_CHANNELS)
  state = connectInstance(state, {
    instanceId,
    appId: "test-app",
    metadata: { appId: "test-app", name: "Test App" },
  })
  state = updateInstanceState(state, instanceId, AppInstanceState.CONNECTED)

  const transport = new MockTransport()
  const { context } = createDACPTestContext({ instanceId, initialState: state })

  return {
    context: {
      ...context,
      transport,
      implementationMetadata: undefined,
    },
    transport,
  }
}

describe("implementationMetadata defaults", () => {
  describe("handleGetInfoRequest", () => {
    it("uses the same providerVersion as DesktopAgent config when context omits implementationMetadata", () => {
      const expectedProviderVersion = getAgentDefaultProviderVersion()
      const instanceId = "instance-getinfo-defaults"
      const { context, transport } =
        createHandlerContextWithoutImplementationMetadata(instanceId)

      const message: BrowserTypes.GetInfoRequest = {
        type: "getInfoRequest",
        meta: { source: { instanceId } },
        payload: {},
      }

      handleGetInfoRequest(message, context)

      const response = transport.getLastMessage() as {
        type: string
        payload?: { implementationMetadata?: { providerVersion?: string } }
      }

      expect(response.type).toBe("getInfoResponse")
      expect(response.payload?.implementationMetadata?.providerVersion).toBe(
        expectedProviderVersion
      )
    })
  })

  describe("WCP5 validate app identity", () => {
    it("uses the same providerVersion as DesktopAgent config when context omits implementationMetadata", () => {
      const expectedProviderVersion = getAgentDefaultProviderVersion()
      const connectionAttemptUuid = "metadata-defaults-uuid"
      const tempInstanceId = `temp-${connectionAttemptUuid}`
      const transport = new MockTransport()

      const appDirectory = new AppDirectoryManager()
      appDirectory.addApplications([
        {
          appId: "test-app",
          title: "Test App",
          type: "web",
          details: { url: "https://example.com/app" },
        },
      ])

      const { context } = createDACPTestContext({ instanceId: tempInstanceId })
      const wcpContext = {
        ...context,
        transport,
        appDirectory,
        implementationMetadata: undefined,
      }

      const message = {
        type: "WCP4ValidateAppIdentity",
        payload: {
          identityUrl: "https://example.com/app",
          actualUrl: "https://example.com/app",
        },
        meta: {
          connectionAttemptUuid,
          timestamp: new Date().toISOString(),
          messageOrigin: "https://example.com",
        },
      } as unknown as BrowserTypes.WebConnectionProtocol4ValidateAppIdentity

      handleWcp4ValidateAppIdentity(message, wcpContext)

      const response = transport.sentMessages.find(
        sent => (sent as { type?: string }).type === "WCP5ValidateAppIdentityResponse"
      ) as {
        type: string
        payload?: { implementationMetadata?: { providerVersion?: string } }
      }

      expect(response).toBeDefined()
      expect(response.type).toBe("WCP5ValidateAppIdentityResponse")
      expect(response.payload?.implementationMetadata?.providerVersion).toBe(
        expectedProviderVersion
      )
    })
  })

  describe("DesktopAgent with default config", () => {
    it("returns the same providerVersion from getInfo and WCP5", async () => {
      const appDirectory = new AppDirectoryManager()
      appDirectory.addApplications([
        {
          appId: "test-app",
          title: "Test App",
          type: "web",
          details: { url: "https://example.com/app" },
        },
      ])

      const transport = new MockTransport()
      const agent = new DesktopAgent({
        transport,
        appDirectoryManager: appDirectory,
      })
      agent.start()

      const expectedProviderVersion = agent.getImplementationMetadata()!.providerVersion

      const wcp4Message = {
        type: "WCP4ValidateAppIdentity",
        payload: {
          identityUrl: "https://example.com/app",
          actualUrl: "https://example.com/app",
        },
        meta: {
          connectionAttemptUuid: "integration-defaults-uuid",
          timestamp: new Date().toISOString(),
          messageOrigin: "https://example.com",
        },
      } as unknown as BrowserTypes.WebConnectionProtocol4ValidateAppIdentity

      await transport.receiveMessage(wcp4Message)

      const wcp5Response = transport.getLastMessage() as {
        type: string
        payload?: { instanceId?: string; implementationMetadata?: { providerVersion?: string } }
      }

      expect(wcp5Response.type).toBe("WCP5ValidateAppIdentityResponse")
      const wcp5ProviderVersion = wcp5Response.payload?.implementationMetadata?.providerVersion
      expect(wcp5ProviderVersion).toBe(expectedProviderVersion)

      const canonicalInstanceId = wcp5Response.payload?.instanceId
      expect(canonicalInstanceId).toBeDefined()

      transport.clear()

      const getInfoMessage: BrowserTypes.GetInfoRequest = {
        type: "getInfoRequest",
        meta: { source: { instanceId: canonicalInstanceId! } },
        payload: {},
      }

      await transport.receiveMessage(getInfoMessage)

      const getInfoResponse = transport.getLastMessage() as {
        type: string
        payload?: { implementationMetadata?: { providerVersion?: string } }
      }

      expect(getInfoResponse.type).toBe("getInfoResponse")
      expect(getInfoResponse.payload?.implementationMetadata?.providerVersion).toBe(
        expectedProviderVersion
      )
      expect(getInfoResponse.payload?.implementationMetadata?.providerVersion).toBe(
        wcp5ProviderVersion
      )
    })
  })
})
