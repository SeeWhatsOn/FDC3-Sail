import { describe, it, expect } from "vitest"
import type { BrowserTypes } from "@finos/fdc3"
import { DesktopAgent } from "../desktop-agent"
import { AppDirectoryManager } from "../app-directory/app-directory-manager"
import { MockTransport } from "../../__tests__/utils/mock-transport"

describe("DesktopAgent WCP routing", () => {
  it("routes WCP4 without meta.source and uses temp instanceId", async () => {
    const appDirectory = new AppDirectoryManager()
    appDirectory.addApplications([
      {
        appId: "test-app",
        title: "Test App",
        type: "web",
        details: {
          url: "https://example.com/app",
        },
      },
    ])

    const transport = new MockTransport()
    const agent = new DesktopAgent({
      transport,
      appDirectoryManager: appDirectory,
    })

    agent.start()

    const message = {
      type: "WCP4ValidateAppIdentity",
      payload: {
        identityUrl: "https://example.com/app",
        actualUrl: "https://example.com/app",
      },
      meta: {
        connectionAttemptUuid: "test-uuid",
        timestamp: new Date().toISOString(),
      },
    } as unknown as BrowserTypes.WebConnectionProtocol4ValidateAppIdentity

    await transport.receiveMessage(message)

    expect(transport.sentMessages).toHaveLength(1)
    const response = transport.getLastMessage() as {
      type: string
      meta?: {
        destination?: { instanceId?: string }
        connectionAttemptUuid?: string
        timestamp?: string
      }
    }

    expect(response.type).toBe("WCP5ValidateAppIdentityResponse")
    expect(response.meta?.destination?.instanceId).toBe("temp-test-uuid")
    expect(response.meta?.connectionAttemptUuid).toBe("test-uuid")
    expect(typeof response.meta?.timestamp).toBe("string")
  })
})
